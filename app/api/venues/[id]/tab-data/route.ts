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
  canManageTeamFinance,
  canManageTeamSessions,
} from "@/lib/auth/capabilities"
import { resolveOrganizationTeamExpensesEntitlement } from "@/lib/billing/entitlements"
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
    requestedCrewFilter,
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
    requestedType,
    requestedYear,
  } = resolveVenueDetailRouteRequest({
    crewParam: requestUrl.searchParams.get("crew") ?? undefined,
    highlightParam: requestUrl.searchParams.get("highlight") ?? undefined,
    loadMoreParam: requestUrl.searchParams.get("loadMore") ?? undefined,
    memberParam: requestUrl.searchParams.get("member") ?? undefined,
    pageParam: requestUrl.searchParams.get("page") ?? undefined,
    tabParam: requestUrl.searchParams.get("tab") ?? undefined,
    typeParam: requestUrl.searchParams.get("type") ?? undefined,
    yearParam: requestUrl.searchParams.get("year") ?? undefined,
  }) as {
    requestedCrewFilter?: string
    requestedHighlight?: "yes" | "no"
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedType?: string
    requestedYear?: number
  }
  const requestedCampId = requestUrl.searchParams.get("camp") ?? undefined
  const requestedMemberId = requestUrl.searchParams.get("member") ?? undefined

  try {
    const yearContextPromise = getTeamVenueDetailYearContextData({
      activeTeamId: navigation.scope.activeTeamId,
      requestedYear,
      teamVenue: chromeData.teamVenue,
    })
    const currentProfileId = authenticatedContext.profile?.id ?? authenticatedContext.user.id
    const canManageTeamFinanceRows = canManageTeamFinance({
      context: authenticatedContext,
      organizationId: navigation.scope.activeOrgId,
      teamId: navigation.scope.activeTeamId,
    })
    const canManageTeamSessionsRows = canManageTeamSessions({
      context: authenticatedContext,
      organizationId: navigation.scope.activeOrgId,
      teamId: navigation.scope.activeTeamId,
    })
    const teamExpensesEntitlement =
      tab === "expenses"
        ? await resolveOrganizationTeamExpensesEntitlement({
            organizationId: navigation.scope.activeOrgId,
          })
        : null
    const teamExpensesBlockReason =
      teamExpensesEntitlement && !teamExpensesEntitlement.allowed
        ? teamExpensesEntitlement.reason
        : null
    const effectiveExpenseCrewFilter =
      tab === "expenses"
        ? requestedCrewFilter ??
          (!canManageTeamFinanceRows && !requestedMemberId ? "you" : undefined)
        : undefined

    const [kpis, data] = await Promise.all([
      getTeamVenueDetailKpisData({
        activeTeamId: navigation.scope.activeTeamId,
        requestedYear,
        teamVenue: chromeData.teamVenue,
        yearContextPromise,
      }),
      getTeamVenueDetailTabData({
        activeOrganizationId: navigation.scope.activeOrgId,
        activeTeamId: navigation.scope.activeTeamId,
        accumulatePages: requestedLoadMoreMode,
        canManageTeamFinance: canManageTeamFinanceRows,
        canManageTeamSessions: canManageTeamSessionsRows,
        currentProfileId,
        requestedPage,
        requestedYear,
        selectedCampId: requestedCampId,
        selectedCrewFilter: effectiveExpenseCrewFilter,
        selectedExpenseType: requestedType,
        selectedHighlight: requestedHighlight,
        selectedMemberId: requestedMemberId,
        tab,
        teamExpensesBlockReason,
        teamVenue: chromeData.teamVenue,
        venue: chromeData.venue,
        yearContextPromise,
      }),
    ])
    const tabPage = tab === "sessions" ? requestedPage : 1
    const tabLoadMore = tab === "sessions" && requestedLoadMoreMode
    const tabCampId = tab === "sessions" ? requestedCampId : undefined
    const tabHighlight = tab === "sessions" ? requestedHighlight : undefined
    const tabCrewFilter = effectiveExpenseCrewFilter
    const tabMemberId = tab === "expenses" ? requestedMemberId : undefined
    const tabExpenseType = tab === "expenses" ? requestedType : undefined
    const cache = buildVenueDetailTabCacheMetadata({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      teamVenueId: chromeData.teamVenue.id,
      tab,
      year: kpis.selectedYear,
      campId: tabCampId,
      crewFilter: tabCrewFilter,
      expenseBlockReason: tab === "expenses" ? teamExpensesBlockReason : null,
      expenseType: tabExpenseType,
      highlight: tabHighlight,
      loadMore: tabLoadMore,
      memberId: tabMemberId,
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
