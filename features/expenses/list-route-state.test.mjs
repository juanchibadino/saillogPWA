import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamExpensesFiltersHref,
  buildTeamExpensesPageHref,
  buildTeamExpensesReportHref,
  normalizeTeamExpenseCrewFilter,
  normalizeTeamExpenseScope,
  resolveTeamExpensesListRequest,
  resolveTeamExpensesPagination,
} from "./list-route-state.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const TEAM_1 = "22222222-2222-4222-8222-222222222222"
const VENUE_1 = "33333333-3333-4333-8333-333333333333"
const CAMP_1 = "44444444-4444-4444-8444-444444444444"
const MEMBER_1 = "55555555-5555-4555-8555-555555555555"

test("normalizes expenses scope by team visibility setting", () => {
  assert.equal(normalizeTeamExpenseScope("team", false), "mine")
  assert.equal(normalizeTeamExpenseScope("team", true), "team")
  assert.equal(normalizeTeamExpenseScope("mine", true), "mine")
  assert.equal(normalizeTeamExpenseScope("invalid", true), "mine")
})

test("normalizes expenses crew filters", () => {
  assert.equal(normalizeTeamExpenseCrewFilter("all"), "all")
  assert.equal(normalizeTeamExpenseCrewFilter("you"), "you")
  assert.equal(normalizeTeamExpenseCrewFilter("others"), undefined)
  assert.equal(normalizeTeamExpenseCrewFilter("invalid"), undefined)
})

test("resolves expenses filters and pagination defensively", () => {
  assert.deepEqual(
    resolveTeamExpensesListRequest({
      campParam: CAMP_1,
      crewParam: "you",
      loadMoreParam: "1",
      memberParam: MEMBER_1,
      pageParam: "3",
      scopeParam: "team",
      typeParam: "meals",
      venueParam: VENUE_1,
      yearParam: "2026",
    }),
    {
      requestedCampId: CAMP_1,
      requestedCrewFilter: "you",
      requestedLoadMoreMode: true,
      requestedMemberId: MEMBER_1,
      requestedPage: 3,
      requestedScope: "team",
      requestedType: "meals",
      requestedVenueId: VENUE_1,
      requestedYear: 2026,
    },
  )

  assert.deepEqual(
    resolveTeamExpensesListRequest({
      crewParam: "bad",
      loadMoreParam: "yes",
      memberParam: "",
      pageParam: "-2",
      scopeParam: "",
      typeParam: "bad",
      yearParam: "1899",
    }),
    {
      requestedCampId: undefined,
      requestedCrewFilter: undefined,
      requestedLoadMoreMode: false,
      requestedMemberId: undefined,
      requestedPage: 1,
      requestedScope: undefined,
      requestedType: undefined,
      requestedVenueId: undefined,
      requestedYear: undefined,
    },
  )
})

test("resolves expenses desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamExpensesPagination({
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
    resolveTeamExpensesPagination({
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

test("builds expenses page hrefs while preserving route state", () => {
  assert.equal(
    buildTeamExpensesPageHref({
      pathname: "/team-expenses",
      search: `org=${ORG_1}&team=${TEAM_1}&scope=team&year=2026&venue=${VENUE_1}&type=meals&page=1`,
      nextPage: 2,
    }),
    `/team-expenses?org=${ORG_1}&team=${TEAM_1}&scope=team&year=2026&venue=${VENUE_1}&type=meals&page=2`,
  )

  assert.equal(
    buildTeamExpensesPageHref({
      pathname: "/team-expenses",
      search: `org=${ORG_1}&team=${TEAM_1}&year=2026&page=3&loadMore=1`,
      nextPage: 1,
    }),
    `/team-expenses?org=${ORG_1}&team=${TEAM_1}&year=2026`,
  )
})

test("builds expenses filter hrefs and report hrefs with scope rules", () => {
  assert.equal(
    buildTeamExpensesFiltersHref({
      scope: {
        activeOrgId: ORG_1,
        activeTeamId: TEAM_1,
      },
      visibilityScope: "team",
      teamScopeAllowed: true,
      year: 2026,
      teamVenueId: VENUE_1,
      memberId: MEMBER_1,
      expenseType: "fuel",
    }),
    `/team-expenses?org=${ORG_1}&team=${TEAM_1}&scope=team&year=2026&venue=${VENUE_1}&member=${MEMBER_1}&type=fuel`,
  )

  assert.equal(
    buildTeamExpensesReportHref({
      scope: {
        activeOrgId: ORG_1,
        activeTeamId: TEAM_1,
      },
      visibilityScope: "team",
      teamScopeAllowed: false,
      year: 2026,
      memberId: MEMBER_1,
      expenseType: "bad",
    }),
    `/api/team-expenses/report/pdf?org=${ORG_1}&team=${TEAM_1}&scope=mine&year=2026&member=${MEMBER_1}`,
  )
})
