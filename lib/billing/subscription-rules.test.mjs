import assert from "node:assert/strict"
import test from "node:test"

import {
  BILLING_PLAN_CAPABILITIES_CORE,
  BILLING_PLAN_LIMITS_CORE,
  normalizePlanTierCore,
  resolveForcedPlanTierOverrideCore,
} from "./subscription-rules.mjs"

test("normalizes the retired Olympic tier to Premium", () => {
  assert.equal(normalizePlanTierCore("olympic"), "premium")
  assert.equal(normalizePlanTierCore("premium"), "premium")
  assert.equal(normalizePlanTierCore("pro"), "pro")
})

test("keeps Free and Premium limits aligned with subscription rules", () => {
  assert.deepEqual(BILLING_PLAN_LIMITS_CORE.free, {
    teams: 1,
    venues: 1,
    camps: 1,
    sessions: 3,
  })
  assert.deepEqual(BILLING_PLAN_LIMITS_CORE.premium, {
    teams: 30,
    venues: null,
    camps: null,
    sessions: null,
  })
  assert.equal(BILLING_PLAN_CAPABILITIES_CORE.free.sessionAssetUploads, false)
  assert.equal(BILLING_PLAN_CAPABILITIES_CORE.pro.sessionAssetUploads, true)
})

test("forces production testing organizations to their expected plans", () => {
  assert.equal(
    resolveForcedPlanTierOverrideCore({
      name: "Test Organization",
      slug: "test-organization",
    }),
    "free",
  )
  assert.equal(
    resolveForcedPlanTierOverrideCore({
      name: "America One Racing",
      slug: "america-one-racing",
    }),
    "pro",
  )
  assert.equal(
    resolveForcedPlanTierOverrideCore({
      name: "ENARD Argentina",
      slug: "enard-argentina",
    }),
    "pro",
  )
  assert.equal(
    resolveForcedPlanTierOverrideCore({
      name: "Other Organization",
      slug: "other-organization",
    }),
    null,
  )
})
