import { NextResponse } from "next/server"

import {
  getTeamVenueDetailChromeData,
  getTeamVenueDetailKpisData,
  getTeamVenueDetailTabData,
  getTeamVenueDetailYearContextData,
} from "@/features/venues/detail-data"
import {
  VENUE_DETAIL_TABS,
  type VenueDetailTab,
} from "@/features/venues/navigation"
import { resolveVenueDetailRouteRequest } from "@/features/venues/detail-route-state.mjs"
import { buildApiSliceErrorPayload } from "@/features/shared/api-slice-contracts"
import { buildVenueDetailTabCacheMetadata } from "@/features/venues/venue-detail-tab-cache"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

function resolveTab(value: string | null): VenueDetailTab | null {
  if (!value) {
    return null
  }

  if (value === "metrics") {
    return "assessments"
  }

  return VENUE_DETAIL_TABS.includes(value as VenueDetailTab)
    ? (value as VenueDetailTab)
    : null
}

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const teamVenueId = resolvedParams.id?.trim()

  if (!teamVenueId) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_team_venue_id" }),
      { status: 400 },
    )
  }

  const requestUrl = new URL(request.url)
  const tab = resolveTab(requestUrl.searchParams.get("tab"))

  if (!tab) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_tab" }),
      { status: 400 },
    )
  }

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

  const chromeData = await getTeamVenueDetailChromeData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    teamVenueId,
  })

  if (!chromeData.venue || !chromeData.teamVenue) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "team_venue_not_found" }),
      { status: 404 },
    )
  }

  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
    requestedYear,
  } = resolveVenueDetailRouteRequest({
    highlightParam: requestUrl.searchParams.get("highlight") ?? undefined,
    loadMoreParam: requestUrl.searchParams.get("loadMore") ?? undefined,
    pageParam: requestUrl.searchParams.get("page") ?? undefined,
    tabParam: requestUrl.searchParams.get("tab") ?? undefined,
    yearParam: requestUrl.searchParams.get("year") ?? undefined,
  }) as {
    requestedHighlight?: "yes" | "no"
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedYear?: number
  }
  const requestedCampId = requestUrl.searchParams.get("camp") ?? undefined

  try {
    const yearContextPromise = getTeamVenueDetailYearContextData({
      activeTeamId: navigation.scope.activeTeamId,
      requestedYear,
      teamVenue: chromeData.teamVenue,
    })

    const [kpis, data] = await Promise.all([
      getTeamVenueDetailKpisData({
        activeTeamId: navigation.scope.activeTeamId,
        requestedYear,
        teamVenue: chromeData.teamVenue,
        yearContextPromise,
      }),
      getTeamVenueDetailTabData({
        activeTeamId: navigation.scope.activeTeamId,
        accumulatePages: requestedLoadMoreMode,
        currentProfileId: authenticatedContext.user.id,
        requestedPage,
        requestedYear,
        selectedCampId: requestedCampId,
        selectedHighlight: requestedHighlight,
        tab,
        teamVenue: chromeData.teamVenue,
        venue: chromeData.venue,
        yearContextPromise,
      }),
    ])
    const tabPage = tab === "sessions" ? requestedPage : 1
    const tabLoadMore = tab === "sessions" && requestedLoadMoreMode
    const tabCampId = tab === "sessions" ? requestedCampId : undefined
    const tabHighlight = tab === "sessions" ? requestedHighlight : undefined
    const cache = buildVenueDetailTabCacheMetadata({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      teamVenueId: chromeData.teamVenue.id,
      tab,
      year: kpis.selectedYear,
      campId: tabCampId,
      highlight: tabHighlight,
      loadMore: tabLoadMore,
      page: tabPage,
    })

    return NextResponse.json({ cache, data, kpis, tab })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown tab data error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "tab_data_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
