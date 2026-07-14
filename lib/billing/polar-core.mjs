export function mapPolarSubscriptionStatusCore(polarStatus) {
  const normalizedStatus = polarStatus.trim().toLowerCase()

  if (normalizedStatus === "active" || normalizedStatus === "trialing") {
    return "active"
  }

  if (normalizedStatus === "incomplete") {
    return "approval_pending"
  }

  if (normalizedStatus === "past_due" || normalizedStatus === "unpaid") {
    return "payment_failed"
  }

  if (normalizedStatus === "canceled") {
    return "cancelled"
  }

  if (normalizedStatus === "incomplete_expired") {
    return "expired"
  }

  return "payment_failed"
}

export function resolveBillingCycleFromPolarIntervalCore(interval) {
  return interval === "year" ? "yearly" : "monthly"
}

export function buildPolarOrdersListRequestCore(input) {
  return {
    externalCustomerId: input.organizationId,
    productBillingType: "recurring",
    productId: input.productId,
    sorting: ["-created_at"],
    limit: 50,
  }
}
