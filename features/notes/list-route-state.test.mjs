import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamNotesHref,
  buildTeamNotesPageHref,
  getMultiSearchParamValues,
  resolveTeamNotesListRequest,
} from "./list-route-state.mjs"

test("resolves Team Notes search filters page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamNotesListRequest({
      searchQueryParam: "  downwind  ",
      venueParam: " venue-1 ",
      twsParam: [" 8-10 ", "12-14"],
      conditionsParam: "Choppy",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedSearchQuery: "downwind",
      requestedVenueId: "venue-1",
      requestedTwsValues: ["8-10", "12-14"],
      requestedConditionsValues: ["Choppy"],
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamNotesListRequest({
      searchQueryParam: undefined,
      venueParam: " ",
      twsParam: undefined,
      conditionsParam: ["", "  "],
      pageParam: "-2",
      loadMoreParam: "yes",
    }),
    {
      requestedSearchQuery: "",
      requestedVenueId: undefined,
      requestedTwsValues: [],
      requestedConditionsValues: [],
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("normalizes multi-value params from string and array inputs", () => {
  assert.deepEqual(getMultiSearchParamValues("  Flat water  "), ["Flat water"])
  assert.deepEqual(getMultiSearchParamValues([" 8-10 ", "", " 12-14 "]), [
    "8-10",
    "12-14",
  ])
})

test("builds Team Notes filter hrefs while preserving scope", () => {
  assert.equal(
    buildTeamNotesHref({
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      searchQuery: "  start  ",
      venueId: "venue-1",
      twsValues: ["8-10", "12-14"],
      conditionsValues: ["Choppy"],
      page: 1,
    }),
    "/team-notes?org=org-1&team=team-1&q=start&venue=venue-1&tws=8-10&tws=12-14&conditions=Choppy",
  )

  assert.equal(
    buildTeamNotesHref({
      scopeOrgId: "org-1",
      scopeTeamId: null,
      searchQuery: "",
      venueId: undefined,
      twsValues: [],
      conditionsValues: [],
      page: 1,
    }),
    "/team-notes?org=org-1",
  )
})

test("builds Team Notes mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamNotesPageHref({
      pathname: "/team-notes",
      search: "org=org-1&team=team-1&q=start&venue=venue-1&tws=8-10",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-notes?org=org-1&team=team-1&q=start&venue=venue-1&tws=8-10&page=2&loadMore=1",
  )
})

test("clears Team Notes page and loadMore params when returning to page one", () => {
  assert.equal(
    buildTeamNotesPageHref({
      pathname: "/team-notes",
      search: "?org=org-1&team=team-1&page=3&loadMore=1&conditions=Flat",
      nextPage: 1,
      includeLoadMore: true,
    }),
    "/team-notes?org=org-1&team=team-1&conditions=Flat",
  )
})
