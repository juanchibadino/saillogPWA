import assert from "node:assert/strict"
import test from "node:test"

import { canAccessOrganizationRoutes } from "./organization-route-access.mjs"

test("allows organization-level routes for super admins and organization admins", () => {
  assert.equal(
    canAccessOrganizationRoutes({
      globalRole: "super_admin",
      organizationRoles: [],
      teamRoles: [],
    }),
    true,
  )

  assert.equal(
    canAccessOrganizationRoutes({
      globalRole: null,
      organizationRoles: ["organization_admin"],
      teamRoles: [],
    }),
    true,
  )
})

test("denies organization-level routes for team-only roles", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.equal(
      canAccessOrganizationRoutes({
        globalRole: null,
        organizationRoles: [],
        teamRoles: [role],
      }),
      false,
      role,
    )
  }
})
