export const USERS_TEAM_FILTER_QUERY_KEY = "teamFilter"

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

export function resolveUsersListRequest(input) {
  return {
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
  }
}

export function resolveUsersPagination(input) {
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

export function shouldShowTeamMembershipInUsersList(input) {
  if (input.selectedTeamId) {
    return true
  }

  return !input.organizationProfileIds.includes(input.profileId)
}

export function buildUsersPageHref(input) {
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

export function buildUsersTeamFilterHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)

  params.delete("page")
  params.delete("loadMore")
  params.delete("status")
  params.delete("error")

  if (input.nextTeamId) {
    params.set(USERS_TEAM_FILTER_QUERY_KEY, input.nextTeamId)
  } else {
    params.delete(USERS_TEAM_FILTER_QUERY_KEY)
  }

  const nextSearch = params.toString()
  return nextSearch.length > 0 ? `${input.pathname}?${nextSearch}` : input.pathname
}

export function buildUsersRedirectPath(input) {
  const params = new URLSearchParams()

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

  if (input.scopeUsersTeamId) {
    params.set(USERS_TEAM_FILTER_QUERY_KEY, input.scopeUsersTeamId)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(Math.floor(input.scopePage)))

    if (input.scopeLoadMoreMode) {
      params.set("loadMore", "1")
    }
  }

  const query = params.toString()
  return query.length > 0 ? `/users?${query}` : "/users"
}
