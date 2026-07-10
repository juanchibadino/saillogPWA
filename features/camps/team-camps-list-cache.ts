import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type {
  TeamCampStatusFilter,
  TeamCampTypeFilter,
  TeamCampsChromeData,
} from "@/features/camps/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const TEAM_CAMPS_LIST_CACHE_ROUTE = "team-camps:list"

export type TeamCampsListCacheFiltersInput = {
  loadMore: boolean
  selectedCampStatus?: TeamCampStatusFilter | null
  selectedCampType?: TeamCampTypeFilter | null
  selectedVenueId?: string | null
}

export type TeamCampsListCacheInput = TeamCampsListCacheFiltersInput & {
  page: number
  scope: ScopedRouteCacheScope
}

export type TeamCampsListRequestInput = TeamCampsListCacheFiltersInput & {
  page: number
  scope: NavigationScope
}

export function buildTeamCampsListCacheFilters(
  input: TeamCampsListCacheFiltersInput,
) {
  return {
    loadMore: input.loadMore,
    status: input.selectedCampStatus ?? null,
    type: input.selectedCampType ?? null,
    venue: input.selectedVenueId ?? null,
  }
}

export function buildTeamCampsListCacheMetadata(
  input: TeamCampsListCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: TEAM_CAMPS_LIST_CACHE_ROUTE,
    filters: buildTeamCampsListCacheFilters(input),
    page: input.page,
  })
}

export function buildTeamCampsListCacheMetadataFromChrome(input: {
  chromeData: TeamCampsChromeData
  loadMore: boolean
  page: number
  scope: ScopedRouteCacheScope
}): ApiSliceCacheMetadata {
  return buildTeamCampsListCacheMetadata({
    scope: input.scope,
    selectedVenueId: input.chromeData.selectedVenueId,
    selectedCampType: input.chromeData.selectedCampType,
    selectedCampStatus: input.chromeData.selectedCampStatus,
    loadMore: input.loadMore,
    page: input.page,
  })
}

export function buildTeamCampsListApiUrl(
  input: TeamCampsListRequestInput,
): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("page", String(input.page))
  params.set("loadMore", input.loadMore ? "1" : "0")

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.selectedVenueId) {
    params.set("venue", input.selectedVenueId)
  }

  if (input.selectedCampType) {
    params.set("type", input.selectedCampType)
  }

  if (input.selectedCampStatus) {
    params.set("campStatus", input.selectedCampStatus)
  }

  return `/api/team-camps/list?${params.toString()}`
}
