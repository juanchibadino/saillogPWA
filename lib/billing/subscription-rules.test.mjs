import assert from "node:assert/strict"
import test from "node:test"

import {
  BILLING_PLAN_CAPABILITIES_CORE,
  BILLING_PLAN_LIMITS_CORE,
  hasBillingPeriodEndedCore,
  normalizePlanTierCore,
  resolveForcedPlanTierOverrideCore,
  shouldDowngradePaidPlanToFreeCore,
  shouldHonorForcedFreePlanCore,
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

test("lets a completed Polar subscription override the forced Free test org UI", () => {
  assert.equal(
    shouldHonorForcedFreePlanCore({
      planTier: "free",
      subscriptionStatus: "active",
      polarSubscriptionId: null,
    }),
    true,
  )
  assert.equal(
    shouldHonorForcedFreePlanCore({
      planTier: "pro",
      subscriptionStatus: "approval_pending",
      polarSubscriptionId: "sub_123",
    }),
    true,
  )
  assert.equal(
    shouldHonorForcedFreePlanCore({
      planTier: "pro",
      subscriptionStatus: "active",
      polarSubscriptionId: "sub_123",
    }),
    false,
  )
})

test("detects billing periods that have already ended", () => {
  assert.equal(
    hasBillingPeriodEndedCore({
      currentPeriodEndAt: "2026-07-15T00:00:00.000Z",
      now: new Date("2026-07-17T00:00:00.000Z"),
    }),
    true,
  )
  assert.equal(
    hasBillingPeriodEndedCore({
      currentPeriodEndAt: "2026-07-17T00:00:00.000Z",
      now: new Date("2026-07-17T00:00:00.000Z"),
    }),
    true,
  )
  assert.equal(
    hasBillingPeriodEndedCore({
      currentPeriodEndAt: "2026-07-18T00:00:00.000Z",
      now: new Date("2026-07-17T00:00:00.000Z"),
    }),
    false,
  )
  assert.equal(
    hasBillingPeriodEndedCore({
      currentPeriodEndAt: "not-a-date",
      now: new Date("2026-07-17T00:00:00.000Z"),
    }),
    false,
  )
})

test("downgrades active or cancelled paid plans after the paid billing period ends", () => {
  const now = new Date("2026-07-17T00:00:00.000Z")

  assert.equal(
    shouldDowngradePaidPlanToFreeCore({
      planTier: "pro",
      subscriptionStatus: "active",
      currentPeriodEndAt: "2026-07-15T00:00:00.000Z",
      now,
    }),
    true,
  )
  assert.equal(
    shouldDowngradePaidPlanToFreeCore({
      planTier: "pro",
      subscriptionStatus: "cancelled",
      currentPeriodEndAt: "2026-07-15T00:00:00.000Z",
      now,
    }),
    true,
  )
  assert.equal(
    shouldDowngradePaidPlanToFreeCore({
      planTier: "pro",
      subscriptionStatus: "active",
      currentPeriodEndAt: "2026-07-18T00:00:00.000Z",
      now,
    }),
    false,
  )
  assert.equal(
    shouldDowngradePaidPlanToFreeCore({
      planTier: "free",
      subscriptionStatus: "active",
      currentPeriodEndAt: "2026-07-15T00:00:00.000Z",
      now,
    }),
    false,
  )
  assert.equal(
    shouldDowngradePaidPlanToFreeCore({
      planTier: "pro",
      subscriptionStatus: "payment_failed",
      currentPeriodEndAt: "2026-07-15T00:00:00.000Z",
      now,
    }),
    false,
  )
})
