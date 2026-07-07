import { normalizeRequestedPage } from "./list-route-state.mjs"

const NAVIGATION_SCOPE_ORG_QUERY_KEY = "org"
const NAVIGATION_SCOPE_TEAM_QUERY_KEY = "team"
const TEAM_ASSESSMENT_TABS = ["created", "templates"]

export function resolveTeamAssessmentsTabDataRequest(input) {
  if (!TEAM_ASSESSMENT_TABS.includes(input.tabParam)) {
    return null
  }

  const requestedTab = input.tabParam

  return {
    requestedTab,
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode:
      input.loadMoreParam === "1" && requestedTab === "created",
  }
}

export function buildTeamAssessmentsTabDataUrl(input) {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrgId)

  if (input.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId)
  }

  if (
    input.tab === "created" &&
    typeof input.page === "number" &&
    Number.isFinite(input.page) &&
    input.page > 1
  ) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.tab === "created" && input.loadMore) {
    params.set("loadMore", "1")
  }

  return `/api/team-assessments/tab-data?${params.toString()}`
}
