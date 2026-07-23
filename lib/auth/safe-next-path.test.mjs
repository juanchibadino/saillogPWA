import assert from "node:assert/strict"
import test from "node:test"

import {
  appendSafeNextParam,
  normalizeSafeNextPath,
} from "./safe-next-path.mjs"

test("preserves same-origin settings notification next paths", () => {
  assert.equal(
    normalizeSafeNextPath("/settings?tab=notifications&org=org-1&team=team-1"),
    "/settings?tab=notifications&org=org-1&team=team-1",
  )
  assert.equal(
    appendSafeNextParam(
      "/sign-in?error=password_failed",
      "/settings?tab=notifications&org=org-1&team=team-1",
    ),
    "/sign-in?error=password_failed&next=%2Fsettings%3Ftab%3Dnotifications%26org%3Dorg-1%26team%3Dteam-1",
  )
})

test("rejects unsafe next paths", () => {
  assert.equal(normalizeSafeNextPath("https://example.com/settings"), "/post-auth")
  assert.equal(normalizeSafeNextPath("//example.com/settings"), "/post-auth")
  assert.equal(normalizeSafeNextPath("javascript:alert(1)"), "/post-auth")
  assert.equal(normalizeSafeNextPath(""), "/post-auth")
})
