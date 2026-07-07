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

export function resolveTeamAssessmentTab(value) {
  return value === "templates" ? "templates" : "created"
}

export function resolveTeamAssessmentsListRequest(input) {
  const requestedTab = resolveTeamAssessmentTab(input.tabParam)

  return {
    requestedTab,
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1" && requestedTab === "created",
    requestedTemplateId:
      requestedTab === "templates" && input.templateParam
        ? input.templateParam
        : undefined,
    requestedNewTemplate:
      requestedTab === "templates" && input.newParam === "template",
  }
}

export function resolveAssessmentPagination(input) {
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

export function buildTeamAssessmentsPageHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)

  params.delete("template")
  params.delete("new")

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
    return "/team-assessments"
  }

  const url = new URL(value, "http://sailog.local")

  if (
    url.pathname !== "/team-assessments" &&
    !/^\/team-assessments\/[^/]+$/.test(url.pathname)
  ) {
    return "/team-assessments"
  }

  return `${url.pathname}${url.search}`
}

export function buildTeamAssessmentsRedirectPath(input) {
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

  if (input.tab && input.tab !== "created") {
    params.set("tab", input.tab)
  } else if (input.tab === "created") {
    params.delete("tab")
  }

  if (input.templateId) {
    params.set("template", input.templateId)
    params.delete("new")
  }

  if (input.newTemplate) {
    params.set("new", "template")
    params.delete("template")
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page))
  } else if (input.page !== undefined) {
    params.delete("page")
  }

  const query = params.toString()
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname
}
