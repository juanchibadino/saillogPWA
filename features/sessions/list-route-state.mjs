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

export function normalizeSelectedId(input) {
  if (!input.selectedId) {
    return undefined
  }

  if (!input.allowedIds.has(input.selectedId)) {
    return undefined
  }

  return input.selectedId
}

export function resolveHighlightFilter(value) {
  if (value === "yes" || value === "no") {
    return value
  }

  return undefined
}

export function resolveTeamSessionsListRequest(input) {
  return {
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
    requestedHighlight: resolveHighlightFilter(input.highlightParam),
  }
}

export function resolveSessionPagination(input) {
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

export function buildTeamSessionsPageHref(input) {
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

function normalizeActionReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/team-sessions"
  }

  const url = new URL(value, "http://sailog.local")

  if (
    url.pathname !== "/team-sessions" &&
    !url.pathname.startsWith("/team-camps/") &&
    !url.pathname.startsWith("/venues/")
  ) {
    return "/team-sessions"
  }

  return `${url.pathname}${url.search}`
}

export function buildTeamSessionsRedirectPath(input) {
  const returnPath = normalizeActionReturnPath(input.returnPath)
  const url = new URL(returnPath, "http://sailog.local")
  const params = url.searchParams

  params.delete("status")
  params.delete("error")
  params.delete("loadMore")

  if (input.status) {
    params.set("status", input.status)
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

  if (input.scopeVenueId) {
    params.set("venue", input.scopeVenueId)
  }

  if (input.scopeCampId) {
    params.set("camp", input.scopeCampId)
  }

  if (input.scopeHighlight) {
    params.set("highlight", input.scopeHighlight)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(input.scopePage))
  } else {
    params.delete("page")
  }

  const query = params.toString()
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname
}
