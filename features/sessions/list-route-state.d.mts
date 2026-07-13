export type TeamSessionHighlightFilter = "yes" | "no"

export type TeamSessionsPaginationInput = {
  requestedPage: number
  totalItems: number
  accumulatePages: boolean
  pageSize: number
}

export type TeamSessionsPaginationResult = {
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type TeamSessionsListRequestInput = {
  pageParam?: string
  loadMoreParam?: string
  highlightParam?: string
}

export type TeamSessionsListRequest = {
  requestedPage: number
  requestedLoadMoreMode: boolean
  requestedHighlight?: TeamSessionHighlightFilter
}

export type TeamSessionsPageHrefInput = {
  pathname: string
  search?: string
  nextPage: number
  includeLoadMore?: boolean
}

export type TeamSessionsRedirectInput = {
  cacheCampId?: string | null
  cacheSessionId?: string | null
  cacheTeamVenueId?: string | null
  returnPath?: string
  status?: "created" | "updated" | "deleted"
  error?:
    | "invalid_input"
    | "forbidden"
    | "create_failed"
    | "update_failed"
    | "delete_failed"
    | "plan_limit_reached"
    | "payment_required"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeCampId?: string
  scopeHighlight?: TeamSessionHighlightFilter
  scopePage?: number
}

export type TeamSessionDetailRedirectInput = {
  cacheCampId?: string | null
  cacheSessionId?: string | null
  cacheTeamVenueId?: string | null
  error?: "invalid_input" | "forbidden" | "create_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  sessionId: string
  status?: "created"
}

export function normalizeRequestedPage(value: string | undefined): number

export function normalizeSelectedId(input: {
  selectedId?: string
  allowedIds: Set<string>
}): string | undefined

export function resolveHighlightFilter(
  value: string | undefined,
): TeamSessionHighlightFilter | undefined

export function resolveTeamSessionsListRequest(
  input: TeamSessionsListRequestInput,
): TeamSessionsListRequest

export function resolveSessionPagination(
  input: TeamSessionsPaginationInput,
): TeamSessionsPaginationResult

export function buildTeamSessionsPageHref(input: TeamSessionsPageHrefInput): string

export function buildTeamSessionsRedirectPath(
  input: TeamSessionsRedirectInput,
): string

export function buildTeamSessionDetailRedirectPath(
  input: TeamSessionDetailRedirectInput,
): string
