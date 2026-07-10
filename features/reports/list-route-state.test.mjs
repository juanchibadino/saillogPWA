import assert from "node:assert/strict"
import test from "node:test"

import {
  buildReportsPageHref,
  resolveReportsListRequest,
  resolveReportsPagination,
} from "./list-route-state.mjs"

test("resolves Reports page and load-more params defensively", () => {
  assert.deepEqual(
    resolveReportsListRequest({
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveReportsListRequest({
      pageParam: "-2",
      loadMoreParam: "true",
    }),
    {
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Reports desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveReportsPagination({
      requestedPage: 8,
      totalItems: 52,
      accumulatePages: false,
      pageSize: 10,
    }),
    {
      currentPage: 6,
      pageCount: 6,
      hasPreviousPage: true,
      hasNextPage: false,
    },
  )

  assert.deepEqual(
    resolveReportsPagination({
      requestedPage: 2,
      totalItems: 52,
      accumulatePages: true,
      pageSize: 10,
    }),
    {
      currentPage: 2,
      pageCount: 6,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  )
})

test("builds Reports page hrefs while preserving filters and scope", () => {
  assert.equal(
    buildReportsPageHref({
      pathname: "/reports",
      search: "org=org-1&year=2026&team=team-1&venue=venue-1&page=1",
      nextPage: 2,
    }),
    "/reports?org=org-1&year=2026&team=team-1&venue=venue-1&page=2",
  )

  assert.equal(
    buildReportsPageHref({
      pathname: "/team-reports",
      search: "org=org-1&team=team-1&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-reports?org=org-1&team=team-1",
  )
})

test("builds Reports mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildReportsPageHref({
      pathname: "/team-reports",
      search: "org=org-1&team=team-1",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-reports?org=org-1&team=team-1&page=2&loadMore=1",
  )
})
