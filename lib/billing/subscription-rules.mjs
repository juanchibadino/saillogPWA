export const BILLING_PLAN_LIMITS_CORE = {
  free: {
    teams: 1,
    venues: 1,
    camps: 1,
    sessions: 3,
  },
  pro: {
    teams: 3,
    venues: null,
    camps: null,
    sessions: null,
  },
  premium: {
    teams: 30,
    venues: null,
    camps: null,
    sessions: null,
  },
}

export const BILLING_PLAN_CAPABILITIES_CORE = {
  free: {
    sessionAssetUploads: false,
  },
  pro: {
    sessionAssetUploads: true,
  },
  premium: {
    sessionAssetUploads: true,
  },
}

export const PAID_PLAN_TIERS_CORE = ["pro", "premium"]

export const TEST_ORGANIZATION_FREE_SLUGS_CORE = ["test-organization"]
export const TEST_ORGANIZATION_FREE_NAMES_CORE = ["test organization"]
export const PRO_TEST_ORGANIZATION_SLUGS_CORE = [
  "america-one-racing",
  "enard-argentina",
]
export const PRO_TEST_ORGANIZATION_NAMES_CORE = [
  "america one racing",
  "enard argentina",
]

export function normalizePlanTierCore(value) {
  return value === "olympic" ? "premium" : value
}

function normalizeLookupValue(value) {
  return value.trim().toLowerCase()
}

export function resolveForcedPlanTierOverrideCore(input) {
  const normalizedSlug = normalizeLookupValue(input.slug)
  const normalizedName = normalizeLookupValue(input.name)

  if (
    TEST_ORGANIZATION_FREE_SLUGS_CORE.includes(normalizedSlug) ||
    TEST_ORGANIZATION_FREE_NAMES_CORE.includes(normalizedName)
  ) {
    return "free"
  }

  if (
    PRO_TEST_ORGANIZATION_SLUGS_CORE.includes(normalizedSlug) ||
    PRO_TEST_ORGANIZATION_NAMES_CORE.includes(normalizedName)
  ) {
    return "pro"
  }

  return null
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

export function shouldHonorForcedFreePlanCore(input) {
  const normalizedPlanTier = normalizePlanTierCore(input.planTier)

  return !(
    PAID_PLAN_TIERS_CORE.includes(normalizedPlanTier) &&
    input.subscriptionStatus === "active" &&
    hasNonEmptyString(input.polarSubscriptionId)
  )
}
