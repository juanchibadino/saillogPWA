"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { canManageTeamSessions } from "@/lib/auth/capabilities"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import {
  buildTeamSessionsRedirectPath,
  resolveHighlightFilter,
} from "@/features/sessions/list-route-state.mjs"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createSessionInputSchema,
  deleteSessionInputSchema,
  updateSessionInputSchema,
} from "@/lib/validation/sessions"

type SessionListActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeCampId?: string
  scopeHighlight?: "yes" | "no"
  scopePage?: number
}

type SessionAssetStorageReference = {
  bucket: string
  storage_path: string
  thumbnail_bucket: string | null
  thumbnail_storage_path: string | null
}

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

function getOptionalIntegerField(formData: FormData, key: string): number | undefined {
  const value = getFormString(formData, key)

  if (!value) {
    return undefined
  }

  const normalized = value.trim()

  if (normalized.length === 0) {
    return undefined
  }

  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
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

function getScopeFromFormData(formData: FormData): SessionListActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const scopeVenueId = getFormString(formData, "scopeVenueId")
  const scopeCampId = getFormString(formData, "scopeCampId")
  const scopeHighlight = resolveHighlightFilter(
    getFormString(formData, "scopeHighlight"),
  )
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeVenueId,
      scopeCampId,
      scopeHighlight,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
    scopeCampId,
    scopeHighlight,
    scopePage,
  }
}

async function ensureCampBelongsToScope(input: {
  campId: string
  scopeOrgId: string
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
    .select("id,venue_id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    return false
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", teamVenueRow.venue_id)
    .eq("organization_id", input.scopeOrgId)
    .maybeSingle()

  if (venueError) {
    return false
  }

  return Boolean(venueRow)
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

async function ensureSessionBelongsToScope(input: {
  sessionId: string
  scopeOrgId: string
  scopeTeamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id,camp_id")
    .eq("id", input.sessionId)
    .maybeSingle()

  if (sessionError || !sessionRow) {
    return false
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", sessionRow.camp_id)
    .maybeSingle()

  if (campError || !campRow) {
    return false
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,venue_id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    return false
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", teamVenueRow.venue_id)
    .eq("organization_id", input.scopeOrgId)
    .maybeSingle()

  if (venueError) {
    return false
  }

  return Boolean(venueRow)
}

async function removeSessionStorageObjects(
  assetRows: SessionAssetStorageReference[],
): Promise<void> {
  if (assetRows.length === 0) {
    return
  }

  const pathsByBucket = new Map<string, Set<string>>()

  for (const assetRow of assetRows) {
    if (!pathsByBucket.has(assetRow.bucket)) {
      pathsByBucket.set(assetRow.bucket, new Set())
    }

    pathsByBucket.get(assetRow.bucket)?.add(assetRow.storage_path)

    if (assetRow.thumbnail_bucket && assetRow.thumbnail_storage_path) {
      if (!pathsByBucket.has(assetRow.thumbnail_bucket)) {
        pathsByBucket.set(assetRow.thumbnail_bucket, new Set())
      }

      pathsByBucket
        .get(assetRow.thumbnail_bucket)
        ?.add(assetRow.thumbnail_storage_path)
    }
  }

  let storageAdmin: ReturnType<typeof createAdminSupabaseClient>

  try {
    storageAdmin = createAdminSupabaseClient()
  } catch {
    return
  }

  for (const [bucket, pathSet] of pathsByBucket) {
    const paths = [...pathSet]

    if (paths.length === 0) {
      continue
    }

    try {
      await storageAdmin.storage.from(bucket).remove(paths)
    } catch {
      // Session row deletion has already succeeded; storage cleanup is best-effort.
    }
  }
}

export async function createSessionAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = createSessionInputSchema.safeParse({
    campId: getFormString(formData, "campId"),
    sessionType: getFormString(formData, "sessionType"),
    sessionDate: getFormString(formData, "sessionDate"),
    netTimeMinutes: getOptionalIntegerField(formData, "netTimeMinutes"),
    highlightedByCoach: getBooleanField(formData, "highlightedByCoach"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: resolvedOrganizationId,
    resource: "sessions",
  })

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: insertError } = await supabase.from("sessions").insert({
    camp_id: parsedInput.data.campId,
    session_type: parsedInput.data.sessionType,
    session_date: parsedInput.data.sessionDate,
    net_time_minutes: parsedInput.data.netTimeMinutes ?? null,
    highlighted_by_coach: parsedInput.data.highlightedByCoach,
  })

  if (insertError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-home")

  redirect(
    buildTeamSessionsRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateSessionAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = updateSessionInputSchema.safeParse({
    id: getFormString(formData, "id"),
    campId: getFormString(formData, "campId"),
    sessionType: getFormString(formData, "sessionType"),
    sessionDate: getFormString(formData, "sessionDate"),
    netTimeMinutes: getOptionalIntegerField(formData, "netTimeMinutes"),
    highlightedByCoach: getBooleanField(formData, "highlightedByCoach"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const sessionBelongsToScope = await ensureSessionBelongsToScope({
    sessionId: parsedInput.data.id,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!sessionBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      camp_id: parsedInput.data.campId,
      session_type: parsedInput.data.sessionType,
      session_date: parsedInput.data.sessionDate,
      net_time_minutes: parsedInput.data.netTimeMinutes ?? null,
      highlighted_by_coach: parsedInput.data.highlightedByCoach,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-home")

  redirect(
    buildTeamSessionsRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = deleteSessionInputSchema.safeParse({
    id: getFormString(formData, "id"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const sessionBelongsToScope = await ensureSessionBelongsToScope({
    sessionId: parsedInput.data.id,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!sessionBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: assetRows, error: assetRowsError } = await supabase
    .from("session_assets")
    .select("bucket,storage_path,thumbnail_bucket,thumbnail_storage_path")
    .eq("session_id", parsedInput.data.id)

  if (assetRowsError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  const { error: deleteError } = await supabase
    .from("sessions")
    .delete()
    .eq("id", parsedInput.data.id)

  if (deleteError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  await removeSessionStorageObjects(assetRows ?? [])

  revalidatePath("/team-sessions")
  revalidatePath(`/team-sessions/${parsedInput.data.id}`)
  revalidatePath("/team-camps")
  revalidatePath("/team-home")

  redirect(
    buildTeamSessionsRedirectPath({
      status: "deleted",
      ...scope,
    }),
  )
}
