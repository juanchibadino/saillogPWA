import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamStandardMovesPageHref,
  buildTeamStandardMovesRedirectPath,
  resolveTeamStandardMovesListRequest,
  resolveTeamStandardMovesPagination,
} from "./list-route-state.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const TEAM_1 = "22222222-2222-4222-8222-222222222222"

test("resolves Team Standard Moves status page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamStandardMovesListRequest({
      statusFilterParam: "archived",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedStatusFilter: "archived",
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamStandardMovesListRequest({
      statusFilterParam: "deprecated",
      pageParam: "-2",
      loadMoreParam: "yes",
    }),
    {
      requestedStatusFilter: "active",
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Team Standard Moves desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamStandardMovesPagination({
      requestedPage: 8,
      totalItems: 76,
      accumulatePages: false,
      pageSize: 25,
    }),
    {
      currentPage: 4,
      pageCount: 4,
      hasPreviousPage: true,
      hasNextPage: false,
    },
  )

  assert.deepEqual(
    resolveTeamStandardMovesPagination({
      requestedPage: 2,
      totalItems: 76,
      accumulatePages: true,
      pageSize: 25,
    }),
    {
      currentPage: 2,
      pageCount: 4,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  )
})

test("builds Team Standard Moves page hrefs while preserving route state", () => {
  assert.equal(
    buildTeamStandardMovesPageHref({
      pathname: "/team-standard-moves",
      search: "org=org-1&team=team-1&statusFilter=archived&page=1",
      nextPage: 2,
    }),
    "/team-standard-moves?org=org-1&team=team-1&statusFilter=archived&page=2",
  )

  assert.equal(
    buildTeamStandardMovesPageHref({
      pathname: "/team-standard-moves",
      search: "org=org-1&team=team-1&statusFilter=all&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-standard-moves?org=org-1&team=team-1&statusFilter=all",
  )
})

test("builds Team Standard Moves mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamStandardMovesPageHref({
      pathname: "/team-standard-moves",
      search: "org=org-1&team=team-1&statusFilter=active",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-standard-moves?org=org-1&team=team-1&statusFilter=active&page=2&loadMore=1",
  )
})

test("builds Team Standard Moves action redirects while preserving route state", () => {
  assert.equal(
    buildTeamStandardMovesRedirectPath({
      status: "created",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "archived",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    `/team-standard-moves?status=created&org=${ORG_1}&team=${TEAM_1}&statusFilter=archived&page=3&loadMore=1`,
  )

  assert.equal(
    buildTeamStandardMovesRedirectPath({
      status: "updated",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "active",
      scopePage: 2,
      scopeLoadMore: false,
    }),
    `/team-standard-moves?status=updated&org=${ORG_1}&team=${TEAM_1}&statusFilter=active&page=2`,
  )

  assert.equal(
    buildTeamStandardMovesRedirectPath({
      status: "archived",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "all",
      scopePage: 4,
      scopeLoadMore: true,
    }),
    `/team-standard-moves?status=archived&org=${ORG_1}&team=${TEAM_1}&statusFilter=all&page=4&loadMore=1`,
  )

  assert.equal(
    buildTeamStandardMovesRedirectPath({
      status: "restored",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "archived",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-standard-moves?status=restored&org=${ORG_1}&team=${TEAM_1}&statusFilter=archived`,
  )
})

test("builds Team Standard Moves action error redirects defensively", () => {
  assert.equal(
    buildTeamStandardMovesRedirectPath({
      error: "forbidden",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "all",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    `/team-standard-moves?error=forbidden&org=${ORG_1}&team=${TEAM_1}&statusFilter=all&page=3&loadMore=1`,
  )

  assert.equal(
    buildTeamStandardMovesRedirectPath({
      error: "invalid_input",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "deprecated",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-standard-moves?error=invalid_input&org=${ORG_1}&team=${TEAM_1}`,
  )
})
