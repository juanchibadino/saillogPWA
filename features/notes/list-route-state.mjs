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

export function normalizeSearchQuery(value) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

export function normalizeSelectedId(value) {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function getMultiSearchParamValues(value) {
  if (!value) {
    return []
  }

  const items = Array.isArray(value) ? value : [value]
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
}

export function resolveTeamNotesListRequest(input) {
  return {
    requestedSearchQuery: normalizeSearchQuery(input.searchQueryParam),
    requestedVenueId: normalizeSelectedId(input.venueParam),
    requestedTwsValues: getMultiSearchParamValues(input.twsParam),
    requestedConditionsValues: getMultiSearchParamValues(input.conditionsParam),
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
  }
}

export function buildTeamNotesHref(input) {
  const params = new URLSearchParams()

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  const searchQuery = normalizeSearchQuery(input.searchQuery)
  if (searchQuery.length > 0) {
    params.set("q", searchQuery)
  }

  const venueId = normalizeSelectedId(input.venueId)
  if (venueId) {
    params.set("venue", venueId)
  }

  for (const twsValue of input.twsValues ?? []) {
    const normalizedValue = normalizeSearchQuery(twsValue)

    if (normalizedValue.length > 0) {
      params.append("tws", normalizedValue)
    }
  }

  for (const conditionValue of input.conditionsValues ?? []) {
    const normalizedValue = normalizeSearchQuery(conditionValue)

    if (normalizedValue.length > 0) {
      params.append("conditions", normalizedValue)
    }
  }

  const page = normalizeRequestedPage(input.page)
  if (page > 1) {
    params.set("page", String(page))

    if (input.loadMore === true) {
      params.set("loadMore", "1")
    }
  }

  const query = params.toString()
  return query.length > 0 ? `/team-notes?${query}` : "/team-notes"
}

export function buildTeamNotesPageHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)
  const nextPage = normalizeRequestedPage(input.nextPage)

  if (nextPage <= 1) {
    params.delete("page")
    params.delete("loadMore")
  } else {
    params.set("page", String(nextPage))

    if (input.includeLoadMore) {
      params.set("loadMore", "1")
    } else {
      params.delete("loadMore")
    }
  }

  const nextSearch = params.toString()
  return nextSearch.length > 0 ? `${input.pathname}?${nextSearch}` : input.pathname
}
