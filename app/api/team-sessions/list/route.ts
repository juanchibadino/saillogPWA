import { NextResponse } from "next/server"

import {
  getTeamSessionsChromeData,
  getTeamSessionsResultsData,
} from "@/features/sessions/data"
import { resolveTeamSessionsListRequest } from "@/features/sessions/list-route-state.mjs"
import { buildApiSliceErrorPayload } from "@/features/shared/api-slice-contracts"
import { buildTeamSessionsListCacheMetadataFromChrome } from "@/features/sessions/team-sessions-list-cache"
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
  const requestedVenueId = getSingleSearchParamValue(
    requestUrl.searchParams.get("venue") ?? undefined,
  )
  const requestedCampId = getSingleSearchParamValue(
    requestUrl.searchParams.get("camp") ?? undefined,
  )
  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamSessionsListRequest({
    highlightParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("highlight") ?? undefined,
    ),
    loadMoreParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("loadMore") ?? undefined,
    ),
    pageParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("page") ?? undefined,
    ),
  })

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
    const chromeData = await getTeamSessionsChromeData({
      activeTeamId: navigation.scope.activeTeamId,
      selectedVenueId: requestedVenueId,
      selectedCampId: requestedCampId,
      selectedHighlight: requestedHighlight,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })
    const data = await getTeamSessionsResultsData({
      activeTeamId: navigation.scope.activeTeamId,
      chromeData,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })
    const cache = buildTeamSessionsListCacheMetadataFromChrome({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      chromeData,
      loadMore: requestedLoadMoreMode,
      page: requestedPage,
    })

    return NextResponse.json({ cache, data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown sessions list error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "team_sessions_list_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
