import { NextResponse } from "next/server"

import {
  getTeamCalendarChromeData,
  getTeamCalendarResultsData,
  type TeamCalendarTimeFilter,
} from "@/features/calendar/data"
import { resolveTeamCalendarListRequest } from "@/features/calendar/list-route-state.mjs"
import { buildTeamCalendarListCacheMetadataFromChrome } from "@/features/calendar/team-calendar-list-cache"
import { buildApiSliceErrorPayload } from "@/features/shared/api-slice-contracts"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const calendarListRequest = resolveTeamCalendarListRequest({
    eventParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("event") ?? undefined,
    ),
    memberParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("member") ?? undefined,
    ),
    timeParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("time") ?? undefined,
    ),
  })
  const requestedEventFilter = calendarListRequest.requestedEventFilter
  const requestedMemberId = calendarListRequest.requestedMemberId
  const requestedTimeFilter =
    calendarListRequest.requestedTimeFilter as TeamCalendarTimeFilter
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "unauthorized" }),
      { status: 401 },
    )
  }

  const authenticatedContext = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context: authenticatedContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "scope_required" }),
      { status: 403 },
    )
  }

  try {
    const chromeData = await getTeamCalendarChromeData({
      activeTeamId: navigation.scope.activeTeamId,
      currentProfileId: authenticatedContext.profile?.id ?? authenticatedContext.user.id,
      requestedEventFilterValue: requestedEventFilter?.value,
      requestedMemberId,
      requestedTimeFilter,
    })
    const data = await getTeamCalendarResultsData({
      activeTeamId: navigation.scope.activeTeamId,
      chromeData,
    })
    const cache = buildTeamCalendarListCacheMetadataFromChrome({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      chromeData,
    })

    return NextResponse.json({ cache, data })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown team calendar list error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "team_calendar_list_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
