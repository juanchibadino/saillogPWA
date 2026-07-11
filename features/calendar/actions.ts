"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  buildCalendarActionRedirectPath,
  canEditCalendarPresence,
  isCalendarDateWithinRange,
  isCalendarTargetInScope,
} from "@/features/calendar/action-rules.mjs"
import { canManageTeamSessions, canManageTeamStructure } from "@/lib/auth/capabilities"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  calendarPresenceInputSchema,
  calendarPresenceRangeInputSchema,
  createCalendarEventInputSchema,
  deleteCalendarEventInputSchema,
  updateCalendarEventInputSchema,
} from "@/lib/validation/calendar"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import type { Database } from "@/types/database"

type CalendarActionScope = {
  eventFilter?: string
  memberId?: string
  returnPath?: string
  scopeOrgId?: string
  scopeTeamId?: string
  timeFilter?: "future" | "all"
}

type CalendarTarget = {
  endDate: string
  startDate: string
  teamId: string
}

type CalendarPresenceSourceType =
  Database["public"]["Enums"]["calendar_presence_source_type"]

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function parseTimeFilter(value: string | undefined): "future" | "all" | undefined {
  return value === "all" ? "all" : value === "future" ? "future" : undefined
}

function getScopeFromFormData(formData: FormData): CalendarActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })
  const returnPath = getFormString(formData, "scopeReturnPath")
  const memberId = getFormString(formData, "scopeMemberId")
  const eventFilter = getFormString(formData, "scopeEvent")
  const timeFilter = parseTimeFilter(getFormString(formData, "scopeTime"))

  if (!parsedScope.success) {
    return {
      eventFilter,
      memberId,
      returnPath,
      timeFilter,
    }
  }

  return {
    ...parsedScope.data,
    eventFilter,
    memberId,
    returnPath,
    timeFilter,
  }
}

function redirectCalendar(input: CalendarActionScope & {
  error?: string
  status?: string
}): never {
  redirect(
    buildCalendarActionRedirectPath({
      eventFilter: input.eventFilter,
      error: input.error,
      memberId: input.memberId,
      returnPath: input.returnPath,
      scopeOrgId: input.scopeOrgId,
      scopeTeamId: input.scopeTeamId,
      status: input.status,
      timeFilter: input.timeFilter,
    }) as string,
  )
}

function revalidateCalendarReturnPath(returnPath: string | undefined): void {
  if (!returnPath || !returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return
  }

  const url = new URL(returnPath, "http://sailog.local")

  if (url.pathname === "/team-calendar") {
    revalidatePath(url.pathname)
  }
}

function enumerateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const currentDate = new Date(`${startDate}T00:00:00.000Z`)
  const lastDate = new Date(`${endDate}T00:00:00.000Z`)

  if (Number.isNaN(currentDate.getTime()) || Number.isNaN(lastDate.getTime())) {
    return dates
  }

  while (currentDate <= lastDate) {
    dates.push(currentDate.toISOString().slice(0, 10))
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return dates
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

async function ensureActiveTeamMembership(input: {
  profileId: string
  teamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id")
    .eq("team_id", input.teamId)
    .eq("profile_id", input.profileId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data)
}

async function resolveCalendarTarget(input: {
  sourceId: string
  sourceType: CalendarPresenceSourceType
}): Promise<CalendarTarget | null> {
  const supabase = await createServerSupabaseClient()

  if (input.sourceType === "event") {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("team_id,start_date,end_date,is_active")
      .eq("id", input.sourceId)
      .maybeSingle()

    if (error || !data || !data.is_active) {
      return null
    }

    return {
      endDate: data.end_date,
      startDate: data.start_date,
      teamId: data.team_id,
    }
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("team_venue_id,start_date,end_date")
    .eq("id", input.sourceId)
    .maybeSingle()

  if (campError || !campRow) {
    return null
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("team_id")
    .eq("id", campRow.team_venue_id)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    return null
  }

  return {
    endDate: campRow.end_date,
    startDate: campRow.start_date,
    teamId: teamVenueRow.team_id,
  }
}

async function assertTeamScope(input: {
  scope: CalendarActionScope
}): Promise<{ organizationId: string; teamId: string } | null> {
  if (!input.scope.scopeOrgId || !input.scope.scopeTeamId) {
    return null
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(input.scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== input.scope.scopeOrgId) {
    return null
  }

  return {
    organizationId: input.scope.scopeOrgId,
    teamId: input.scope.scopeTeamId,
  }
}

async function writePresence(input: {
  actorProfileId: string
  isPresent: boolean
  presenceDates: string[]
  profileId: string
  sourceId: string
  sourceType: CalendarPresenceSourceType
}): Promise<"success" | "failed"> {
  const supabase = await createServerSupabaseClient()
  const sourceColumn =
    input.sourceType === "camp" ? "camp_id" : "calendar_event_id"

  if (input.presenceDates.length === 0) {
    return "success"
  }

  if (!input.isPresent) {
    const { error } = await supabase
      .from("calendar_presence")
      .delete()
      .eq("source_type", input.sourceType)
      .eq(sourceColumn, input.sourceId)
      .eq("profile_id", input.profileId)
      .in("presence_date", input.presenceDates)

    return error ? "failed" : "success"
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("calendar_presence")
    .select("id,presence_date")
    .eq("source_type", input.sourceType)
    .eq(sourceColumn, input.sourceId)
    .eq("profile_id", input.profileId)
    .in("presence_date", input.presenceDates)

  if (existingError) {
    return "failed"
  }

  const existingDates = new Set((existingRows ?? []).map((row) => row.presence_date))
  const existingIds = (existingRows ?? []).map((row) => row.id)
  const missingDates = input.presenceDates.filter((date) => !existingDates.has(date))

  if (existingIds.length > 0) {
    const { error: updateError } = await supabase
      .from("calendar_presence")
      .update({
        updated_by_profile_id: input.actorProfileId,
      })
      .in("id", existingIds)

    if (updateError) {
      return "failed"
    }
  }

  if (missingDates.length === 0) {
    return "success"
  }

  const rows = missingDates.map((presenceDate) => ({
    source_type: input.sourceType,
    camp_id: input.sourceType === "camp" ? input.sourceId : null,
    calendar_event_id: input.sourceType === "event" ? input.sourceId : null,
    profile_id: input.profileId,
    presence_date: presenceDate,
    created_by_profile_id: input.actorProfileId,
    updated_by_profile_id: input.actorProfileId,
  }))

  const { error: insertError } = await supabase.from("calendar_presence").insert(rows)

  return insertError ? "failed" : "success"
}

export async function createCalendarEventAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const teamScope = await assertTeamScope({ scope })
  const parsedInput = createCalendarEventInputSchema.safeParse({
    title: getFormString(formData, "title"),
    eventType: getFormString(formData, "eventType"),
    startDate: getFormString(formData, "startDate"),
    endDate: getFormString(formData, "endDate"),
    notes: getFormString(formData, "notes") ?? "",
  })

  if (!parsedInput.success || !teamScope) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    })
  ) {
    redirectCalendar({ ...scope, error: "forbidden" })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from("calendar_events").insert({
    team_id: teamScope.teamId,
    title: parsedInput.data.title,
    event_type: parsedInput.data.eventType,
    start_date: parsedInput.data.startDate,
    end_date: parsedInput.data.endDate,
    notes: parsedInput.data.notes.length > 0 ? parsedInput.data.notes : null,
    is_active: true,
    created_by_profile_id: context.profile?.id ?? context.user.id,
  })

  if (error) {
    redirectCalendar({ ...scope, error: "event_create_failed" })
  }

  revalidatePath("/team-calendar")
  revalidateCalendarReturnPath(scope.returnPath)
  redirectCalendar({ ...scope, status: "event_created" })
}

export async function updateCalendarEventAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const teamScope = await assertTeamScope({ scope })
  const parsedInput = updateCalendarEventInputSchema.safeParse({
    id: getFormString(formData, "id"),
    title: getFormString(formData, "title"),
    eventType: getFormString(formData, "eventType"),
    startDate: getFormString(formData, "startDate"),
    endDate: getFormString(formData, "endDate"),
    notes: getFormString(formData, "notes") ?? "",
  })

  if (!parsedInput.success || !teamScope) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    })
  ) {
    redirectCalendar({ ...scope, error: "forbidden" })
  }

  const target = await resolveCalendarTarget({
    sourceId: parsedInput.data.id,
    sourceType: "event",
  })

  if (!target || !isCalendarTargetInScope({ targetTeamId: target.teamId, scopeTeamId: teamScope.teamId })) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("calendar_events")
    .update({
      title: parsedInput.data.title,
      event_type: parsedInput.data.eventType,
      start_date: parsedInput.data.startDate,
      end_date: parsedInput.data.endDate,
      notes: parsedInput.data.notes.length > 0 ? parsedInput.data.notes : null,
    })
    .eq("id", parsedInput.data.id)
    .eq("team_id", teamScope.teamId)

  if (error) {
    redirectCalendar({ ...scope, error: "event_update_failed" })
  }

  revalidatePath("/team-calendar")
  revalidateCalendarReturnPath(scope.returnPath)
  redirectCalendar({ ...scope, status: "event_updated" })
}

export async function deleteCalendarEventAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const teamScope = await assertTeamScope({ scope })
  const parsedInput = deleteCalendarEventInputSchema.safeParse({
    id: getFormString(formData, "id"),
  })

  if (!parsedInput.success || !teamScope) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    })
  ) {
    redirectCalendar({ ...scope, error: "forbidden" })
  }

  const target = await resolveCalendarTarget({
    sourceId: parsedInput.data.id,
    sourceType: "event",
  })

  if (!target || !isCalendarTargetInScope({ targetTeamId: target.teamId, scopeTeamId: teamScope.teamId })) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", parsedInput.data.id)
    .eq("team_id", teamScope.teamId)

  if (error) {
    redirectCalendar({ ...scope, error: "event_delete_failed" })
  }

  revalidatePath("/team-calendar")
  revalidateCalendarReturnPath(scope.returnPath)
  redirectCalendar({ ...scope, status: "event_deleted" })
}

export async function setCalendarPresenceAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const actorProfileId = context.profile?.id ?? context.user.id
  const scope = getScopeFromFormData(formData)
  const teamScope = await assertTeamScope({ scope })
  const parsedInput = calendarPresenceInputSchema.safeParse({
    sourceType: getFormString(formData, "sourceType"),
    sourceId: getFormString(formData, "sourceId"),
    profileId: getFormString(formData, "profileId"),
    presenceDate: getFormString(formData, "presenceDate"),
    isPresent: getFormString(formData, "isPresent"),
  })

  if (!parsedInput.success || !teamScope) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const target = await resolveCalendarTarget({
    sourceId: parsedInput.data.sourceId,
    sourceType: parsedInput.data.sourceType,
  })

  if (
    !target ||
    !isCalendarTargetInScope({ targetTeamId: target.teamId, scopeTeamId: teamScope.teamId }) ||
    !isCalendarDateWithinRange({
      date: parsedInput.data.presenceDate,
      startDate: target.startDate,
      endDate: target.endDate,
    })
  ) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const canEdit = canEditCalendarPresence({
    currentProfileId: actorProfileId,
    targetProfileId: parsedInput.data.profileId,
    canManageAnyPresence: canManageTeamStructure({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    }),
  })

  if (!canEdit) {
    redirectCalendar({ ...scope, error: "forbidden" })
  }

  const isActiveMember = await ensureActiveTeamMembership({
    profileId: parsedInput.data.profileId,
    teamId: teamScope.teamId,
  })

  if (!isActiveMember) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const result = await writePresence({
    actorProfileId,
    isPresent: parsedInput.data.isPresent,
    presenceDates: [parsedInput.data.presenceDate],
    profileId: parsedInput.data.profileId,
    sourceId: parsedInput.data.sourceId,
    sourceType: parsedInput.data.sourceType,
  })

  if (result === "failed") {
    redirectCalendar({ ...scope, error: "presence_update_failed" })
  }

  revalidatePath("/team-calendar")
  revalidateCalendarReturnPath(scope.returnPath)
}

export async function setCalendarPresenceRangeAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const actorProfileId = context.profile?.id ?? context.user.id
  const scope = getScopeFromFormData(formData)
  const teamScope = await assertTeamScope({ scope })
  const parsedInput = calendarPresenceRangeInputSchema.safeParse({
    sourceType: getFormString(formData, "sourceType"),
    sourceId: getFormString(formData, "sourceId"),
    profileId: getFormString(formData, "profileId"),
    isPresent: getFormString(formData, "isPresent"),
  })

  if (!parsedInput.success || !teamScope) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const target = await resolveCalendarTarget({
    sourceId: parsedInput.data.sourceId,
    sourceType: parsedInput.data.sourceType,
  })

  if (
    !target ||
    !isCalendarTargetInScope({ targetTeamId: target.teamId, scopeTeamId: teamScope.teamId })
  ) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const canEdit = canEditCalendarPresence({
    currentProfileId: actorProfileId,
    targetProfileId: parsedInput.data.profileId,
    canManageAnyPresence: canManageTeamStructure({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    }),
  })

  if (!canEdit) {
    redirectCalendar({ ...scope, error: "forbidden" })
  }

  const isActiveMember = await ensureActiveTeamMembership({
    profileId: parsedInput.data.profileId,
    teamId: teamScope.teamId,
  })

  if (!isActiveMember) {
    redirectCalendar({ ...scope, error: "invalid_input" })
  }

  const result = await writePresence({
    actorProfileId,
    isPresent: parsedInput.data.isPresent,
    presenceDates: enumerateDateRange(target.startDate, target.endDate),
    profileId: parsedInput.data.profileId,
    sourceId: parsedInput.data.sourceId,
    sourceType: parsedInput.data.sourceType,
  })

  if (result === "failed") {
    redirectCalendar({ ...scope, error: "presence_update_failed" })
  }

  revalidatePath("/team-calendar")
  revalidateCalendarReturnPath(scope.returnPath)
}
