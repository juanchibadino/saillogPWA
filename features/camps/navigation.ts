import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import type { CampDetailTab } from "@/features/camps/detail-types"

export const CAMP_DETAIL_TABS: CampDetailTab[] = ["sessions", "goals", "notes"]

function appendScopeParams(params: URLSearchParams, scope: NavigationScope): void {
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)
  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }
}

export function buildCampDetailHref(input: {
  scope: NavigationScope
  campId: string
  tab?: CampDetailTab
  page?: number
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab) {
    params.set("tab", input.tab)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  const query = params.toString()
  const basePath = `/team-camps/${input.campId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}
