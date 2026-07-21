import { NextResponse } from "next/server"

import { getTeamAssetsPageData } from "@/features/assets/data"
import { resolveTeamAssetsListRequest } from "@/features/assets/list-route-state.mjs"
import { buildApiSliceErrorPayload } from "@/features/shared/api-slice-contracts"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
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
  const {
    requestedCampId,
    requestedPage,
    requestedSessionId,
    requestedTab: rawRequestedTab,
    requestedVenueId,
    requestedYear,
  } = resolveTeamAssetsListRequest({
    campParam: getSingleSearchParamValue(requestUrl.searchParams.get("camp") ?? undefined),
    loadMoreParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("loadMore") ?? undefined,
    ),
    pageParam: getSingleSearchParamValue(requestUrl.searchParams.get("page") ?? undefined),
    sessionParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("session") ?? undefined,
    ),
    tabParam: getSingleSearchParamValue(requestUrl.searchParams.get("tab") ?? undefined),
    venueParam: getSingleSearchParamValue(requestUrl.searchParams.get("venue") ?? undefined),
    yearParam: getSingleSearchParamValue(requestUrl.searchParams.get("year") ?? undefined),
  })
  const requestedTab = rawRequestedTab
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "unauthorized" }),
      { status: 401 },
    )
  }

  const navigation = await resolveNavigationScope({
    context: accessContext as AuthenticatedAccessContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "scope_required" }),
      { status: 403 },
    )
  }

  try {
    const authenticatedContext = accessContext as AuthenticatedAccessContext
    const canManageAssets = canManageTeamSessions({
      context: authenticatedContext,
      organizationId: navigation.scope.activeOrgId,
      teamId: navigation.scope.activeTeamId,
    })
    const data = await getTeamAssetsPageData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: navigation.scope.activeTeamId,
      canManageAssets,
      page: requestedPage,
      requestedFilters: {
        campId: requestedCampId,
        sessionId: requestedSessionId,
        venueId: requestedVenueId,
        year: requestedYear,
      },
      tab: requestedTab,
    })

    return NextResponse.json({ data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown team assets list error"

    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "team_assets_list_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
