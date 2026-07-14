import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPolarOrdersListRequestCore,
  mapPolarSubscriptionStatusCore,
  resolveBillingCycleFromPolarIntervalCore,
} from "./polar-core.mjs"

test("maps Polar subscription statuses to Sailog subscription statuses", () => {
  assert.equal(mapPolarSubscriptionStatusCore("active"), "active")
  assert.equal(mapPolarSubscriptionStatusCore("incomplete"), "approval_pending")
  assert.equal(mapPolarSubscriptionStatusCore("trialing"), "active")
  assert.equal(mapPolarSubscriptionStatusCore("past_due"), "payment_failed")
  assert.equal(mapPolarSubscriptionStatusCore("unpaid"), "payment_failed")
  assert.equal(mapPolarSubscriptionStatusCore("canceled"), "cancelled")
  assert.equal(mapPolarSubscriptionStatusCore("incomplete_expired"), "expired")
  assert.equal(mapPolarSubscriptionStatusCore("unrecognized"), "payment_failed")
})

test("resolves Polar recurring intervals to Sailog billing cycles", () => {
  assert.equal(resolveBillingCycleFromPolarIntervalCore("year"), "yearly")
  assert.equal(resolveBillingCycleFromPolarIntervalCore("month"), "monthly")
})

test("builds the live Polar orders request for recurring Pro invoices", () => {
  assert.deepEqual(
    buildPolarOrdersListRequestCore({
      organizationId: "org-1",
      productId: "product-pro-monthly",
    }),
    {
      externalCustomerId: "org-1",
      productBillingType: "recurring",
      productId: "product-pro-monthly",
      sorting: ["-created_at"],
      limit: 50,
    },
  )
})
