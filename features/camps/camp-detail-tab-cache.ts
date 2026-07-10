import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type { CampDetailTab } from "@/features/camps/detail-types"
import type { TeamSessionHighlightFilter } from "@/features/sessions/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const CAMP_DETAIL_TAB_CACHE_ROUTE = "team-camps:tab-data"

export type CampDetailTabCacheFiltersInput = {
  highlight?: TeamSessionHighlightFilter | null
  loadMore: boolean
  notesOffset: number
}

export type CampDetailTabCacheInput = CampDetailTabCacheFiltersInput & {
  campId: string
  page: number
  scope: ScopedRouteCacheScope
  tab: CampDetailTab
}

export type CampDetailTabRequestInput = CampDetailTabCacheFiltersInput & {
  campId: string
  page: number
  scope: NavigationScope
  tab: CampDetailTab
}

export function buildCampDetailTabCacheFilters(
  input: CampDetailTabCacheFiltersInput,
) {
  return {
    highlight: input.highlight ?? null,
    loadMore: input.loadMore,
    notesOffset: input.notesOffset,
  }
}

export function buildCampDetailTabCacheMetadata(
  input: CampDetailTabCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: CAMP_DETAIL_TAB_CACHE_ROUTE,
    entityId: input.campId,
    tab: input.tab,
    filters: buildCampDetailTabCacheFilters(input),
    page: input.page,
  })
}

export function buildCampDetailTabApiUrl(
  input: CampDetailTabRequestInput,
): string {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.highlight) {
    params.set("highlight", input.highlight)
  }

  if (input.page > 1) {
    params.set("page", String(input.page))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  if (input.tab === "notes" && input.notesOffset > 0) {
    params.set("notesOffset", String(input.notesOffset))
  }

  return `/api/team-camps/${encodeURIComponent(input.campId)}/tab-data?${params.toString()}`
}
