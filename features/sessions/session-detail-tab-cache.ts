import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type { SessionDetailTab } from "@/features/sessions/navigation"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const SESSION_DETAIL_TAB_CACHE_ROUTE = "team-sessions:tab-data"
export const SESSION_DETAIL_ASSET_TAB_STALE_MS = 60 * 1000
export const SESSION_DETAIL_ASSET_TAB_MAX_AGE_MS = 4 * 60 * 1000

export type SessionDetailTabCacheFiltersInput = {
  assetOffset: number
  catalogOffset: number
}

export type SessionDetailTabCacheInput = SessionDetailTabCacheFiltersInput & {
  scope: ScopedRouteCacheScope
  sessionId: string
  tab: SessionDetailTab
}

export type SessionDetailTabRequestInput = SessionDetailTabCacheFiltersInput & {
  scope: NavigationScope
  sessionId: string
  tab: SessionDetailTab
}

export function isSessionAssetTab(tab: SessionDetailTab): tab is "images" | "analytics" {
  return tab === "images" || tab === "analytics"
}

export function buildSessionDetailTabCacheFilters(
  input: SessionDetailTabCacheFiltersInput,
) {
  return {
    assetOffset: input.assetOffset,
    catalogOffset: input.catalogOffset,
  }
}

export function buildSessionDetailTabCacheMetadata(
  input: SessionDetailTabCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: SESSION_DETAIL_TAB_CACHE_ROUTE,
    entityId: input.sessionId,
    tab: input.tab,
    filters: buildSessionDetailTabCacheFilters(input),
  })
}

export function buildSessionDetailTabApiUrl(
  input: SessionDetailTabRequestInput,
): string {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (isSessionAssetTab(input.tab) && input.assetOffset > 0) {
    params.set("assetOffset", String(input.assetOffset))
  }

  if (!isSessionAssetTab(input.tab) && input.catalogOffset > 0) {
    params.set("catalogOffset", String(input.catalogOffset))
  }

  return `/api/team-sessions/${encodeURIComponent(input.sessionId)}/tab-data?${params.toString()}`
}
