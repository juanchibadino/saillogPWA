"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createCampInputSchema,
  updateCampGoalsInputSchema,
  updateCampInputSchema,
} from "@/lib/validation/camps"

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

function getScopeFromFormData(formData: FormData): {
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
  const scopeTab = getFormString(formData, "scopeTab")
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeVenueId,
      scopeTab,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
    scopeTab,
    scopePage,
  }
}

function buildTeamCampsRedirectPath(input: {
  status?: "created" | "updated"
  error?: "invalid_input" | "forbidden" | "create_failed" | "update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopePage?: number
}): string {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId)
  }

  if (input.scopeVenueId) {
    params.set("venue", input.scopeVenueId)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(input.scopePage))
  }

  const query = params.toString()
  return query.length > 0 ? `/team-camps?${query}` : "/team-camps"
}

function buildCampDetailRedirectPath(input: {
  campId: string
  status?: "goals_updated"
  error?: "invalid_input" | "forbidden" | "update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeTab?: string
  scopePage?: number
}): string {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId)
  }

  if (input.scopeTab) {
    params.set("tab", input.scopeTab)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(input.scopePage))
  }

  const query = params.toString()
  const basePath = `/team-camps/${input.campId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
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

export async function updateCampGoalsAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const campId = getFormString(formData, "campId")

  if (!campId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamCampsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateCampGoalsInputSchema.safeParse({
    campId,
    goals: getFormString(formData, "goals") ?? "",
  })

  if (!parsedInput.success) {
    redirect(
      buildCampDetailRedirectPath({
        campId,
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
      buildCampDetailRedirectPath({
        campId: parsedInput.data.campId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildCampDetailRedirectPath({
        campId: parsedInput.data.campId,
        error: "invalid_input",
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
    redirect(
      buildCampDetailRedirectPath({
        campId: parsedInput.data.campId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.campId}`)

  redirect(
    buildCampDetailRedirectPath({
      campId: parsedInput.data.campId,
      status: "goals_updated",
      ...scope,
    }),
  )
}
