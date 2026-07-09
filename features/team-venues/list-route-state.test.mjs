import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamVenuesPageHref,
  buildTeamVenuesRedirectPath,
  resolveTeamVenuePagination,
  resolveTeamVenuesListRequest,
} from "./list-route-state.mjs"
import {
  TEAM_VENUE_WRITE_ACTIONS,
  canDeleteTeamVenueLink,
  canRunTeamVenueWriteAction,
} from "./action-rules.mjs"

function buildContext(overrides = {}) {
  return {
    effectiveRoles: {
      globalRole: null,
      organizationRoles: [],
      teamRoles: [],
    },
    organizationMemberships: [],
    teamMemberships: [],
    ...overrides,
  }
}

test("resolves Team Venue status page and load-more params defensively", () => {
  assert.deepEqual(
    resolveTeamVenuesListRequest({
      statusParam: "deprecated",
      pageParam: "3",
      loadMoreParam: "1",
    }),
    {
      requestedStatusFilter: "deprecated",
      requestedPage: 3,
      requestedLoadMoreMode: true,
    },
  )

  assert.deepEqual(
    resolveTeamVenuesListRequest({
      statusParam: "archived",
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

test("resolves Team Venue desktop pagination and mobile accumulation", () => {
  assert.deepEqual(
    resolveTeamVenuePagination({
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
    resolveTeamVenuePagination({
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

test("builds Team Venue page hrefs while preserving route state", () => {
  assert.equal(
    buildTeamVenuesPageHref({
      pathname: "/team-venues",
      search: "org=org-1&team=team-1&status=deprecated&page=1",
      nextPage: 2,
    }),
    "/team-venues?org=org-1&team=team-1&status=deprecated&page=2",
  )

  assert.equal(
    buildTeamVenuesPageHref({
      pathname: "/team-venues",
      search: "org=org-1&team=team-1&status=active&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-venues?org=org-1&team=team-1&status=active",
  )
})

test("builds Team Venue mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamVenuesPageHref({
      pathname: "/team-venues",
      search: "org=org-1&team=team-1&status=deprecated",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-venues?org=org-1&team=team-1&status=deprecated&page=2&loadMore=1",
  )
})

test("builds Team Venue action redirects preserving status page and load-more state", () => {
  assert.equal(
    buildTeamVenuesRedirectPath({
      result: "updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeStatus: "deprecated",
      scopePage: 3,
      scopeLoadMore: true,
    }),
    "/team-venues?result=updated&org=org-1&team=team-1&status=deprecated&page=3&loadMore=1",
  )

  assert.equal(
    buildTeamVenuesRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeStatus: "active",
      scopePage: 1,
      scopeLoadMore: true,
    }),
    "/team-venues?error=forbidden&org=org-1&team=team-1&status=active",
  )
})

test("allows organization admins team admins and coaches to create link update and delete Team Venues", () => {
  for (const action of TEAM_VENUE_WRITE_ACTIONS) {
    assert.equal(
      canRunTeamVenueWriteAction({
        action,
        context: buildContext({
          organizationMemberships: [
            {
              organization_id: "org-1",
              role: "organization_admin",
            },
          ],
        }),
        organizationId: "org-1",
        teamId: "team-1",
      }),
      true,
      `${action}:organization_admin`,
    )

    for (const role of ["team_admin", "coach"]) {
      assert.equal(
        canRunTeamVenueWriteAction({
          action,
          context: buildContext({
            teamMemberships: [
              {
                team_id: "team-1",
                role,
                is_active: true,
              },
            ],
          }),
          organizationId: "org-1",
          teamId: "team-1",
        }),
        true,
        `${action}:${role}`,
      )
    }
  }
})

test("forbids Team Venue create link update and delete without structure permissions", () => {
  for (const action of TEAM_VENUE_WRITE_ACTIONS) {
    assert.equal(
      canRunTeamVenueWriteAction({
        action,
        context: buildContext({
          teamMemberships: [
            {
              team_id: "team-1",
              role: "crew",
              is_active: true,
            },
          ],
        }),
        organizationId: "org-1",
        teamId: "team-1",
      }),
      false,
      `${action}:crew`,
    )

    assert.equal(
      canRunTeamVenueWriteAction({
        action,
        context: buildContext({
          teamMemberships: [
            {
              team_id: "team-1",
              role: "crew",
              is_active: false,
            },
          ],
        }),
        organizationId: "org-1",
        teamId: "team-1",
      }),
      false,
      `${action}:inactive-team-member`,
    )

    assert.equal(
      canRunTeamVenueWriteAction({
        action,
        context: buildContext({
          teamMemberships: [
            {
              team_id: "team-2",
              role: "coach",
              is_active: true,
            },
          ],
        }),
        organizationId: "org-1",
        teamId: "team-1",
      }),
      false,
      `${action}:wrong-team`,
    )
  }
})

test("blocks Team Venue delete when linked camps exist", () => {
  assert.equal(
    canDeleteTeamVenueLink({
      totalCampCount: 0,
    }),
    true,
  )
  assert.equal(
    canDeleteTeamVenueLink({
      totalCampCount: 1,
    }),
    false,
  )
})
