import { NextResponse } from "next/server"

import {
  getTeamCampsChromeData,
  getTeamCampsResultsData,
} from "@/features/camps/data"
import { resolveTeamCampsListRequest } from "@/features/camps/list-route-state.mjs"
import { buildTeamCampsListCacheMetadataFromChrome } from "@/features/camps/team-camps-list-cache"
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
  const requestedVenueId = getSingleSearchParamValue(
    requestUrl.searchParams.get("venue") ?? undefined,
  )
  const {
    requestedCampStatus,
    requestedCampType,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamCampsListRequest({
    pageParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("page") ?? undefined,
    ),
    loadMoreParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("loadMore") ?? undefined,
    ),
    typeParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("type") ?? undefined,
    ),
    campStatusParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("campStatus") ?? undefined,
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
    const chromeData = await getTeamCampsChromeData({
      activeTeamId: navigation.scope.activeTeamId,
      selectedVenueId: requestedVenueId,
      selectedCampType: requestedCampType,
      selectedCampStatus: requestedCampStatus,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })
    const data = await getTeamCampsResultsData({
      activeTeamId: navigation.scope.activeTeamId,
      chromeData,
      includeSessionCounts: true,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })
    const cache = buildTeamCampsListCacheMetadataFromChrome({
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
    const detail = error instanceof Error ? error.message : "Unknown camps list error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "team_camps_list_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
