import { NextResponse } from "next/server"

import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const teamVenueId = resolvedParams.id?.trim()

  if (!teamVenueId) {
    return NextResponse.json({ name: null }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ name: null }, { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const activeOrgId = requestUrl.searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)

  const { data: teamVenue } = await supabase
    .from("team_venues")
    .select("venue_id")
    .eq("id", teamVenueId)
    .maybeSingle()

  if (!teamVenue) {
    return NextResponse.json({
      name: null,
    })
  }

  let query = supabase.from("venues").select("name").eq("id", teamVenue.venue_id)

  if (activeOrgId) {
    query = query.eq("organization_id", activeOrgId)
  }

  const { data: venue } = await query.maybeSingle()

  return NextResponse.json({
    name: venue?.name ?? null,
  })
}
