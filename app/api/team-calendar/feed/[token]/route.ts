import { NextResponse } from "next/server"

import { getTeamCalendarFeedRouteData } from "@/features/calendar/feed-data"
import { resolveRequestOrigin } from "@/lib/http/request-origin"

type TeamCalendarFeedRouteContext = {
  params: Promise<{ token: string }>
}

function parseFeedTokenParam(value: string | undefined): string | null {
  const rawValue = value?.trim() ?? ""

  if (!rawValue.endsWith(".ics")) {
    return null
  }

  return rawValue.slice(0, -4)
}

export async function GET(request: Request, context: TeamCalendarFeedRouteContext) {
  const params = await context.params
  const rawToken = parseFeedTokenParam(params.token)

  if (!rawToken) {
    return new NextResponse(null, { status: 404 })
  }

  const origin = await resolveRequestOrigin(request)
  const feedData = await getTeamCalendarFeedRouteData({
    origin,
    rawToken,
  })

  if (!feedData) {
    return new NextResponse(null, { status: 404 })
  }

  const requestUrl = new URL(request.url)
  const shouldDownload = requestUrl.searchParams.get("download") === "1"
  const headers = new Headers({
    "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
    "Content-Type": "text/calendar; charset=utf-8",
  })

  if (shouldDownload) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${feedData.fileName.replaceAll('"', "")}"`,
    )
  }

  return new NextResponse(feedData.ics, {
    headers,
    status: 200,
  })
}
