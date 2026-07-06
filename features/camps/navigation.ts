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
  loadMore?: boolean
  highlight?: "yes" | "no"
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab) {
    params.set("tab", input.tab)
  }

  if (input.highlight) {
    params.set("highlight", input.highlight)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  const basePath = `/team-camps/${input.campId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}

export type TeamCampsHrefInput = {
  scope: NavigationScope
  venueId?: string
  campType?: "training" | "regatta" | "mixed"
  campStatus?: "active" | "inactive"
  page?: number
  loadMore?: boolean
  status?: string
  error?: string
}

export function buildTeamCampsHref(input: TeamCampsHrefInput): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  if (input.campType) {
    params.set("type", input.campType)
  }

  if (input.campStatus) {
    params.set("campStatus", input.campStatus)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-camps?${query}` : "/team-camps"
}
