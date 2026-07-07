import type { TeamAssessmentTab } from "./list-route-state.mjs"

export function resolveTeamAssessmentsTabDataRequest(input: {
  tabParam?: string
  pageParam?: string
  loadMoreParam?: string
}): {
  requestedTab: TeamAssessmentTab
  requestedPage: number
  requestedLoadMoreMode: boolean
} | null

export function buildTeamAssessmentsTabDataUrl(input: {
  activeOrgId: string
  activeTeamId?: string | null
  tab: TeamAssessmentTab
  page?: number
  loadMore?: boolean
}): string
