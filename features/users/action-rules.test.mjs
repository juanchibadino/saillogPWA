import assert from "node:assert/strict"
import test from "node:test"

import { wouldRemoveAllAccessAfterUnlink } from "./action-rules.mjs"

test("blocks unlink when it would remove the user's final app access", () => {
  assert.equal(
    wouldRemoveAllAccessAfterUnlink({
      activeTeamMembershipIds: ["membership-1"],
      organizationMembershipCount: 0,
      unlinkMembershipIds: ["membership-1"],
    }),
    true,
  )
})

test("allows unlink when another team or organization membership remains", () => {
  assert.equal(
    wouldRemoveAllAccessAfterUnlink({
      activeTeamMembershipIds: ["membership-1", "membership-2"],
      organizationMembershipCount: 0,
      unlinkMembershipIds: ["membership-1"],
    }),
    false,
  )

  assert.equal(
    wouldRemoveAllAccessAfterUnlink({
      activeTeamMembershipIds: ["membership-1"],
      organizationMembershipCount: 1,
      unlinkMembershipIds: ["membership-1"],
    }),
    false,
  )
})
