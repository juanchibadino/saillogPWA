import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const VENUE_DETAIL_TABS = ["camps", "sessions", "metrics", "reports"] as const

export type VenueDetailTab = (typeof VENUE_DETAIL_TABS)[number]

function appendScopeParams(params: URLSearchParams, scope: NavigationScope): void {
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)
  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }
}

export function buildTeamVenuesHref(scope: NavigationScope, venueId: string): string {
  const params = new URLSearchParams()
  appendScopeParams(params, scope)
  params.set("venue", venueId)
  return `/team-venues?${params.toString()}`
}

export function buildVenueDetailHref(input: {
  scope: NavigationScope
  venueId: string
  tab?: VenueDetailTab
  year?: number
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab) {
    params.set("tab", input.tab)
  }

  if (typeof input.year === "number" && Number.isFinite(input.year)) {
    params.set("year", String(input.year))
  }

  const query = params.toString()
  const basePath = `/venues/${input.venueId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}
