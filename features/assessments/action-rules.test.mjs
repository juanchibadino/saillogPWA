import assert from "node:assert/strict"
import test from "node:test"

import { buildTeamAssessmentsRedirectPath } from "./list-route-state.mjs"
import { canManageAssessmentsFromAccess } from "./action-rules.mjs"

const ORG_1 = "org-1"
const ORG_2 = "org-2"
const TEAM_1 = "team-1"
const TEAM_2 = "team-2"

function buildAccessContext(overrides = {}) {
  return {
    effectiveRoles: {
      globalRole: null,
      organizationRoles: [],
      teamRoles: [],
    },
    organizationMemberships: [],
    teamMemberships: [],
    user: {
      id: "profile-1",
    },
    ...overrides,
  }
}

test("allows assessment management for super admins and organization admins", () => {
  assert.equal(
    canManageAssessmentsFromAccess({
      context: buildAccessContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
      }),
      organizationId: ORG_1,
      teamId: TEAM_1,
    }),
    true,
  )

  assert.equal(
    canManageAssessmentsFromAccess({
      context: buildAccessContext({
        organizationMemberships: [
          {
            organization_id: ORG_1,
            role: "organization_admin",
          },
        ],
      }),
      organizationId: ORG_1,
      teamId: TEAM_1,
    }),
    true,
  )
})

test("allows assessment management for active team admins and coaches", () => {
  for (const role of ["team_admin", "coach"]) {
    assert.equal(
      canManageAssessmentsFromAccess({
        context: buildAccessContext({
          teamMemberships: [
            {
              is_active: true,
              role,
              team_id: TEAM_1,
            },
          ],
        }),
        organizationId: ORG_1,
        teamId: TEAM_1,
      }),
      true,
    )
  }
})

test("denies assessment management for crew inactive and stale team memberships", () => {
  for (const membership of [
    {
      is_active: true,
      role: "crew",
      team_id: TEAM_1,
    },
    {
      is_active: false,
      role: "coach",
      team_id: TEAM_1,
    },
    {
      is_active: true,
      role: "coach",
      team_id: TEAM_2,
    },
  ]) {
    assert.equal(
      canManageAssessmentsFromAccess({
        context: buildAccessContext({
          organizationMemberships: [
            {
              organization_id: ORG_2,
              role: "organization_admin",
            },
          ],
          teamMemberships: [membership],
        }),
        organizationId: ORG_1,
        teamId: TEAM_1,
      }),
      false,
    )
  }
})

test("builds assessment permission failure redirects for created and templates surfaces", () => {
  assert.equal(
    buildTeamAssessmentsRedirectPath({
      error: "forbidden",
      returnPath: "/team-assessments?org=old&team=old&page=3&loadMore=1",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      tab: "created",
    }),
    "/team-assessments?org=org-1&team=team-1&page=3&error=forbidden",
  )

  assert.equal(
    buildTeamAssessmentsRedirectPath({
      error: "forbidden",
      returnPath: "/team-assessments?tab=templates&template=template-1&status=template_saved",
      scopeOrgId: ORG_1,
      scopeTeamId: TEAM_1,
      tab: "templates",
    }),
    "/team-assessments?tab=templates&template=template-1&error=forbidden&org=org-1&team=team-1",
  )
})
