"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canDeleteCamps, canManageTeamStructure } from "@/lib/auth/capabilities"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import { getOptionalAppUrlOrigin } from "@/lib/supabase/env"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import type { Database } from "@/types/database"
import {
  createCampInputSchema,
  deleteCampInputSchema,
  updateCampGoalsInputSchema,
  updateCampInputSchema,
} from "@/lib/validation/camps"
import {
  buildCampDetailRedirectPath,
  buildTeamCampsRedirectPath,
  resolveCampGoalsActionRedirect,
} from "@/features/camps/detail-route-state.mjs"
import {
  logCampDetailTiming,
  startCampDetailTiming,
  type CampDetailTimingStatus,
} from "@/features/camps/detail-timing"
import {
  formatActorName,
  NOTIFICATION_EVENT_TYPES,
  shouldNotifyTextAdded,
} from "@/features/notifications/core.mjs"
import {
  buildCampGoalCrewRecipients,
  buildCampGoalNotificationRows,
  buildCampGoalPushPayload,
  buildCampGoalTargetHref,
} from "@/features/notifications/camp-goal-core.mjs"
import { sendCampGoalEmailNotifications } from "@/features/notifications/email"
import { sendWebPushNotifications } from "@/features/notifications/push"

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
  returnPath?: string
  scopeCampStatus?: "active" | "inactive"
  scopeCampType?: "training" | "regatta" | "mixed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeTab?: string
  scopePage?: number
}

type CampGoalNotificationActionResult = {
  emailSentCount: number
  notifiedCount: number
  ok: boolean
  pushSentCount: number
}

type CampGoalCrewMembershipRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "is_active" | "profile_id" | "role"
>

type CampGoalCrewProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "email" | "email_notifications_enabled" | "first_name" | "id" | "is_active" | "last_name"
>

type CampGoalExistingNotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "event_type" | "metadata" | "recipient_profile_id"
>

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
  returnPath?: string
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
  const returnPath = getFormString(formData, "scopeReturnPath")

  if (!parsedScope.success) {
    return {
      returnPath,
      scopeVenueId,
      scopeCampType,
      scopeCampStatus,
      scopeTab,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    returnPath,
    scopeVenueId,
    scopeCampType,
    scopeCampStatus,
    scopeTab,
    scopePage,
  }
}

function normalizeCampActionReturnPath(value: string | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  const url = new URL(value, "http://sailog.local")

  if (
    url.pathname !== "/team-camps" &&
    !url.pathname.startsWith("/team-camps/") &&
    !url.pathname.startsWith("/venues/")
  ) {
    return null
  }

  return `${url.pathname}${url.search}`
}

function buildCampActionRedirectPath(
  input: CampActionScope & {
    cacheCampId?: string | null
    cacheTeamVenueId?: string | null
    error?: string
    status?: string
  },
): string {
  const returnPath = normalizeCampActionReturnPath(input.returnPath)

  if (!returnPath) {
    return buildTeamCampsRedirectPath(input)
  }

  const url = new URL(returnPath, "http://sailog.local")
  const params = url.searchParams

  params.delete("status")
  params.delete("error")
  params.delete("cacheCamp")
  params.delete("cacheTeamVenue")

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  if (input.cacheCampId) {
    params.set("cacheCamp", input.cacheCampId)
  }

  if (input.cacheTeamVenueId) {
    params.set("cacheTeamVenue", input.cacheTeamVenueId)
  }

  const query = params.toString()
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname
}

function revalidateCampActionReturnPath(returnPath: string | undefined): void {
  const normalizedReturnPath = normalizeCampActionReturnPath(returnPath)

  if (!normalizedReturnPath) {
    return
  }

  const url = new URL(normalizedReturnPath, "http://sailog.local")
  revalidatePath(url.pathname)
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

function buildAbsoluteAppUrl(href: string): string {
  try {
    const origin = getOptionalAppUrlOrigin()
    return origin ? `${origin}${href}` : href
  } catch {
    return href
  }
}

async function loadCampGoalNotificationRows(input: {
  actorName: string
  actorProfileId: string
  campId: string
  orgId: string
  teamId: string
}): Promise<{
  campName: string
  recipients: ReturnType<typeof buildCampGoalCrewRecipients>
  rows: ReturnType<typeof buildCampGoalNotificationRows>
} | null> {
  const adminSupabase = createAdminSupabaseClient()
  const { data: campRow, error: campError } = await adminSupabase
    .from("camps")
    .select("id,name,notes")
    .eq("id", input.campId)
    .maybeSingle()

  if (campError || !campRow || !campRow.notes?.trim()) {
    return null
  }

  const { data: membershipRows, error: membershipError } = await adminSupabase
    .from("team_memberships")
    .select("profile_id,role,is_active")
    .eq("team_id", input.teamId)
    .eq("role", "crew")
    .eq("is_active", true)

  if (membershipError) {
    console.warn("Failed to load Camp Goal notification crew recipients", membershipError)
    return null
  }

  const memberships: CampGoalCrewMembershipRow[] = membershipRows ?? []
  const profileIds = [...new Set(memberships.map((membership) => membership.profile_id))]

  if (profileIds.length === 0) {
    return {
      campName: campRow.name.trim().length > 0 ? campRow.name : "this camp",
      recipients: [],
      rows: [],
    }
  }

  const { data: profileRows, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id,first_name,last_name,email,is_active,email_notifications_enabled")
    .in("id", profileIds)

  if (profileError) {
    console.warn("Failed to load Camp Goal notification profiles", profileError)
    return null
  }

  const profiles: CampGoalCrewProfileRow[] = profileRows ?? []
  const recipients = buildCampGoalCrewRecipients({
    actorProfileId: input.actorProfileId,
    memberships,
    profiles,
  })

  if (recipients.length === 0) {
    return {
      campName: campRow.name.trim().length > 0 ? campRow.name : "this camp",
      recipients,
      rows: [],
    }
  }

  const { data: existingRows, error: existingRowsError } = await adminSupabase
    .from("notifications")
    .select("recipient_profile_id,event_type,metadata")
    .eq("team_id", input.teamId)
    .eq("event_type", NOTIFICATION_EVENT_TYPES.CAMP_GOALS_ADDED)
    .in(
      "recipient_profile_id",
      recipients.map((recipient) => recipient.profileId),
    )

  if (existingRowsError) {
    console.warn("Failed to load existing Camp Goal notifications", existingRowsError)
    return null
  }

  const campName = campRow.name.trim().length > 0 ? campRow.name : "this camp"
  const existingNotifications: CampGoalExistingNotificationRow[] = existingRows ?? []

  return {
    campName,
    recipients,
    rows: buildCampGoalNotificationRows({
      actorName: input.actorName,
      actorProfileId: input.actorProfileId,
      campId: input.campId,
      campName,
      existingRows: existingNotifications,
      orgId: input.orgId,
      recipients,
      teamId: input.teamId,
    }),
  }
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: createdCamp, error: insertError } = await supabase
    .from("camps")
    .insert({
      team_venue_id: parsedInput.data.teamVenueId,
      name: parsedInput.data.name,
      camp_type: parsedInput.data.campType,
      start_date: parsedInput.data.startDate,
      end_date: parsedInput.data.endDate,
      is_active: true,
    })
    .select("id")
    .single()

  if (insertError) {
    redirect(
      buildCampActionRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  if (!createdCamp?.id) {
    redirect(
      buildCampActionRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${createdCamp.id}`)
  revalidatePath("/team-sessions")
  revalidateCampActionReturnPath(scope.returnPath)

  redirect(
    buildCampDetailRedirectPath({
      campId: createdCamp.id,
      status: "camp_created",
      cacheCampId: createdCamp.id,
      cacheTeamVenueId: parsedInput.data.teamVenueId,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
      scopeTab: "sessions",
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.id}`)
  revalidatePath("/team-sessions")
  revalidateCampActionReturnPath(scope.returnPath)

  redirect(
    buildCampActionRedirectPath({
      status: "updated",
      cacheCampId: parsedInput.data.id,
      cacheTeamVenueId: parsedInput.data.teamVenueId,
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
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
      buildCampActionRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: cacheCampRow } = await supabase
    .from("camps")
    .select("team_venue_id")
    .eq("id", parsedInput.data.id)
    .maybeSingle()
  const { error: deleteError } = await supabase
    .from("camps")
    .delete()
    .eq("id", parsedInput.data.id)

  if (deleteError) {
    redirect(
      buildCampActionRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-camps")
  revalidatePath(`/team-camps/${parsedInput.data.id}`)
  revalidatePath("/team-sessions")
  revalidateCampActionReturnPath(scope.returnPath)

  redirect(
    buildCampActionRedirectPath({
      status: "deleted",
      cacheCampId: parsedInput.data.id,
      cacheTeamVenueId: cacheCampRow?.team_venue_id ?? null,
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
  const { data: campNotificationRow, error: campNotificationError } = await supabase
    .from("camps")
    .select("name,notes")
    .eq("id", parsedInput.data.campId)
    .maybeSingle()

  if (campNotificationError) {
    console.error("Failed to load camp notification state", campNotificationError)
  }

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

  const shouldPromptForNotification =
    campNotificationRow &&
    shouldNotifyTextAdded(campNotificationRow.notes, normalizedGoals)

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
      notifyCampGoals: shouldPromptForNotification,
      ...scope,
    }),
  )
}

export async function confirmCampGoalsNotificationAction(
  formData: FormData,
): Promise<CampGoalNotificationActionResult> {
  const startedAt = startCampDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const campId = getFormString(formData, "campId")
  const notifyEmail = getBooleanField(formData, "notifyEmail")
  const notifyPush = getBooleanField(formData, "notifyPush")

  const baseResult: CampGoalNotificationActionResult = {
    emailSentCount: 0,
    notifiedCount: 0,
    ok: false,
    pushSentCount: 0,
  }

  if (!campId || !scope.scopeOrgId || !scope.scopeTeamId) {
    logCampActionTiming({
      phase: "confirm_camp_goals_notification",
      startedAt,
      scope,
      campId,
      status: "error",
      outcome: "missing_required",
    })
    return baseResult
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    logCampActionTiming({
      phase: "confirm_camp_goals_notification",
      startedAt,
      scope,
      campId,
      status: "error",
      outcome: "forbidden",
    })
    return baseResult
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    logCampActionTiming({
      phase: "confirm_camp_goals_notification",
      startedAt,
      scope,
      campId,
      status: "error",
      outcome: "missing_camp",
    })
    return baseResult
  }

  const actorName = formatActorName({
    firstName: context.profile?.first_name,
    lastName: context.profile?.last_name,
    email: context.user.email ?? null,
  })
  const notificationContext = await loadCampGoalNotificationRows({
    actorName,
    actorProfileId: context.user.id,
    campId,
    orgId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })

  if (!notificationContext || notificationContext.rows.length === 0) {
    logCampActionTiming({
      phase: "confirm_camp_goals_notification",
      startedAt,
      scope,
      campId,
      status: "success",
      outcome: "nothing_to_send",
    })
    return {
      ...baseResult,
      ok: true,
    }
  }

  const adminSupabase = createAdminSupabaseClient()
  const { error: insertError } = await adminSupabase
    .from("notifications")
    .insert(notificationContext.rows)

  if (insertError) {
    console.warn("Failed to create Camp Goal crew notifications", insertError)
    logCampActionTiming({
      phase: "confirm_camp_goals_notification",
      startedAt,
      scope,
      campId,
      status: "error",
      outcome: "insert_failed",
      error: insertError.message,
    })
    return baseResult
  }

  const notifiedRecipientIds = new Set(
    notificationContext.rows.map((row) => row.recipient_profile_id),
  )
  const deliveryRecipients = notificationContext.recipients.filter((recipient) =>
    notifiedRecipientIds.has(recipient.profileId),
  )
  const firstNotificationRow = notificationContext.rows[0]
  const targetHref =
    firstNotificationRow?.target_href ??
    buildCampGoalTargetHref({
      campId,
      orgId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  const message = firstNotificationRow?.message ?? ""
  let emailSentCount = 0
  let pushSentCount = 0

  if (notifyEmail) {
    emailSentCount = await sendCampGoalEmailNotifications({
      actorName,
      campName: notificationContext.campName,
      message,
      recipients: deliveryRecipients,
      targetHref,
      targetUrl: buildAbsoluteAppUrl(targetHref),
    })
  }

  if (notifyPush && deliveryRecipients.length > 0) {
    const { data: subscriptions, error: subscriptionsError } = await adminSupabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .in(
        "profile_id",
        deliveryRecipients.map((recipient) => recipient.profileId),
      )

    if (subscriptionsError) {
      console.warn("Failed to load Camp Goal push subscriptions", subscriptionsError)
    } else {
      const pushResult = await sendWebPushNotifications({
        payload: buildCampGoalPushPayload({
          campId,
          message,
          targetHref,
        }),
        subscriptions: subscriptions ?? [],
      })

      pushSentCount = pushResult.sentCount

      if (pushResult.staleEndpoints.length > 0) {
        const { error: deleteError } = await adminSupabase
          .from("push_subscriptions")
          .delete()
          .in("endpoint", pushResult.staleEndpoints)

        if (deleteError) {
          console.warn("Failed to delete stale push subscriptions", deleteError)
        }
      }
    }
  }

  revalidatePath("/", "layout")
  revalidatePath("/notifications")

  logCampActionTiming({
    phase: "confirm_camp_goals_notification",
    startedAt,
    scope,
    campId,
    status: "success",
    outcome: "sent",
    metadata: {
      emailSentCount,
      notifiedCount: deliveryRecipients.length,
      pushSentCount,
    },
  })

  return {
    emailSentCount,
    notifiedCount: deliveryRecipients.length,
    ok: true,
    pushSentCount,
  }
}
