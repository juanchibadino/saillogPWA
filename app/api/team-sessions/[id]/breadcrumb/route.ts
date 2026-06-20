import { NextResponse } from "next/server"

import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type SessionBreadcrumbPayload = {
  team_name: string | null
  venue_id: string | null
  venue_name: string | null
  camp_id: string | null
  camp_name: string | null
  session_date: string | null
  dock_out_at: string | null
}

type RouteContext = {
  params: Promise<{ id: string }>
}

const emptySessionBreadcrumbPayload: SessionBreadcrumbPayload = {
  team_name: null,
  venue_id: null,
  venue_name: null,
  camp_id: null,
  camp_name: null,
  session_date: null,
  dock_out_at: null,
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const sessionId = resolvedParams.id?.trim()

  if (!sessionId) {
    return NextResponse.json(emptySessionBreadcrumbPayload, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(emptySessionBreadcrumbPayload, { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const activeOrgId = requestUrl.searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)
  const activeTeamId = requestUrl.searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id,camp_id,session_date,dock_out_at")
    .eq("id", sessionId)
    .maybeSingle()

  if (sessionError || !sessionRow) {
    return NextResponse.json(emptySessionBreadcrumbPayload)
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,name,team_venue_id")
    .eq("id", sessionRow.camp_id)
    .maybeSingle()

  if (campError || !campRow) {
    return NextResponse.json(emptySessionBreadcrumbPayload)
  }

  let teamVenueQuery = supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", campRow.team_venue_id)

  if (activeTeamId) {
    teamVenueQuery = teamVenueQuery.eq("team_id", activeTeamId)
  }

  const { data: teamVenueRow, error: teamVenueError } = await teamVenueQuery.maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    return NextResponse.json(emptySessionBreadcrumbPayload)
  }

  const [{ data: teamRow, error: teamError }, { data: venueRow, error: venueError }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id,name,organization_id")
        .eq("id", teamVenueRow.team_id)
        .maybeSingle(),
      (() => {
        let query = supabase
          .from("venues")
          .select("id,name,organization_id")
          .eq("id", teamVenueRow.venue_id)

        if (activeOrgId) {
          query = query.eq("organization_id", activeOrgId)
        }

        return query.maybeSingle()
      })(),
    ])

  if (teamError || venueError || !teamRow || !venueRow) {
    return NextResponse.json(emptySessionBreadcrumbPayload)
  }

  if (activeOrgId && teamRow.organization_id !== activeOrgId) {
    return NextResponse.json(emptySessionBreadcrumbPayload)
  }

  return NextResponse.json({
    team_name: teamRow.name ?? null,
    venue_id: venueRow.id ?? null,
    venue_name: venueRow.name ?? null,
    camp_id: campRow.id ?? null,
    camp_name: campRow.name ?? null,
    session_date: sessionRow.session_date ?? null,
    dock_out_at: sessionRow.dock_out_at ?? null,
  })
}
