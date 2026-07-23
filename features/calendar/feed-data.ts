import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getTeamCalendarSources, type TeamCalendarSource } from "@/features/calendar/data"
import {
  buildTeamCalendarFeedUrl,
  normalizeCalendarFeedToken,
} from "@/features/calendar/feed-core.mjs"
import { buildTeamCalendarIcs } from "@/features/calendar/ical-core.mjs"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type ServerSupabaseClient = SupabaseClient<Database>
type TeamCalendarFeedRow = Pick<
  Database["public"]["Tables"]["team_calendar_feeds"]["Row"],
  "id" | "team_id" | "token" | "created_at" | "updated_at"
>
type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "organization_id" | "name" | "is_active"
>

export type TeamCalendarFeedState = {
  createdAt: string | null
  downloadUrl: string | null
  feedUrl: string | null
  updatedAt: string | null
}

export type TeamCalendarFeedRouteData = {
  calendarName: string
  fileName: string
  ics: string
}

function buildEmptyFeedState(): TeamCalendarFeedState {
  return {
    createdAt: null,
    downloadUrl: null,
    feedUrl: null,
    updatedAt: null,
  }
}

function buildTeamCalendarEventUrl(input: {
  origin: string
  organizationId: string
  source: TeamCalendarSource
  teamId: string
}): string {
  const params = new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: input.organizationId,
    [NAVIGATION_SCOPE_TEAM_QUERY_KEY]: input.teamId,
    event: `${input.source.sourceType}:${input.source.id}`,
    time: "all",
  })

  return new URL(`/team-calendar?${params.toString()}`, input.origin).toString()
}

function toIcsEvent(input: {
  organizationId: string
  origin: string
  source: TeamCalendarSource
  teamId: string
}) {
  return {
    id: input.source.id,
    sourceType: input.source.sourceType,
    title: input.source.title,
    eventType: input.source.eventType,
    startDate: input.source.startDate,
    endDate: input.source.endDate,
    venueName: input.source.venueName,
    notes: input.source.notes,
    createdAt: input.source.createdAt,
    updatedAt: input.source.updatedAt,
    url: buildTeamCalendarEventUrl(input),
  }
}

function buildCalendarFileName(teamName: string): string {
  const slug = teamName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${slug || "team"}-calendar.ics`
}

async function getTeamById(input: {
  supabase: ServerSupabaseClient
  teamId: string
}): Promise<TeamRow | null> {
  const { data, error } = await input.supabase
    .from("teams")
    .select("id,organization_id,name,is_active")
    .eq("id", input.teamId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

export async function getTeamCalendarFeedState(input: {
  origin: string
  supabase?: ServerSupabaseClient
  teamId: string
}): Promise<TeamCalendarFeedState> {
  const supabase = input.supabase ?? (await createServerSupabaseClient())
  const { data, error } = await supabase
    .from("team_calendar_feeds")
    .select("id,team_id,token,created_at,updated_at")
    .eq("team_id", input.teamId)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) {
    return buildEmptyFeedState()
  }

  const feedUrl = buildTeamCalendarFeedUrl({
    origin: input.origin,
    token: data.token,
  })
  const downloadUrl = buildTeamCalendarFeedUrl({
    download: true,
    origin: input.origin,
    token: data.token,
  })

  return {
    createdAt: data.created_at,
    downloadUrl,
    feedUrl,
    updatedAt: data.updated_at,
  }
}

export async function getTeamCalendarFeedRouteData(input: {
  origin: string
  rawToken: string
}): Promise<TeamCalendarFeedRouteData | null> {
  const token = normalizeCalendarFeedToken(input.rawToken)

  if (!token) {
    return null
  }

  const adminSupabase = createAdminSupabaseClient()
  const { data: feedRow, error: feedError } = await adminSupabase
    .from("team_calendar_feeds")
    .select("id,team_id,token,created_at,updated_at")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle()

  if (feedError || !feedRow) {
    return null
  }

  const feed = feedRow as TeamCalendarFeedRow
  const team = await getTeamById({
    supabase: adminSupabase,
    teamId: feed.team_id,
  })

  if (!team || !team.is_active) {
    return null
  }

  const sources = await getTeamCalendarSources(feed.team_id, adminSupabase)
  const events = sources.map((source) =>
    toIcsEvent({
      organizationId: team.organization_id,
      origin: input.origin,
      source,
      teamId: feed.team_id,
    }),
  )
  const calendarName = `${team.name} Calendar`

  return {
    calendarName,
    fileName: buildCalendarFileName(team.name),
    ics: buildTeamCalendarIcs({
      calendarName,
      events,
      generatedAt: new Date(),
    }),
  }
}
