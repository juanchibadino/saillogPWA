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

export function resolveReportsListRequest(input) {
  return {
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
  }
}

export function resolveReportsPagination(input) {
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

export function buildReportsPageHref(input) {
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
