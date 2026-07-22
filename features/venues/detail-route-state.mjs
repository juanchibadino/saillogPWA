export const VENUE_DETAIL_TABS = [
  "camps",
  "sessions",
  "wind-patterns",
  "assessments",
  "reports",
  "expenses",
]

export function resolveVenueDetailTab(value) {
  if (value === "metrics") {
    return "assessments"
  }

  return VENUE_DETAIL_TABS.includes(value) ? value : "camps"
}

export function normalizeVenueDetailYear(value) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 3000) {
    return undefined
  }

  return parsed
}

export function normalizeVenueDetailPage(value) {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

export function resolveVenueDetailHighlightFilter(value) {
  if (value === "yes" || value === "no") {
    return value
  }

  return undefined
}

export function resolveVenueDetailRouteRequest(input) {
  return {
    selectedTab: resolveVenueDetailTab(input.tabParam),
    requestedYear: normalizeVenueDetailYear(input.yearParam),
    requestedPage: normalizeVenueDetailPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
    requestedHighlight: resolveVenueDetailHighlightFilter(input.highlightParam),
    requestedMemberId: input.memberParam || undefined,
  }
}

export function buildVenueDetailPageHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)

  if (input.nextTab) {
    params.set("tab", input.nextTab)
  }

  if (typeof input.nextYear === "number" && Number.isFinite(input.nextYear)) {
    params.set("year", String(Math.floor(input.nextYear)))
  }

  if (input.nextHighlight === null) {
    params.delete("highlight")
  } else if (input.nextHighlight) {
    params.set("highlight", input.nextHighlight)
  }

  if (input.nextMemberId === null) {
    params.delete("member")
  } else if (typeof input.nextMemberId === "string") {
    const trimmedMemberId = input.nextMemberId.trim()

    if (trimmedMemberId.length > 0) {
      params.set("member", trimmedMemberId)
    } else {
      params.delete("member")
    }
  }

  params.delete("crew")

  const resolvedTab = input.nextTab ?? params.get("tab")

  if (resolvedTab !== "sessions") {
    params.delete("camp")
    params.delete("highlight")
  }

  if (resolvedTab !== "expenses") {
    params.delete("member")
  }

  const shouldResetPage =
    input.resetPage === true ||
    typeof input.nextTab !== "undefined" ||
    typeof input.nextYear !== "undefined" ||
    typeof input.nextHighlight !== "undefined" ||
    typeof input.nextMemberId !== "undefined"

  if (shouldResetPage) {
    params.delete("page")
    params.delete("loadMore")
  } else if (typeof input.nextPage === "number" && Number.isFinite(input.nextPage)) {
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
  }

  const nextSearch = params.toString()
  return nextSearch.length > 0 ? `${input.pathname}?${nextSearch}` : input.pathname
}
