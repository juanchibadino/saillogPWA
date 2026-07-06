"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canDeleteCamps, canManageTeamStructure } from "@/lib/auth/capabilities"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createCampInputSchema,
  deleteCampInputSchema,
  updateCampGoalsInputSchema,
  updateCampInputSchema,
} from "@/lib/validation/camps"
import {
  buildTeamCampsRedirectPath,
  resolveCampGoalsActionRedirect,
} from "@/features/camps/detail-route-state.mjs"
import {
  logCampDetailTiming,
  startCampDetailTiming,
  type CampDetailTimingStatus,
} from "@/features/camps/detail-timing"

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getBooleanField(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

function parseOptionalPage(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.floor(parsed)
}

function parseOptionalCampType(
  value: string | undefined,
): "training" | "regatta" | "mixed" | undefined {
  if (value === "training" || value === "regatta" || value === "mixed") {
    return value
  }

  return undefined
}

function parseOptionalCampStatus(
  value: string | undefined,
): "active" | "inactive" | undefined {
  if (value === "active" || value === "inactive") {
    return value
  }

  return undefined
}

type CampActionScope = {
  scopeCampStatus?: "active" | "inactive"
  scopeCampType?: "training" | "regatta" | "mixed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeTab?: string
  scopePage?: number
}

function logCampActionTiming(input: {
  campId?: string | null
  error?: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  outcome: string
  phase: string
  scope: CampActionScope
  startedAt: number
  status: CampDetailTimingStatus
}): void {
  logCampDetailTiming({
    route: "/team-camps/[id]",
    phase: input.phase,
    startedAt: input.startedAt,
    campId: input.campId,
    activeTeamId: input.scope.scopeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: {
      activeOrganizationId: input.scope.scopeOrgId ?? null,
      outcome: input.outcome,
      scopeTab: input.scope.scopeTab,
      scopePage: input.scope.scopePage,
      ...input.metadata,
    },
  })
}

function getScopeFromFormData(formData: FormData): {
  scopeCampStatus?: "active" | "inactive"
  scopeCampType?: "training" | "regatta" | "mixed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeTab?: string
  scopePage?: number
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const scopeVenueId = getFormString(formData, "scopeVenueId")
  const scopeCampType = parseOptionalCampType(getFormString(formData, "scopeCampType"))
  const scopeCampStatus = parseOptionalCampStatus(getFormString(formData, "scopeCampStatus"))
  const scopeTab = getFormString(formData, "scopeTab")
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeVenueId,
      scopeCampType,
      scopeCampStatus,
      scopeTab,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
    scopeCampType,
    scopeCampStatus,
    scopeTab,
    scopePage,
  }
}

async function ensureTeamVenueBelongsToScope(input: {
  teamVenueId: string
  scopeTeamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("id", input.teamVenueId)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError) {
    return false
  }

  return Boolean(teamVenueRow)
}

async function ensureCampBelongsToScope(input: {
  campId: string
  scopeTeamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", input.campId)
    .maybeSingle()

  if (campError || !campRow) {
    return false
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError) {
    return false
  }

  return Boolean(teamVenueRow)
}

async function resolveTeamOrganizationId(teamId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    return null
  }

  return teamRow?.organization_id ?? null
}

export async function createCampAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = createCampInputSchema.safeParse({
    teamVenueId: getFormString(formData, "teamVenueId"),
    name: getFormString(formData, "name"),
    campType: getFormString(formData, "campType"),
    startDate: getFormString(formData, "startDate"),
    endDate: getFormString(formData, "endDate"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const teamVenueBelongsToScope = await ensureTeamVenueBelongsToScope({
    teamVenueId: parsedInput.data.teamVenueId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!teamVenueBelongsToScope) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: resolvedOrganizationId,
    resource: "camps",
  })

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildTeamCampsRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: insertError } = await supabase.from("camps").insert({
    team_venue_id: parsedInput.data.teamVenueId,
    name: parsedInput.data.name,
    camp_type: parsedInput.data.campType,
    start_date: parsedInput.data.startDate,
    end_date: parsedInput.data.endDate,
    is_active: true,
  })

  if (insertError) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath("/team-sessions")

  redirect(
    buildTeamCampsRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateCampAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = updateCampInputSchema.safeParse({
    id: getFormString(formData, "id"),
    teamVenueId: getFormString(formData, "teamVenueId"),
    name: getFormString(formData, "name"),
    campType: getFormString(formData, "campType"),
    startDate: getFormString(formData, "startDate"),
    endDate: getFormString(formData, "endDate"),
    isActive: getBooleanField(formData, "isActive"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const teamVenueBelongsToScope = await ensureTeamVenueBelongsToScope({
    teamVenueId: parsedInput.data.teamVenueId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!teamVenueBelongsToScope) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("camps")
    .update({
      team_venue_id: parsedInput.data.teamVenueId,
      name: parsedInput.data.name,
      camp_type: parsedInput.data.campType,
      start_date: parsedInput.data.startDate,
      end_date: parsedInput.data.endDate,
      is_active: parsedInput.data.isActive,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.id}`)
  revalidatePath("/team-sessions")

  redirect(
    buildTeamCampsRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function deleteCampAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = deleteCampInputSchema.safeParse({
    id: getFormString(formData, "id"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canDeleteCamps({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: deleteError } = await supabase
    .from("camps")
    .delete()
    .eq("id", parsedInput.data.id)

  if (deleteError) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.id}`)
  revalidatePath("/team-sessions")

  redirect(
    buildTeamCampsRedirectPath({
      status: "deleted",
      ...scope,
    }),
  )
}

export async function updateCampGoalsAction(formData: FormData): Promise<void> {
  const startedAt = startCampDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const campId = getFormString(formData, "campId")
  const logTiming = (
    status: CampDetailTimingStatus,
    outcome: string,
    error?: string,
  ) => {
    logCampActionTiming({
      phase: "save_camp_goals",
      startedAt,
      scope,
      campId,
      status,
      outcome,
      error,
    })
  }

  if (!campId || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming("error", "missing_required")
    redirect(
      resolveCampGoalsActionRedirect({ outcome: "missing_required", campId, ...scope }),
    )
  }

  const parsedInput = updateCampGoalsInputSchema.safeParse({
    campId,
    goals: getFormString(formData, "goals") ?? "",
  })

  if (!parsedInput.success) {
    logTiming("error", "invalid_input")
    redirect(
      resolveCampGoalsActionRedirect({ outcome: "invalid_input", campId, ...scope }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    logTiming("error", "forbidden")
    redirect(
      resolveCampGoalsActionRedirect({
        outcome: "forbidden",
        campId: parsedInput.data.campId,
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    logTiming("error", "missing_camp")
    redirect(
      resolveCampGoalsActionRedirect({
        outcome: "missing_camp",
        campId: parsedInput.data.campId,
        ...scope,
      }),
    )
  }

  const normalizedGoals = parsedInput.data.goals.trim()
  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("camps")
    .update({
      notes: normalizedGoals.length > 0 ? normalizedGoals : null,
    })
    .eq("id", parsedInput.data.campId)

  if (updateError) {
    logTiming("error", "update_failed", updateError.message)
    redirect(
      resolveCampGoalsActionRedirect({
        outcome: "update_failed",
        campId: parsedInput.data.campId,
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.campId}`)

  logCampActionTiming({
    phase: "save_camp_goals",
    startedAt,
    scope,
    campId: parsedInput.data.campId,
    status: "success",
    outcome: "saved",
    metadata: {
      hasGoals: normalizedGoals.length > 0,
    },
  })

  redirect(
    resolveCampGoalsActionRedirect({
      outcome: "saved",
      campId: parsedInput.data.campId,
      ...scope,
    }),
  )
}
