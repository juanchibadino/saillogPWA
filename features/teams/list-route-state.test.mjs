import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamsPageHref,
  buildTeamsRedirectPath,
  resolveTeamsListRequest,
  resolveTeamsPagination,
} from "./list-route-state.mjs"

test("resolves Teams page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamsListRequest({
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamsListRequest({
      pageParam: "-2",
      loadMoreParam: "true",
    }),
    {
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Teams desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamsPagination({
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
    resolveTeamsPagination({
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

test("builds Teams page hrefs while preserving navigation scope", () => {
  assert.equal(
    buildTeamsPageHref({
      pathname: "/teams",
      search: "org=org-1&team=team-1&page=1",
      nextPage: 2,
    }),
    "/teams?org=org-1&team=team-1&page=2",
  )

  assert.equal(
    buildTeamsPageHref({
      pathname: "/teams",
      search: "org=org-1&team=team-1&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/teams?org=org-1&team=team-1",
  )
})

test("builds Teams mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamsPageHref({
      pathname: "/teams",
      search: "org=org-1&team=team-1",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/teams?org=org-1&team=team-1&page=2&loadMore=1",
  )
})

test("builds Teams create redirects preserving page and load-more state", () => {
  assert.equal(
    buildTeamsRedirectPath({
      status: "created",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopePage: 3,
      scopeLoadMoreMode: true,
    }),
    "/teams?status=created&org=org-1&team=team-1&page=3&loadMore=1",
  )

  assert.equal(
    buildTeamsRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopePage: 1,
      scopeLoadMoreMode: true,
    }),
    "/teams?error=forbidden&org=org-1",
  )
})
