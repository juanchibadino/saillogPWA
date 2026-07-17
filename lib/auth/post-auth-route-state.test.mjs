import assert from "node:assert/strict"
import test from "node:test"

import {
  resolvePostAuthLandingPath,
  shouldTeamUserLandOnTeamHome,
} from "./post-auth-route-state.mjs"

test("lands active team roles on Team Home after sign in", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.equal(
      shouldTeamUserLandOnTeamHome({
        globalRole: null,
        organizationRoles: [],
        teamRoles: [role],
      }),
      true,
      role,
    )
  }
})

test("keeps organization-level roles off Team Home after sign in", () => {
  assert.equal(
    shouldTeamUserLandOnTeamHome({
      globalRole: "super_admin",
      organizationRoles: [],
      teamRoles: ["team_admin"],
    }),
    false,
  )

  assert.equal(
    shouldTeamUserLandOnTeamHome({
      globalRole: null,
      organizationRoles: ["organization_admin"],
      teamRoles: ["coach"],
    }),
    false,
  )
})

test("resolves post-auth landing without dashboard fallback", () => {
  assert.equal(
    resolvePostAuthLandingPath({
      globalRole: null,
      organizationRoles: [],
      teamRoles: ["crew"],
    }),
    "/team-home",
  )

  assert.equal(
    resolvePostAuthLandingPath({
      globalRole: null,
      organizationRoles: ["organization_admin"],
      teamRoles: [],
    }),
    "/teams",
  )

  assert.equal(
    resolvePostAuthLandingPath({
      globalRole: "super_admin",
      organizationRoles: [],
      teamRoles: [],
    }),
    "/teams",
  )
})

test("does not send users without team roles to Team Home", () => {
  assert.equal(
    shouldTeamUserLandOnTeamHome({
      globalRole: null,
      organizationRoles: [],
      teamRoles: [],
    }),
    false,
  )
})
