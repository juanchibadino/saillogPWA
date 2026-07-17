import assert from "node:assert/strict"
import test from "node:test"

import { resolveMemberInviteTarget } from "./invite-rules.mjs"

test("resolves organization admin invites without a team", () => {
  assert.deepEqual(
    resolveMemberInviteTarget({
      role: "organization_admin",
      teamId: undefined,
    }),
    {
      kind: "organization",
      teamId: null,
      teamRole: null,
    },
  )
})

test("requires a team for team member invites", () => {
  assert.equal(
    resolveMemberInviteTarget({
      role: "crew",
      teamId: undefined,
    }),
    null,
  )
})

test("resolves team member invite roles", () => {
  for (const role of ["team_admin", "coach", "crew"]) {
    assert.deepEqual(
      resolveMemberInviteTarget({
        role,
        teamId: "team-1",
      }),
      {
        kind: "team",
        teamId: "team-1",
        teamRole: role,
      },
      role,
    )
  }
})
