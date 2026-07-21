import type {
  TeamAssetsRequestedFilters,
  TeamAssetTab,
} from "@/features/assets/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export function buildTeamAssetsListApiUrl(input: {
  filters: TeamAssetsRequestedFilters
  page: number
  scope: NavigationScope
  tab: TeamAssetTab
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("page", String(input.page))

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.tab === "files" || input.tab === "gps-files") {
    params.set("tab", input.tab)
  }

  if (input.filters.venueId) {
    params.set("venue", input.filters.venueId)
  }

  if (typeof input.filters.year === "number") {
    params.set("year", String(input.filters.year))
  }

  if (input.filters.campId) {
    params.set("camp", input.filters.campId)
  }

  if (input.filters.sessionId) {
    params.set("session", input.filters.sessionId)
  }

  return `/api/team-assets/list?${params.toString()}`
}
