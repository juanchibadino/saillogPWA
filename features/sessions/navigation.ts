import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const SESSION_DETAIL_TABS = ["info", "results", "images", "analytics"] as const

export type SessionDetailTab = (typeof SESSION_DETAIL_TABS)[number]

function appendScopeParams(params: URLSearchParams, scope: NavigationScope): void {
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }
}

export function buildTeamSessionsHref(input: {
  scope: NavigationScope
  venueId?: string
  campId?: string
  page?: number
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  if (input.campId) {
    params.set("camp", input.campId)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  return `/team-sessions?${params.toString()}`
}

export function buildSessionDetailHref(input: {
  scope: NavigationScope
  sessionId: string
  tab?: SessionDetailTab
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab) {
    params.set("tab", input.tab)
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  const basePath = `/team-sessions/${input.sessionId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}
