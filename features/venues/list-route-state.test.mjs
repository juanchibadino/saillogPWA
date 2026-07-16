import assert from "node:assert/strict"
import test from "node:test"

import {
  buildVenueStatusHref,
  buildVenuesPageHref,
  resolveVenuesListRequest,
  resolveVenuesPagination,
} from "./list-route-state.mjs"

test("resolves Venue status page and load-more params defensively", () => {
  assert.deepEqual(
    resolveVenuesListRequest({
      statusParam: "active",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedStatusFilter: "active",
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveVenuesListRequest({
      statusParam: "archived",
      pageParam: "-2",
      loadMoreParam: "true",
    }),
    {
      requestedStatusFilter: "all",
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Venue desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveVenuesPagination({
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
    resolveVenuesPagination({
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

test("builds Venue page hrefs while preserving status filter and scope", () => {
  assert.equal(
    buildVenuesPageHref({
      pathname: "/venues",
      search: "org=org-1&team=team-1&venueStatus=inactive&page=1",
      nextPage: 2,
    }),
    "/venues?org=org-1&team=team-1&venueStatus=inactive&page=2",
  )

  assert.equal(
    buildVenuesPageHref({
      pathname: "/venues",
      search: "org=org-1&team=team-1&venueStatus=active&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/venues?org=org-1&team=team-1&venueStatus=active",
  )
})

test("builds Venue mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildVenuesPageHref({
      pathname: "/venues",
      search: "org=org-1&team=team-1&venueStatus=inactive",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/venues?org=org-1&team=team-1&venueStatus=inactive&page=2&loadMore=1",
  )
})

test("builds Venue status hrefs without colliding with action feedback status", () => {
  assert.equal(
    buildVenueStatusHref({
      pathname: "/venues",
      search: "org=org-1&team=team-1&venueStatus=active&page=3&loadMore=1&status=created",
      nextStatus: "inactive",
    }),
    "/venues?org=org-1&team=team-1&venueStatus=inactive",
  )

  assert.equal(
    buildVenueStatusHref({
      pathname: "/venues",
      search: "org=org-1&team=team-1&venueStatus=inactive&page=2",
      nextStatus: "all",
    }),
    "/venues?org=org-1&team=team-1",
  )
})
