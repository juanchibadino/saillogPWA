export type TeamAssessmentTab = "created" | "templates"

export function normalizeRequestedPage(value: string | undefined): number

export function resolveTeamAssessmentTab(value: string | undefined): TeamAssessmentTab

export function resolveTeamAssessmentsListRequest(input: {
  tabParam?: string
  pageParam?: string
  loadMoreParam?: string
  templateParam?: string
  newParam?: string
}): {
  requestedTab: TeamAssessmentTab
  requestedPage: number
  requestedLoadMoreMode: boolean
  requestedTemplateId?: string
  requestedNewTemplate: boolean
}

export function resolveAssessmentPagination(input: {
  requestedPage: number
  totalItems: number
  accumulatePages: boolean
  pageSize: number
}): {
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export function getTeamAssessmentStatusMessage(
  status: string | undefined,
): string | null

export function buildTeamAssessmentsPageHref(input: {
  pathname: string
  search?: string
  nextPage: number
  includeLoadMore?: boolean
}): string

export function buildTeamAssessmentsRedirectPath(input: {
  returnPath?: string
  status?: string
  error?: string
  scopeOrgId?: string
  scopeTeamId?: string
  tab?: TeamAssessmentTab
  templateId?: string
  newTemplate?: boolean
  page?: number
  notifyAssessmentRun?: boolean
  notifyAssessmentRunId?: string
  notifyAssessmentTeamVenueId?: string
}): string
