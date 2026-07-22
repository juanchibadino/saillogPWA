const TEAM_EXPENSE_SCOPE_VALUES = new Set(["mine", "team"])
const TEAM_EXPENSE_CREW_FILTER_VALUES = new Set(["all", "you"])
const TEAM_EXPENSE_TYPE_VALUES = new Set([
  "meals",
  "accommodation",
  "transport",
  "fuel",
  "marina_fees",
  "race_fees",
  "supplies",
  "gear",
  "coaching",
  "other",
])

export function normalizeTeamExpensePage(value) {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

export function normalizeTeamExpenseYear(value) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 3000) {
    return undefined
  }

  return Math.floor(parsed)
}

export function normalizeTeamExpenseScope(value, teamScopeAllowed = false) {
  if (!value || !TEAM_EXPENSE_SCOPE_VALUES.has(value)) {
    return "mine"
  }

  if (value === "team" && !teamScopeAllowed) {
    return "mine"
  }

  return value
}

export function normalizeTeamExpenseCrewFilter(value) {
  if (!value || !TEAM_EXPENSE_CREW_FILTER_VALUES.has(value)) {
    return undefined
  }

  return value
}

export function normalizeTeamExpenseType(value) {
  if (!value || !TEAM_EXPENSE_TYPE_VALUES.has(value)) {
    return undefined
  }

  return value
}

export function normalizeTeamExpenseSelectedId(value, allowedIds) {
  if (!value || !allowedIds.has(value)) {
    return undefined
  }

  return value
}

export function resolveTeamExpensesListRequest(input) {
  return {
    requestedCampId: input.campParam || undefined,
    requestedCrewFilter: normalizeTeamExpenseCrewFilter(input.crewParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
    requestedMemberId: input.memberParam || undefined,
    requestedPage: normalizeTeamExpensePage(input.pageParam),
    requestedScope: input.scopeParam || undefined,
    requestedType: normalizeTeamExpenseType(input.typeParam),
    requestedVenueId: input.venueParam || undefined,
    requestedYear: normalizeTeamExpenseYear(input.yearParam),
  }
}

export function resolveTeamExpensesPagination(input) {
  const pageCount = Math.max(
    1,
    Math.ceil(input.totalItems / input.pageSize),
  )
  const currentPage = Math.min(input.requestedPage, pageCount)

  return {
    currentPage,
    pageCount,
    hasPreviousPage: input.accumulatePages ? false : currentPage > 1,
    hasNextPage: currentPage < pageCount,
  }
}

export function buildTeamExpensesPageHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)

  if (input.nextPage <= 1) {
    params.delete("page")
    params.delete("loadMore")
  } else {
    params.set("page", String(Math.floor(input.nextPage)))

    if (input.includeLoadMore) {
      params.set("loadMore", "1")
    } else {
      params.delete("loadMore")
    }
  }

  const nextSearch = params.toString()
  return nextSearch.length > 0 ? `${input.pathname}?${nextSearch}` : input.pathname
}

export function buildTeamExpensesFiltersHref(input) {
  const params = new URLSearchParams()

  if (input.scope?.activeOrgId) {
    params.set("org", input.scope.activeOrgId)
  }

  if (input.scope?.activeTeamId) {
    params.set("team", input.scope.activeTeamId)
  }

  const visibilityScope = normalizeTeamExpenseScope(
    input.visibilityScope,
    input.teamScopeAllowed === true,
  )
  const crewFilter = normalizeTeamExpenseCrewFilter(input.crewFilter)
  const year = normalizeTeamExpenseYear(input.year)
  const type = normalizeTeamExpenseType(input.expenseType)

  if (visibilityScope !== "mine") {
    params.set("scope", visibilityScope)
  }

  if (typeof year === "number") {
    params.set("year", String(year))
  }

  if (crewFilter && crewFilter !== "all") {
    params.set("crew", crewFilter)
  }

  if (input.teamVenueId) {
    params.set("venue", input.teamVenueId)
  }

  if (input.campId) {
    params.set("camp", input.campId)
  }

  if (input.memberId) {
    params.set("member", input.memberId)
  }

  if (type) {
    params.set("type", type)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-expenses?${query}` : "/team-expenses"
}

export function buildTeamExpensesReportHref(input) {
  const params = new URLSearchParams()

  if (input.scope?.activeOrgId) {
    params.set("org", input.scope.activeOrgId)
  }

  if (input.scope?.activeTeamId) {
    params.set("team", input.scope.activeTeamId)
  }

  params.set(
    "scope",
    normalizeTeamExpenseScope(input.visibilityScope, input.teamScopeAllowed === true),
  )

  const year = normalizeTeamExpenseYear(input.year)
  const crewFilter = normalizeTeamExpenseCrewFilter(input.crewFilter)
  const type = normalizeTeamExpenseType(input.expenseType)

  if (typeof year === "number") {
    params.set("year", String(year))
  }

  if (crewFilter && crewFilter !== "all") {
    params.set("crew", crewFilter)
  }

  if (input.teamVenueId) {
    params.set("venue", input.teamVenueId)
  }

  if (input.campId) {
    params.set("camp", input.campId)
  }

  if (input.memberId) {
    params.set("member", input.memberId)
  }

  if (type) {
    params.set("type", type)
  }

  return `/api/team-expenses/report/pdf?${params.toString()}`
}
