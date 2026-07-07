import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamAssessmentsTabDataUrl,
  resolveTeamAssessmentsTabDataRequest,
} from "./tab-data-route-state.mjs"

test("rejects invalid Team Assessments tab-data tabs", () => {
  assert.equal(
    resolveTeamAssessmentsTabDataRequest({
      tabParam: "unknown",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    null,
  )
})

test("resolves Created tab-data pagination and load-more state", () => {
  assert.deepEqual(
    resolveTeamAssessmentsTabDataRequest({
      tabParam: "created",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedTab: "created",
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamAssessmentsTabDataRequest({
      tabParam: "created",
      pageParam: "-2",
      loadMoreParam: "0",
    }),
    {
      requestedTab: "created",
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Templates tab-data without load-more mode", () => {
  assert.deepEqual(
    resolveTeamAssessmentsTabDataRequest({
      tabParam: "templates",
      pageParam: "5",
      loadMoreParam: "1",
    }),
    {
      requestedTab: "templates",
      requestedPage: 5,
      requestedLoadMoreMode: false,
    },
  )
})

test("builds scoped Team Assessments tab-data URLs", () => {
  assert.equal(
    buildTeamAssessmentsTabDataUrl({
      activeOrgId: "org-1",
      activeTeamId: "team-1",
      tab: "created",
      page: 3,
      loadMore: true,
    }),
    "/api/team-assessments/tab-data?tab=created&org=org-1&team=team-1&page=3&loadMore=1",
  )

  assert.equal(
    buildTeamAssessmentsTabDataUrl({
      activeOrgId: "org-1",
      activeTeamId: null,
      tab: "templates",
      page: 3,
      loadMore: true,
    }),
    "/api/team-assessments/tab-data?tab=templates&org=org-1",
  )
})
