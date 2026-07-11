import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamGearFiltersHref,
  buildTeamGearPageHref,
  buildTeamGearRedirectPath,
  resolveTeamGearListRequest,
  resolveTeamGearPagination,
} from "./list-route-state.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const TEAM_1 = "22222222-2222-4222-8222-222222222222"

test("resolves Team Gear filters page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamGearListRequest({
      typeParam: "sails",
      statusFilterParam: "active_regatta",
      conditionParam: "refurbished",
      alertParam: "critical",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedType: "sails",
      requestedStatusFilter: "active_regatta",
      requestedCondition: "refurbished",
      requestedAlert: "critical",
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamGearListRequest({
      typeParam: "boat",
      statusFilterParam: "active",
      conditionParam: "broken",
      alertParam: "urgent",
      pageParam: "-2",
      loadMoreParam: "yes",
    }),
    {
      requestedType: undefined,
      requestedStatusFilter: undefined,
      requestedCondition: undefined,
      requestedAlert: undefined,
      requestedPage: 1,
      requestedLoadMoreMode: false,
    },
  )
})

test("resolves Team Gear desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamGearPagination({
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
    resolveTeamGearPagination({
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

test("builds Team Gear page hrefs while preserving route state", () => {
  assert.equal(
    buildTeamGearPageHref({
      pathname: "/team-gear",
      search:
        "org=org-1&team=team-1&type=sails&statusFilter=active_regatta&condition=used&alert=warning&page=1",
      nextPage: 2,
    }),
    "/team-gear?org=org-1&team=team-1&type=sails&statusFilter=active_regatta&condition=used&alert=warning&page=2",
  )

  assert.equal(
    buildTeamGearPageHref({
      pathname: "/team-gear",
      search:
        "org=org-1&team=team-1&type=running_rigging&condition=new&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-gear?org=org-1&team=team-1&type=running_rigging&condition=new",
  )
})

test("builds Team Gear mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamGearPageHref({
      pathname: "/team-gear",
      search: "org=org-1&team=team-1&type=sails&alert=critical",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-gear?org=org-1&team=team-1&type=sails&alert=critical&page=2&loadMore=1",
  )
})

test("builds Team Gear filter hrefs while dropping invalid filters and pagination", () => {
  assert.equal(
    buildTeamGearFiltersHref({
      scope: {
        activeOrgId: ORG_1,
        activeTeamId: TEAM_1,
      },
      type: "hardware_and_fittings",
      statusFilter: "on_repair",
      condition: "used",
      alert: "none",
    }),
    `/team-gear?org=${ORG_1}&team=${TEAM_1}&type=hardware_and_fittings&statusFilter=on_repair&condition=used&alert=none`,
  )

  assert.equal(
    buildTeamGearFiltersHref({
      scope: {
        activeOrgId: ORG_1,
        activeTeamId: TEAM_1,
      },
      type: "boats",
      statusFilter: "active",
      condition: "bad",
      alert: "danger",
    }),
    `/team-gear?org=${ORG_1}&team=${TEAM_1}`,
  )
})

test("builds Team Gear action redirects while preserving route state", () => {
  assert.equal(
    buildTeamGearRedirectPath({
      status: "created",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeType: "sails",
      scopeStatus: "active_training",
      scopeCondition: "used",
      scopeAlert: "warning",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    `/team-gear?status=created&org=${ORG_1}&team=${TEAM_1}&type=sails&statusFilter=active_training&condition=used&alert=warning&page=3&loadMore=1`,
  )

  assert.equal(
    buildTeamGearRedirectPath({
      status: "updated",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeType: "spars_and_foils",
      scopeStatus: "retired_spare",
      scopeCondition: "refurbished",
      scopeAlert: "none",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-gear?status=updated&org=${ORG_1}&team=${TEAM_1}&type=spars_and_foils&statusFilter=retired_spare&condition=refurbished&alert=none`,
  )
})

test("builds Team Gear action error redirects defensively", () => {
  assert.equal(
    buildTeamGearRedirectPath({
      error: "forbidden",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeType: "running_rigging",
      scopeStatus: "on_repair",
      scopeCondition: "new",
      scopeAlert: "critical",
      scopePage: 4,
      scopeLoadMore: true,
    }),
    `/team-gear?error=forbidden&org=${ORG_1}&team=${TEAM_1}&type=running_rigging&statusFilter=on_repair&condition=new&alert=critical&page=4&loadMore=1`,
  )

  assert.equal(
    buildTeamGearRedirectPath({
      error: "invalid_input",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      scopeType: "boat",
      scopeStatus: "active",
      scopeCondition: "broken",
      scopeAlert: "danger",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    `/team-gear?error=invalid_input&org=${ORG_1}&team=${TEAM_1}`,
  )
})
