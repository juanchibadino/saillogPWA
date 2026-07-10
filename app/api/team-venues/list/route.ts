import { NextResponse } from "next/server"

import {
  getTeamVenuesChromeData,
  getTeamVenuesResultsData,
  type TeamVenueStatusFilter,
} from "@/features/team-venues/data"
import { resolveTeamVenuesListRequest } from "@/features/team-venues/list-route-state.mjs"
import { buildTeamVenuesListCacheMetadataFromChrome } from "@/features/team-venues/team-venues-list-cache"
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

function resolveCurrentYear(value: string | undefined): number {
  const fallbackYear = new Date().getUTCFullYear()

  if (!value) {
    return fallbackYear
  }

  const parsedYear = Number.parseInt(value, 10)

  if (!Number.isFinite(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    return fallbackYear
  }

  return parsedYear
}

function resolveTypedStatusFilter(value: unknown): TeamVenueStatusFilter {
  return value === "deprecated" ? "deprecated" : "active"
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const currentYear = resolveCurrentYear(
    getSingleSearchParamValue(requestUrl.searchParams.get("year") ?? undefined),
  )
  const {
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter: rawRequestedStatusFilter,
  } = resolveTeamVenuesListRequest({
    statusParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("status") ?? undefined,
    ),
    pageParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("page") ?? undefined,
    ),
    loadMoreParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("loadMore") ?? undefined,
    ),
  })
  const requestedStatusFilter = resolveTypedStatusFilter(rawRequestedStatusFilter)

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
    const chromeData = await getTeamVenuesChromeData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: navigation.scope.activeTeamId,
      includeAvailableVenueOptions: false,
      statusFilter: requestedStatusFilter,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })
    const data = await getTeamVenuesResultsData({
      activeTeamId: navigation.scope.activeTeamId,
      chromeData,
      currentYear,
      includeMetrics: true,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
      statusFilter: requestedStatusFilter,
    })
    const cache = buildTeamVenuesListCacheMetadataFromChrome({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      chromeData,
      currentYear,
      loadMore: requestedLoadMoreMode,
      page: requestedPage,
    })

    return NextResponse.json({ cache, data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown team venues list error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "team_venues_list_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
