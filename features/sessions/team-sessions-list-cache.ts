import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type {
  TeamSessionHighlightFilter,
  TeamSessionsChromeData,
} from "@/features/sessions/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const TEAM_SESSIONS_LIST_CACHE_ROUTE = "team-sessions:list"

export type TeamSessionsListCacheFiltersInput = {
  loadMore: boolean
  selectedCampId?: string | null
  selectedHighlight?: TeamSessionHighlightFilter | null
  selectedVenueId?: string | null
}

export type TeamSessionsListCacheInput = TeamSessionsListCacheFiltersInput & {
  page: number
  scope: ScopedRouteCacheScope
}

export type TeamSessionsListRequestInput = TeamSessionsListCacheFiltersInput & {
  page: number
  scope: NavigationScope
}

export function buildTeamSessionsListCacheFilters(
  input: TeamSessionsListCacheFiltersInput,
) {
  return {
    camp: input.selectedCampId ?? null,
    highlight: input.selectedHighlight ?? null,
    loadMore: input.loadMore,
    venue: input.selectedVenueId ?? null,
  }
}

export function buildTeamSessionsListCacheMetadata(
  input: TeamSessionsListCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: TEAM_SESSIONS_LIST_CACHE_ROUTE,
    filters: buildTeamSessionsListCacheFilters(input),
    page: input.page,
  })
}

export function buildTeamSessionsListCacheMetadataFromChrome(input: {
  chromeData: TeamSessionsChromeData
  loadMore: boolean
  page: number
  scope: ScopedRouteCacheScope
}): ApiSliceCacheMetadata {
  return buildTeamSessionsListCacheMetadata({
    scope: input.scope,
    selectedVenueId: input.chromeData.selectedVenueId,
    selectedCampId: input.chromeData.selectedCampId,
    selectedHighlight: input.chromeData.selectedHighlight,
    loadMore: input.loadMore,
    page: input.page,
  })
}

export function buildTeamSessionsListApiUrl(
  input: TeamSessionsListRequestInput,
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

  if (input.selectedCampId) {
    params.set("camp", input.selectedCampId)
  }

  if (input.selectedHighlight) {
    params.set("highlight", input.selectedHighlight)
  }

  return `/api/team-sessions/list?${params.toString()}`
}
