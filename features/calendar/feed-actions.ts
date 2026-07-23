"use server"

import { randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"

import {
  buildTeamCalendarFeedUrl,
  resolveTeamCalendarFeedMutation,
} from "@/features/calendar/feed-core.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import { resolveCurrentRequestOrigin } from "@/lib/http/request-origin"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type CalendarFeedActionScope = {
  eventFilter?: string
  memberId?: string
  returnPath?: string
  scopeOrgId?: string
  scopeTeamId?: string
  timeFilter?: "future" | "all"
}

type ActiveCalendarFeedRow = Pick<
  Database["public"]["Tables"]["team_calendar_feeds"]["Row"],
  "created_at" | "id" | "is_active" | "token" | "updated_at"
>

type TeamCalendarFeedActionState = {
  createdAt: string | null
  downloadUrl: string | null
  feedUrl: string | null
  updatedAt: string | null
}

export type TeamCalendarFeedActionResult = {
  feedState: TeamCalendarFeedActionState | null
  message: string
  ok: boolean
}

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

function getScopeFromFormData(formData: FormData): CalendarFeedActionScope {
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

function createFeedToken(): string {
  return randomBytes(32).toString("base64url")
}

function buildFeedActionError(message: string): TeamCalendarFeedActionResult {
  return {
    feedState: null,
    message,
    ok: false,
  }
}

async function buildFeedActionSuccess(input: {
  feed: {
    created_at: string | null
    token: string
    updated_at: string | null
  }
  message: string
}): Promise<TeamCalendarFeedActionResult> {
  const origin = await resolveCurrentRequestOrigin()

  return {
    feedState: {
      createdAt: input.feed.created_at,
      downloadUrl: buildTeamCalendarFeedUrl({
        download: true,
        origin,
        token: input.feed.token,
      }),
      feedUrl: buildTeamCalendarFeedUrl({
        origin,
        token: input.feed.token,
      }),
      updatedAt: input.feed.updated_at,
    },
    message: input.message,
    ok: true,
  }
}

async function resolveTeamOrganizationId(teamId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", teamId)
    .maybeSingle()

  if (error) {
    return null
  }

  return data?.organization_id ?? null
}

async function assertTeamScope(input: {
  scope: CalendarFeedActionScope
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

async function getActiveFeed(teamId: string): Promise<ActiveCalendarFeedRow | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("team_calendar_feeds")
    .select("id,is_active,token,created_at,updated_at")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    return null
  }

  return data
}

async function insertFeed(input: {
  actorProfileId: string
  teamId: string
  token: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from("team_calendar_feeds").insert({
    team_id: input.teamId,
    token: input.token,
    is_active: true,
    created_by_profile_id: input.actorProfileId,
  })

  return !error
}

async function deactivateFeed(input: {
  actorProfileId: string
  feedId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("team_calendar_feeds")
    .update({
      is_active: false,
      rotated_at: new Date().toISOString(),
      rotated_by_profile_id: input.actorProfileId,
    })
    .eq("id", input.feedId)
    .eq("is_active", true)

  return !error
}

async function reactivateFeed(feedId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from("team_calendar_feeds")
    .update({
      is_active: true,
      rotated_at: null,
      rotated_by_profile_id: null,
    })
    .eq("id", feedId)
}

async function assertCanManageCalendarFeed(input: {
  scope: CalendarFeedActionScope
}) {
  const context = await requireAuthenticatedAccessContext()
  const teamScope = await assertTeamScope({ scope: input.scope })

  if (!teamScope) {
    return null
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: teamScope.organizationId,
      teamId: teamScope.teamId,
    })
  ) {
    return null
  }

  return {
    actorProfileId: context.profile?.id ?? context.user.id,
    teamScope,
  }
}

export async function generateTeamCalendarFeedAction(
  _previousState: TeamCalendarFeedActionResult | null,
  formData: FormData,
): Promise<TeamCalendarFeedActionResult> {
  const scope = getScopeFromFormData(formData)
  const access = await assertCanManageCalendarFeed({ scope })

  if (!access) {
    return buildFeedActionError(
      "You do not have permission to manage the calendar export link.",
    )
  }

  const existingFeed = await getActiveFeed(access.teamScope.teamId)
  const mutation = resolveTeamCalendarFeedMutation({
    actorProfileId: access.actorProfileId,
    existingFeed: existingFeed
      ? {
          id: existingFeed.id,
          isActive: existingFeed.is_active,
          token: existingFeed.token,
        }
      : null,
    mode: "ensure",
    nextToken: createFeedToken(),
    teamId: access.teamScope.teamId,
  })

  if (mutation.type === "reuse") {
    if (!existingFeed) {
      return buildFeedActionError("Could not generate the calendar export link.")
    }

    return buildFeedActionSuccess({
      feed: existingFeed,
      message: "Calendar link is ready.",
    })
  }

  if (!mutation.nextFeed) {
    return buildFeedActionError("Could not generate the calendar export link.")
  }

  const inserted = await insertFeed({
    actorProfileId: access.actorProfileId,
    teamId: access.teamScope.teamId,
    token: mutation.nextFeed.token,
  })

  if (!inserted) {
    const fallbackFeed = await getActiveFeed(access.teamScope.teamId)

    if (!fallbackFeed) {
      return buildFeedActionError("Could not generate the calendar export link.")
    }

    return buildFeedActionSuccess({
      feed: fallbackFeed,
      message: "Calendar link is ready.",
    })
  }

  revalidatePath("/team-calendar")
  return buildFeedActionSuccess({
    feed: {
      created_at: null,
      token: mutation.nextFeed.token,
      updated_at: null,
    },
    message: "Calendar link is ready.",
  })
}

export async function rotateTeamCalendarFeedAction(
  _previousState: TeamCalendarFeedActionResult | null,
  formData: FormData,
): Promise<TeamCalendarFeedActionResult> {
  const scope = getScopeFromFormData(formData)
  const access = await assertCanManageCalendarFeed({ scope })

  if (!access) {
    return buildFeedActionError(
      "You do not have permission to manage the calendar export link.",
    )
  }

  const existingFeed = await getActiveFeed(access.teamScope.teamId)
  const mutation = resolveTeamCalendarFeedMutation({
    actorProfileId: access.actorProfileId,
    existingFeed: existingFeed
      ? {
          id: existingFeed.id,
          isActive: existingFeed.is_active,
          token: existingFeed.token,
        }
      : null,
    mode: "rotate",
    nextToken: createFeedToken(),
    teamId: access.teamScope.teamId,
  })

  if (mutation.type === "create") {
    if (!mutation.nextFeed) {
      return buildFeedActionError("Could not generate the calendar export link.")
    }

    const inserted = await insertFeed({
      actorProfileId: access.actorProfileId,
      teamId: access.teamScope.teamId,
      token: mutation.nextFeed.token,
    })

    if (!inserted) {
      return buildFeedActionError("Could not generate the calendar export link.")
    }

    revalidatePath("/team-calendar")
    return buildFeedActionSuccess({
      feed: {
        created_at: null,
        token: mutation.nextFeed.token,
        updated_at: null,
      },
      message: "Calendar link is ready.",
    })
  }

  if (mutation.type === "reuse") {
    if (!existingFeed) {
      return buildFeedActionError("Could not generate the calendar export link.")
    }

    return buildFeedActionSuccess({
      feed: existingFeed,
      message: "Calendar link is ready.",
    })
  }

  if (
    mutation.type !== "rotate" ||
    !mutation.deactivateFeedId ||
    !mutation.nextFeed
  ) {
    return buildFeedActionError("Could not regenerate the calendar export link.")
  }

  const deactivated = await deactivateFeed({
    actorProfileId: access.actorProfileId,
    feedId: mutation.deactivateFeedId,
  })

  if (!deactivated) {
    return buildFeedActionError("Could not regenerate the calendar export link.")
  }

  const inserted = await insertFeed({
    actorProfileId: access.actorProfileId,
    teamId: access.teamScope.teamId,
    token: mutation.nextFeed.token,
  })

  if (!inserted) {
    await reactivateFeed(mutation.deactivateFeedId)
    return buildFeedActionError("Could not regenerate the calendar export link.")
  }

  revalidatePath("/team-calendar")
  return buildFeedActionSuccess({
    feed: {
      created_at: null,
      token: mutation.nextFeed.token,
      updated_at: null,
    },
    message: "Calendar link regenerated.",
  })
}
