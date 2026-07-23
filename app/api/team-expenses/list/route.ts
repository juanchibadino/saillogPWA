import { NextResponse } from "next/server"

import {
  getTeamExpensesChromeData,
  getTeamExpensesResultsData,
} from "@/features/expenses/data"
import { resolveTeamExpensesListRequest } from "@/features/expenses/list-route-state.mjs"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  canManageTeamFinance,
  canManageTeamSessions,
} from "@/lib/auth/capabilities"
import { resolveOrganizationTeamExpensesEntitlement } from "@/lib/billing/entitlements"
import { resolveNavigationScope } from "@/lib/navigation/scope"
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
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const context = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json({ error: "scope_required" }, { status: 403 })
  }

  const expensesEntitlement = await resolveOrganizationTeamExpensesEntitlement({
    organizationId: navigation.scope.activeOrgId,
  })

  if (!expensesEntitlement.allowed && expensesEntitlement.reason) {
    return NextResponse.json(
      { error: expensesEntitlement.reason },
      { status: expensesEntitlement.reason === "payment_required" ? 402 : 403 },
    )
  }

  const {
    requestedCampId,
    requestedCrewFilter,
    requestedLoadMoreMode,
    requestedMemberId,
    requestedPage,
    requestedScope,
    requestedType,
    requestedVenueId,
    requestedYear,
  } = resolveTeamExpensesListRequest({
    campParam: requestUrl.searchParams.get("camp") ?? undefined,
    crewParam: requestUrl.searchParams.get("crew") ?? undefined,
    loadMoreParam: requestUrl.searchParams.get("loadMore") ?? undefined,
    memberParam: requestUrl.searchParams.get("member") ?? undefined,
    pageParam: requestUrl.searchParams.get("page") ?? undefined,
    scopeParam: requestUrl.searchParams.get("scope") ?? undefined,
    typeParam: requestUrl.searchParams.get("type") ?? undefined,
    venueParam: requestUrl.searchParams.get("venue") ?? undefined,
    yearParam: requestUrl.searchParams.get("year") ?? undefined,
  }) as {
    requestedCampId?: string
    requestedCrewFilter?: string
    requestedLoadMoreMode: boolean
    requestedMemberId?: string
    requestedPage: number
    requestedScope?: string
    requestedType?: string
    requestedVenueId?: string
    requestedYear?: number
  }
  const currentProfileId = context.profile?.id ?? context.user.id
  const canManageExpenseRows = canManageTeamSessions({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })
  const canManageTeamFinanceRows = canManageTeamFinance({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })

  try {
    const chromeData = await getTeamExpensesChromeData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: navigation.scope.activeTeamId,
      canManageTeamFinance: canManageTeamFinanceRows,
      currentProfileId,
      requestedCampId,
      requestedCrewFilter,
      requestedMemberId,
      requestedScope,
      requestedType,
      requestedVenueId,
      requestedYear,
    })
    const resultsData = await getTeamExpensesResultsData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: navigation.scope.activeTeamId,
      canManageTeamFinance: canManageTeamFinanceRows,
      canManageTeamSessions: canManageExpenseRows,
      chromeData,
      currentProfileId,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })

    return NextResponse.json({
      chrome: chromeData,
      results: resultsData,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown expense list error"
    return NextResponse.json(
      { error: "team_expenses_list_failed", detail },
      { status: 500 },
    )
  }
}
