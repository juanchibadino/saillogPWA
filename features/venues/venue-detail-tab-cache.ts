import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type { TeamSessionHighlightFilter } from "@/features/sessions/data"
import type { VenueDetailTab } from "@/features/venues/navigation"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const VENUE_DETAIL_TAB_CACHE_ROUTE = "venues:tab-data"

export type VenueDetailTabCacheFiltersInput = {
  campId?: string | null
  crewFilter?: string | null
  expenseType?: string | null
  highlight?: TeamSessionHighlightFilter | null
  loadMore: boolean
  memberId?: string | null
}

export type VenueDetailTabCacheInput = VenueDetailTabCacheFiltersInput & {
  page: number
  scope: ScopedRouteCacheScope
  tab: VenueDetailTab
  teamVenueId: string
  year: number
}

export type VenueDetailTabRequestInput = VenueDetailTabCacheFiltersInput & {
  page: number
  scope: NavigationScope
  tab: VenueDetailTab
  teamVenueId: string
  year: number
}

export function buildVenueDetailTabCacheFilters(
  input: VenueDetailTabCacheFiltersInput,
) {
  return {
    camp: input.campId ?? null,
    crew: input.crewFilter ?? null,
    type: input.expenseType ?? null,
    highlight: input.highlight ?? null,
    loadMore: input.loadMore,
    member: input.memberId ?? null,
  }
}

export function buildVenueDetailTabCacheMetadata(
  input: VenueDetailTabCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: VENUE_DETAIL_TAB_CACHE_ROUTE,
    entityId: input.teamVenueId,
    tab: input.tab,
    year: input.year,
    filters: buildVenueDetailTabCacheFilters(input),
    page: input.page,
  })
}

export function buildVenueDetailTabApiUrl(
  input: VenueDetailTabRequestInput,
): string {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("year", String(input.year))

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.campId) {
    params.set("camp", input.campId)
  }

  if (input.highlight) {
    params.set("highlight", input.highlight)
  }

  if (input.memberId) {
    params.set("member", input.memberId)
  }

  if (input.crewFilter) {
    params.set("crew", input.crewFilter)
  }

  if (input.expenseType) {
    params.set("type", input.expenseType)
  }

  if (input.page > 1) {
    params.set("page", String(input.page))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  return `/api/venues/${encodeURIComponent(input.teamVenueId)}/tab-data?${params.toString()}`
}
