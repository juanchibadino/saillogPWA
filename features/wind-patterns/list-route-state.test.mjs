import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamWindPatternsPageHref,
  buildTeamWindPatternsRedirectPath,
  resolveTeamWindPatternsListRequest,
  resolveTeamWindPatternsPagination,
} from "./list-route-state.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const TEAM_1 = "22222222-2222-4222-8222-222222222222"

test("resolves Team Wind Patterns status page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamWindPatternsListRequest({
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
    resolveTeamWindPatternsListRequest({
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

test("resolves Team Wind Patterns desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamWindPatternsPagination({
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
    resolveTeamWindPatternsPagination({
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

test("builds Team Wind Patterns page hrefs while preserving route state", () => {
  assert.equal(
    buildTeamWindPatternsPageHref({
      pathname: "/team-wind-patterns",
      search: "org=org-1&team=team-1&statusFilter=archived&page=1",
      nextPage: 2,
    }),
    "/team-wind-patterns?org=org-1&team=team-1&statusFilter=archived&page=2",
  )

  assert.equal(
    buildTeamWindPatternsPageHref({
      pathname: "/team-wind-patterns",
      search: "org=org-1&team=team-1&statusFilter=all&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-wind-patterns?org=org-1&team=team-1&statusFilter=all",
  )
})

test("builds Team Wind Patterns mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamWindPatternsPageHref({
      pathname: "/team-wind-patterns",
      search: "org=org-1&team=team-1&statusFilter=active",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-wind-patterns?org=org-1&team=team-1&statusFilter=active&page=2&loadMore=1",
  )
})

test("builds Team Wind Patterns action redirects while preserving route state", () => {
  assert.equal(
    buildTeamWindPatternsRedirectPath({
      status: "wind_pattern_created",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "archived",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    `/team-wind-patterns?status=wind_pattern_created&org=${ORG_1}&team=${TEAM_1}&statusFilter=archived&page=3&loadMore=1`,
  )

  assert.equal(
    buildTeamWindPatternsRedirectPath({
      status: "wind_pattern_updated",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "active",
      scopePage: 2,
      scopeLoadMore: false,
    }),
    `/team-wind-patterns?status=wind_pattern_updated&org=${ORG_1}&team=${TEAM_1}&statusFilter=active&page=2`,
  )

  assert.equal(
    buildTeamWindPatternsRedirectPath({
      status: "wind_pattern_archived",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "all",
      scopePage: 4,
      scopeLoadMore: true,
    }),
    `/team-wind-patterns?status=wind_pattern_archived&org=${ORG_1}&team=${TEAM_1}&statusFilter=all&page=4&loadMore=1`,
  )

  assert.equal(
    buildTeamWindPatternsRedirectPath({
      status: "wind_pattern_restored",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "archived",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-wind-patterns?status=wind_pattern_restored&org=${ORG_1}&team=${TEAM_1}&statusFilter=archived`,
  )
})

test("builds Team Wind Patterns action error redirects defensively", () => {
  assert.equal(
    buildTeamWindPatternsRedirectPath({
      error: "forbidden",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "all",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    `/team-wind-patterns?error=forbidden&org=${ORG_1}&team=${TEAM_1}&statusFilter=all&page=3&loadMore=1`,
  )

  assert.equal(
    buildTeamWindPatternsRedirectPath({
      error: "invalid_input",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeStatus: "deprecated",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-wind-patterns?error=invalid_input&org=${ORG_1}&team=${TEAM_1}`,
  )
})
