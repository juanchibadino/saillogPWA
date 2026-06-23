import { NextResponse } from "next/server"

import {
  logSessionDetailTiming,
  startSessionDetailTiming,
} from "@/features/sessions/detail-timing"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

const ASSET_CONTENT_SIGNED_URL_SECONDS = 5 * 60

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = startSessionDetailTiming()
  const resolvedParams = await context.params
  const assetId = resolvedParams.id?.trim()
  const requestUrl = new URL(request.url)
  const requestedOrgId = requestUrl.searchParams
    .get(NAVIGATION_SCOPE_ORG_QUERY_KEY)
    ?.trim()
  const requestedTeamId = requestUrl.searchParams
    .get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)
    ?.trim()
  const logAssetTiming = (input: {
    activeTeamId?: string | null
    error?: string
    outcome: string
    sessionId?: string | null
    status: "success" | "error"
    statusCode: number
  }) => {
    logSessionDetailTiming({
      route: "/api/session-assets/[id]/content",
      phase: "asset_content_signed_url",
      startedAt,
      sessionId: input.sessionId,
      activeTeamId: input.activeTeamId ?? requestedTeamId ?? null,
      status: input.status,
      error: input.error,
      metadata: {
        activeOrganizationId: requestedOrgId ?? null,
        assetId: assetId ?? null,
        outcome: input.outcome,
        statusCode: input.statusCode,
      },
    })
  }

  if (!assetId) {
    logAssetTiming({
      outcome: "missing_asset_id",
      status: "error",
      statusCode: 400,
    })
    return new NextResponse(null, { status: 400 })
  }

  if (!requestedOrgId || !requestedTeamId) {
    logAssetTiming({
      outcome: "missing_scope",
      status: "error",
      statusCode: 403,
    })
    return new NextResponse(null, { status: 403 })
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    logAssetTiming({
      outcome: "unauthenticated",
      status: "error",
      statusCode: 401,
    })
    return new NextResponse(null, { status: 401 })
  }

  const navigation = await resolveNavigationScope({
    context: accessContext as AuthenticatedAccessContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (
    !navigation.scope ||
    navigation.scope.activeOrgId !== requestedOrgId ||
    navigation.scope.activeTeamId !== requestedTeamId
  ) {
    logAssetTiming({
      outcome: "scope_not_allowed",
      status: "error",
      statusCode: 403,
    })
    return new NextResponse(null, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: assetRow, error: assetError } = await supabase
    .from("session_assets")
    .select("session_id,bucket,storage_path")
    .eq("id", assetId)
    .maybeSingle()

  if (assetError || !assetRow) {
    logAssetTiming({
      outcome: assetError ? "asset_query_error" : "asset_not_found",
      status: "error",
      statusCode: 404,
      error: assetError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id,camp_id")
    .eq("id", assetRow.session_id)
    .maybeSingle()

  if (sessionError || !sessionRow) {
    logAssetTiming({
      outcome: sessionError ? "session_query_error" : "session_not_found",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 404,
      error: sessionError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", sessionRow.camp_id)
    .maybeSingle()

  if (campError || !campRow) {
    logAssetTiming({
      outcome: campError ? "camp_query_error" : "camp_not_found",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 404,
      error: campError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", requestedTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    logAssetTiming({
      outcome: teamVenueError ? "team_venue_query_error" : "team_venue_not_found",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 404,
      error: teamVenueError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const [
    { data: teamRow, error: teamError },
    { data: venueRow, error: venueError },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("id", teamVenueRow.team_id)
      .eq("organization_id", requestedOrgId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("id")
      .eq("id", teamVenueRow.venue_id)
      .eq("organization_id", requestedOrgId)
      .maybeSingle(),
  ])

  if (teamError || venueError || !teamRow || !venueRow) {
    logAssetTiming({
      outcome: teamError || venueError ? "org_scope_query_error" : "org_scope_not_found",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 404,
      error: teamError?.message ?? venueError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(assetRow.bucket)
    .createSignedUrl(assetRow.storage_path, ASSET_CONTENT_SIGNED_URL_SECONDS)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    logAssetTiming({
      outcome: "signed_url_failed",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 502,
      error: signedUrlError?.message,
    })
    return new NextResponse(null, { status: 502 })
  }

  logAssetTiming({
    outcome: "redirected",
    sessionId: assetRow.session_id,
    status: "success",
    statusCode: 307,
  })

  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
