export function normalizeRequestedPage(value) {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

export function resolveTeamVenueStatusFilter(value) {
  if (value === "deprecated") {
    return "deprecated"
  }

  return "active"
}

export function resolveTeamVenuesListRequest(input) {
  return {
    requestedStatusFilter: resolveTeamVenueStatusFilter(input.statusParam),
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
  }
}

export function resolveTeamVenuePagination(input) {
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

export function buildTeamVenuesPageHref(input) {
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

export function buildTeamVenuesRedirectPath(input) {
  const params = new URLSearchParams()

  if (input.result) {
    params.set("result", input.result)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  if (input.scopeStatus === "active" || input.scopeStatus === "deprecated") {
    params.set("status", input.scopeStatus)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(Math.floor(input.scopePage)))

    if (input.scopeLoadMore) {
      params.set("loadMore", "1")
    }
  }

  if (input.cacheTeamVenueId) {
    params.set("cacheTeamVenue", input.cacheTeamVenueId)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-venues?${query}` : "/team-venues"
}
