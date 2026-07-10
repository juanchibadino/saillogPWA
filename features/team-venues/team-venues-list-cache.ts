import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type {
  TeamVenueStatusFilter,
  TeamVenuesChromeData,
} from "@/features/team-venues/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const TEAM_VENUES_LIST_CACHE_ROUTE = "team-venues:list"

export type TeamVenuesListCacheFiltersInput = {
  loadMore: boolean
  selectedStatusFilter: TeamVenueStatusFilter
}

export type TeamVenuesListCacheInput = TeamVenuesListCacheFiltersInput & {
  currentYear: number
  page: number
  scope: ScopedRouteCacheScope
}

export type TeamVenuesListRequestInput = TeamVenuesListCacheFiltersInput & {
  currentYear: number
  page: number
  scope: NavigationScope
}

export function buildTeamVenuesListCacheFilters(
  input: TeamVenuesListCacheFiltersInput,
) {
  return {
    loadMore: input.loadMore,
    status: input.selectedStatusFilter,
  }
}

export function buildTeamVenuesListCacheMetadata(
  input: TeamVenuesListCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: TEAM_VENUES_LIST_CACHE_ROUTE,
    year: input.currentYear,
    filters: buildTeamVenuesListCacheFilters(input),
    page: input.page,
  })
}

export function buildTeamVenuesListCacheMetadataFromChrome(input: {
  chromeData: TeamVenuesChromeData
  currentYear: number
  loadMore: boolean
  page: number
  scope: ScopedRouteCacheScope
}): ApiSliceCacheMetadata {
  return buildTeamVenuesListCacheMetadata({
    scope: input.scope,
    currentYear: input.currentYear,
    selectedStatusFilter: input.chromeData.selectedStatusFilter,
    loadMore: input.loadMore,
    page: input.page,
  })
}

export function buildTeamVenuesListApiUrl(
  input: TeamVenuesListRequestInput,
): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("status", input.selectedStatusFilter)
  params.set("year", String(input.currentYear))
  params.set("page", String(input.page))
  params.set("loadMore", input.loadMore ? "1" : "0")

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  return `/api/team-venues/list?${params.toString()}`
}
