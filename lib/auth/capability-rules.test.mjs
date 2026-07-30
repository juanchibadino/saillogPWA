import assert from "node:assert/strict"
import test from "node:test"

import {
  canCreateCampsFromAccess,
  canCreateTeamVenuesFromAccess,
  canManageOrganizationOperationsFromAccess,
  canManageTeamFinanceFromAccess,
  canManageTeamSessionsFromAccess,
  canManageTeamVenuesFromAccess,
} from "./capability-rules.mjs"

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

test("allows super admins and organization admins to manage organization operations", () => {
  assert.equal(
    canManageOrganizationOperationsFromAccess({
      context: buildContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
      }),
      organizationId: "org-1",
    }),
    true,
  )
  assert.equal(
    canManageOrganizationOperationsFromAccess({
      context: buildContext({
        organizationMemberships: [
          {
            organization_id: "org-1",
            role: "organization_admin",
          },
        ],
      }),
      organizationId: "org-1",
    }),
    true,
  )
})

test("denies organization operations without matching admin access", () => {
  assert.equal(
    canManageOrganizationOperationsFromAccess({
      context: buildContext(),
      organizationId: "org-1",
    }),
    false,
  )
  assert.equal(
    canManageOrganizationOperationsFromAccess({
      context: buildContext({
        organizationMemberships: [
          {
            organization_id: "org-2",
            role: "organization_admin",
          },
        ],
      }),
      organizationId: "org-1",
    }),
    false,
  )
})

test("allows super admins and organization admins to manage Team Venues", () => {
  assert.equal(
    canManageTeamVenuesFromAccess({
      context: buildContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    true,
  )
  assert.equal(
    canManageTeamVenuesFromAccess({
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
  )
})

test("allows active team admins and coaches to manage Team Venues", () => {
  for (const role of ["team_admin", "coach"]) {
    assert.equal(
      canManageTeamVenuesFromAccess({
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
      role,
    )
  }
})

test("denies non-structure Team Venues users before update or delete", () => {
  assert.equal(
    canManageTeamVenuesFromAccess({
      context: buildContext(),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )
  assert.equal(
    canManageTeamVenuesFromAccess({
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
  )
  assert.equal(
    canManageTeamVenuesFromAccess({
      context: buildContext({
        teamMemberships: [
          {
            team_id: "team-1",
            role: "coach",
            is_active: false,
          },
        ],
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )
  assert.equal(
    canManageTeamVenuesFromAccess({
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
  )
})

test("allows active team admins coaches and crew to create Team Venues", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.equal(
      canCreateTeamVenuesFromAccess({
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
      role,
    )
  }
})

test("denies Team Venue creation without active matching team access", () => {
  assert.equal(
    canCreateTeamVenuesFromAccess({
      context: buildContext(),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )
  assert.equal(
    canCreateTeamVenuesFromAccess({
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
  )
  assert.equal(
    canCreateTeamVenuesFromAccess({
      context: buildContext({
        teamMemberships: [
          {
            team_id: "team-2",
            role: "crew",
            is_active: true,
          },
        ],
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )
})

test("allows active team admins coaches and crew to create Camps", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.equal(
      canCreateCampsFromAccess({
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
      role,
    )
  }
})

test("allows super admins and organization admins to manage Team Sessions", () => {
  assert.equal(
    canManageTeamSessionsFromAccess({
      context: buildContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    true,
  )
  assert.equal(
    canManageTeamSessionsFromAccess({
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
  )
})

test("allows active team admins coaches and crew to manage Team Sessions", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.equal(
      canManageTeamSessionsFromAccess({
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
      role,
    )
  }
})

test("denies non-managing Team Sessions users before create or update", () => {
  assert.equal(
    canManageTeamSessionsFromAccess({
      context: buildContext(),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )
  assert.equal(
    canManageTeamSessionsFromAccess({
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
  )
  assert.equal(
    canManageTeamSessionsFromAccess({
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
  )
})

test("allows team finance management for global org and team admins only", () => {
  assert.equal(
    canManageTeamFinanceFromAccess({
      context: buildContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    true,
  )

  assert.equal(
    canManageTeamFinanceFromAccess({
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
  )

  assert.equal(
    canManageTeamFinanceFromAccess({
      context: buildContext({
        teamMemberships: [
          {
            team_id: "team-1",
            role: "team_admin",
            is_active: true,
          },
        ],
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    true,
  )

  assert.equal(
    canManageTeamFinanceFromAccess({
      context: buildContext({
        teamMemberships: [
          {
            team_id: "team-1",
            role: "coach",
            is_active: true,
          },
        ],
      }),
      organizationId: "org-1",
      teamId: "team-1",
    }),
    false,
  )

  assert.equal(
    canManageTeamFinanceFromAccess({
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
  )
})
