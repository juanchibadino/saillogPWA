import { NextResponse } from "next/server"

import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

type GpsArtifactKind = "raw" | "series_1hz" | "summary" | "track_geojson"

const GPS_ARTIFACT_SIGNED_URL_SECONDS = 5 * 60

function resolveGpsArtifactKind(value: string | null): GpsArtifactKind | null {
  if (
    value === "raw" ||
    value === "series_1hz" ||
    value === "summary" ||
    value === "track_geojson"
  ) {
    return value
  }

  return null
}

function buildDownloadFileName(input: {
  fileName: string
  kind: GpsArtifactKind
}): string {
  const baseName = input.fileName.replace(/\.csv$/i, "")

  if (input.kind === "raw") {
    return input.fileName
  }

  if (input.kind === "series_1hz") {
    return `${baseName}-series-1hz.csv`
  }

  if (input.kind === "summary") {
    return `${baseName}-summary.csv`
  }

  return `${baseName}-track.geojson`
}

function canReadRequestedScope(input: {
  accessContext: AuthenticatedAccessContext
  requestedOrgId: string
  requestedTeamId: string
}): boolean {
  if (input.accessContext.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  if (
    input.accessContext.organizationMemberships.some(
      (membership) =>
        membership.organization_id === input.requestedOrgId &&
        membership.role === "organization_admin",
    )
  ) {
    return true
  }

  return input.accessContext.teamMemberships.some(
    (membership) =>
      membership.team_id === input.requestedTeamId && membership.is_active,
  )
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const assetId = resolvedParams.id?.trim()
  const requestUrl = new URL(request.url)
  const requestedOrgId = requestUrl.searchParams
    .get(NAVIGATION_SCOPE_ORG_QUERY_KEY)
    ?.trim()
  const requestedTeamId = requestUrl.searchParams
    .get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)
    ?.trim()
  const kind = resolveGpsArtifactKind(requestUrl.searchParams.get("kind"))
  const shouldDownload = requestUrl.searchParams.get("download") === "1"

  if (!assetId || !requestedOrgId || !requestedTeamId || !kind) {
    return new NextResponse(null, { status: 400 })
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return new NextResponse(null, { status: 401 })
  }

  if (
    !canReadRequestedScope({
      accessContext: accessContext as AuthenticatedAccessContext,
      requestedOrgId,
      requestedTeamId,
    })
  ) {
    return new NextResponse(null, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: assetRow, error: assetError } = await supabase
    .from("session_assets")
    .select("session_id,asset_type,file_name")
    .eq("id", assetId)
    .maybeSingle()

  if (assetError || !assetRow || assetRow.asset_type !== "gps_file") {
    return new NextResponse(null, { status: 404 })
  }

  const [
    { data: sessionRow, error: sessionError },
    { data: gpsRow, error: gpsError },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id,camp_id")
      .eq("id", assetRow.session_id)
      .maybeSingle(),
    supabase
      .from("session_vakaros_uploads")
      .select(
        "bucket,raw_storage_path,series_1hz_storage_path,track_geojson_storage_path,summary_storage_path",
      )
      .eq("asset_id", assetId)
      .eq("session_id", assetRow.session_id)
      .maybeSingle(),
  ])

  if (sessionError || !sessionRow || gpsError || !gpsRow) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", sessionRow.camp_id)
    .maybeSingle()

  if (campError || !campRow) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", requestedTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
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
    return new NextResponse(null, { status: 404 })
  }

  const storagePath =
    kind === "raw"
      ? gpsRow.raw_storage_path
      : kind === "series_1hz"
        ? gpsRow.series_1hz_storage_path
        : kind === "summary"
          ? gpsRow.summary_storage_path
          : gpsRow.track_geojson_storage_path

  if (!storagePath) {
    return new NextResponse(null, { status: 404 })
  }

  const downloadFileName = buildDownloadFileName({
    fileName: assetRow.file_name,
    kind,
  })
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(gpsRow.bucket)
    .createSignedUrl(
      storagePath,
      GPS_ARTIFACT_SIGNED_URL_SECONDS,
      shouldDownload ? { download: downloadFileName } : undefined,
    )

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return new NextResponse(null, { status: 502 })
  }

  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
