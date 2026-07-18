import assert from "node:assert/strict"
import test from "node:test"

import {
  buildUsersPageHref,
  buildUsersRedirectPath,
  buildUsersTeamFilterHref,
  resolveUsersListRequest,
  resolveUsersPagination,
  shouldShowTeamMembershipInUsersList,
  USERS_TEAM_FILTER_QUERY_KEY,
} from "./list-route-state.mjs"

test("uses a dedicated Users Team filter query key", () => {
  assert.equal(USERS_TEAM_FILTER_QUERY_KEY, "teamFilter")
})

test("resolves Users page and load-more params defensively", () => {
  assert.deepEqual(
    resolveUsersListRequest({
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveUsersListRequest({
      pageParam: "-2",
      loadMoreParam: "true",
    }),
    {
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Users desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveUsersPagination({
      requestedPage: 8,
      totalItems: 52,
      accumulatePages: false,
      pageSize: 25,
    }),
    {
      currentPage: 3,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: false,
    },
  )

  assert.deepEqual(
    resolveUsersPagination({
      requestedPage: 2,
      totalItems: 52,
      accumulatePages: true,
      pageSize: 25,
    }),
    {
      currentPage: 2,
      pageCount: 3,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  )
})

test("hides all-view team rows when an organization row already represents the profile", () => {
  assert.equal(
    shouldShowTeamMembershipInUsersList({
      organizationProfileIds: ["profile-1"],
      profileId: "profile-1",
      selectedTeamId: undefined,
    }),
    false,
  )

  assert.equal(
    shouldShowTeamMembershipInUsersList({
      organizationProfileIds: ["profile-1"],
      profileId: "profile-1",
      selectedTeamId: "team-1",
    }),
    true,
  )
})

test("builds Users page hrefs while preserving Team filter and scope", () => {
  assert.equal(
    buildUsersPageHref({
      pathname: "/users",
      search: "org=org-1&team=active-team-1&teamFilter=team-filter-1&page=1",
      nextPage: 2,
    }),
    "/users?org=org-1&team=active-team-1&teamFilter=team-filter-1&page=2",
  )

  assert.equal(
    buildUsersPageHref({
      pathname: "/users",
      search: "org=org-1&team=active-team-1&teamFilter=team-filter-1&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/users?org=org-1&team=active-team-1&teamFilter=team-filter-1",
  )
})

test("builds Users mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildUsersPageHref({
      pathname: "/users",
      search: "org=org-1&team=active-team-1&teamFilter=team-filter-1",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/users?org=org-1&team=active-team-1&teamFilter=team-filter-1&page=2&loadMore=1",
  )
})

test("builds Users Team filter hrefs without stale action or paging state", () => {
  assert.equal(
    buildUsersTeamFilterHref({
      pathname: "/users",
      search: "org=org-1&team=active-team-1&teamFilter=team-old&page=3&loadMore=1&status=updated",
      nextTeamId: "team-new",
    }),
    "/users?org=org-1&team=active-team-1&teamFilter=team-new",
  )

  assert.equal(
    buildUsersTeamFilterHref({
      pathname: "/users",
      search: "org=org-1&team=active-team-1&teamFilter=team-old&page=2&error=forbidden",
      nextTeamId: null,
    }),
    "/users?org=org-1&team=active-team-1",
  )
})

test("builds Users action redirects preserving Team filter and pagination", () => {
  assert.equal(
    buildUsersRedirectPath({
      status: "updated",
      scopeOrgId: "org-1",
      scopeTeamId: "active-team-1",
      scopeUsersTeamId: "team-filter-1",
      scopePage: 3,
      scopeLoadMoreMode: true,
    }),
    "/users?status=updated&org=org-1&team=active-team-1&teamFilter=team-filter-1&page=3&loadMore=1",
  )

  assert.equal(
    buildUsersRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopePage: 1,
      scopeLoadMoreMode: true,
    }),
    "/users?error=forbidden&org=org-1",
  )
})
