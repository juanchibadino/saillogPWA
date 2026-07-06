import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamCampsPageHref,
  normalizeSelectedId,
  resolveCampPagination,
  resolveTeamCampsListRequest,
} from "./list-route-state.mjs"

test("normalizes invalid Team Camps venue filters away", () => {
  assert.equal(
    normalizeSelectedId({
      selectedId: "venue-missing",
      allowedIds: new Set(["venue-1", "venue-2"]),
    }),
    undefined,
  )
  assert.equal(
    normalizeSelectedId({
      selectedId: "venue-1",
      allowedIds: new Set(["venue-1", "venue-2"]),
    }),
    "venue-1",
  )
})

test("resolves Team Camps list request params defensively", () => {
  assert.deepEqual(
    resolveTeamCampsListRequest({
      pageParam: "-2",
      loadMoreParam: "0",
      typeParam: "offshore",
      campStatusParam: "archived",
    }),
    {
      requestedPage: 1,
      requestedLoadMoreMode: false,
      requestedCampType: undefined,
      requestedCampStatus: undefined,
    },
  )
  assert.deepEqual(
    resolveTeamCampsListRequest({
      pageParam: "4",
      loadMoreParam: "1",
      typeParam: "regatta",
      campStatusParam: "inactive",
    }),
    {
      requestedPage: 4,
      requestedLoadMoreMode: true,
      requestedCampType: "regatta",
      requestedCampStatus: "inactive",
    },
  )
})

test("resolves Team Camps desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveCampPagination({
      requestedPage: 7,
      totalItems: 64,
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
    resolveCampPagination({
      requestedPage: 2,
      totalItems: 64,
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

test("builds Team Camps page hrefs while preserving filters", () => {
  assert.equal(
    buildTeamCampsPageHref({
      pathname: "/team-camps",
      search: "org=org-1&team=team-1&venue=venue-1&type=mixed&campStatus=active&page=1",
      nextPage: 2,
    }),
    "/team-camps?org=org-1&team=team-1&venue=venue-1&type=mixed&campStatus=active&page=2",
  )
  assert.equal(
    buildTeamCampsPageHref({
      pathname: "/team-camps",
      search: "org=org-1&team=team-1&venue=venue-1&type=training&campStatus=inactive&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-camps?org=org-1&team=team-1&venue=venue-1&type=training&campStatus=inactive",
  )
})

test("builds Team Camps mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamCampsPageHref({
      pathname: "/team-camps",
      search: "org=org-1&team=team-1&type=regatta&campStatus=active",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-camps?org=org-1&team=team-1&type=regatta&campStatus=active&page=2&loadMore=1",
  )
})
