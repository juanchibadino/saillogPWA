import assert from "node:assert/strict"
import test from "node:test"

import {
  buildVenueDetailPageHref,
  resolveVenueDetailRouteRequest,
} from "./detail-route-state.mjs"

test("normalizes Venue detail tab, year, page, loadMore, and highlight params", () => {
  assert.deepEqual(
    resolveVenueDetailRouteRequest({
      tabParam: "metrics",
      yearParam: "2026",
      memberParam: "member-1",
      pageParam: "3",
      loadMoreParam: "1",
      highlightParam: "yes",
    }),
    {
      selectedTab: "assessments",
      requestedYear: 2026,
      requestedPage: 3,
      requestedLoadMoreMode: true,
      requestedHighlight: "yes",
      requestedMemberId: "member-1",
    },
  )

  assert.deepEqual(
    resolveVenueDetailRouteRequest({
      tabParam: "unknown",
      yearParam: "not-a-year",
      pageParam: "-2",
      loadMoreParam: "0",
      highlightParam: "maybe",
      memberParam: "",
    }),
    {
      selectedTab: "camps",
      requestedYear: undefined,
      requestedPage: 1,
      requestedLoadMoreMode: false,
      requestedHighlight: undefined,
      requestedMemberId: undefined,
    },
  )
})

test("builds Venue detail URLs preserving scope and replacing tab or year state", () => {
  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "org=org-1&team=team-1&tab=sessions&year=2025&camp=camp-1&highlight=yes&page=4&loadMore=1",
      nextTab: "reports",
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=reports&year=2025",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "org=org-1&team=team-1&tab=sessions&year=2025&page=4&loadMore=1",
      nextYear: 2026,
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026",
  )
})

test("preserves venue expense member filter only on the expenses tab", () => {
  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=expenses&year=2026&page=2",
      nextMemberId: "member-1",
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=expenses&year=2026&member=member-1",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=expenses&year=2026&member=member-1&crew=others",
      nextMemberId: "",
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=expenses&year=2026",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=expenses&year=2026&member=member-1&crew=others",
      nextTab: "camps",
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=camps&year=2026",
  )
})

test("builds Venue detail pagination URLs with desktop and mobile load-more modes", () => {
  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=sessions&year=2026",
      nextPage: 3,
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026&page=3",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=sessions&year=2026&page=3",
      nextPage: 4,
      includeLoadMore: true,
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026&page=4&loadMore=1",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=sessions&year=2026&page=2&loadMore=1",
      nextPage: 1,
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026",
  )
})

test("builds Venue detail highlight URLs and resets stale session pagination", () => {
  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=sessions&year=2026&page=2&loadMore=1",
      nextHighlight: "no",
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026&highlight=no",
  )

  assert.equal(
    buildVenueDetailPageHref({
      pathname: "/venues/team-venue-1",
      search: "?org=org-1&team=team-1&tab=sessions&year=2026&highlight=yes&page=2",
      nextHighlight: null,
    }),
    "/venues/team-venue-1?org=org-1&team=team-1&tab=sessions&year=2026",
  )
})
