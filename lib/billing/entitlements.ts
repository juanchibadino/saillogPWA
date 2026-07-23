import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

import {
  BILLING_PLAN_CAPABILITIES,
  BILLING_PLAN_LIMITS,
  type BillingCycle,
  type BillingResource,
  type PlanCapabilities,
  type PlanLimits,
  type PlanTier,
  PAID_PLAN_TIERS,
  type SubscriptionStatus,
} from "./plans"
import {
  PRO_TEST_ORGANIZATION_NAMES_CORE,
  PRO_TEST_ORGANIZATION_SLUGS_CORE,
  TEST_ORGANIZATION_FREE_NAMES_CORE,
  TEST_ORGANIZATION_FREE_SLUGS_CORE,
  normalizePlanTierCore,
  resolveForcedPlanTierOverrideCore,
  shouldHonorForcedFreePlanCore,
  shouldDowngradePaidPlanToFreeCore,
} from "./subscription-rules.mjs"

type ServerSupabaseClient = SupabaseClient<Database>

type OrganizationSubscriptionRow =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"]

type IdRow = { id: string }
type OrganizationPlanOverrideRow = {
  id: string
  name: string
  slug: string
}

export type OrganizationUsage = {
  teams: number
  venues: number
  camps: number
  sessions: number
}

export type OrganizationSubscriptionSnapshot = {
  organizationId: string
  planTier: PlanTier
  billingCycle: BillingCycle
  status: SubscriptionStatus
  paypalSubscriptionId: string | null
  paypalPlanId: string | null
  polarCustomerId: string | null
  polarSubscriptionId: string | null
  polarProductId: string | null
  polarCheckoutId: string | null
  polarStatus: string | null
  currentPeriodStartAt: string | null
  currentPeriodEndAt: string | null
  cancelledAt: string | null
  cancelAtPeriodEnd: boolean
}

export type OrganizationBillingSnapshot = {
  organizationId: string
  subscription: OrganizationSubscriptionSnapshot
  usage: OrganizationUsage
  limits: PlanLimits
  capabilities: PlanCapabilities
  hasActivePaidStatus: boolean
}

export type OrganizationWriteEntitlementReason =
  | "plan_limit_reached"
  | "payment_required"

export type OrganizationWriteEntitlementDecision = {
  allowed: boolean
  reason: OrganizationWriteEntitlementReason | null
  organizationId: string
  resource: BillingResource
  usage: OrganizationUsage
  limits: PlanLimits
  planTier: PlanTier
  billingCycle: BillingCycle
  subscriptionStatus: SubscriptionStatus
  currentUsage: number
  resourceLimit: number | null
}

export type OrganizationSessionAssetUploadEntitlementDecision = {
  allowed: boolean
  reason: OrganizationWriteEntitlementReason | null
  organizationId: string
  planTier: PlanTier
  subscriptionStatus: SubscriptionStatus
}

export type OrganizationTeamExpensesEntitlementDecision =
  OrganizationSessionAssetUploadEntitlementDecision

export const TEST_ORGANIZATION_FREE_SLUGS = TEST_ORGANIZATION_FREE_SLUGS_CORE
export const TEST_ORGANIZATION_FREE_NAMES = TEST_ORGANIZATION_FREE_NAMES_CORE
export const PRO_TEST_ORGANIZATION_SLUGS = PRO_TEST_ORGANIZATION_SLUGS_CORE
export const PRO_TEST_ORGANIZATION_NAMES = PRO_TEST_ORGANIZATION_NAMES_CORE

const DEFAULT_FREE_SUBSCRIPTION: Omit<OrganizationSubscriptionSnapshot, "organizationId"> =
  {
    planTier: "free",
    billingCycle: "none",
    status: "active",
    paypalSubscriptionId: null,
    paypalPlanId: null,
    polarCustomerId: null,
    polarSubscriptionId: null,
    polarProductId: null,
    polarCheckoutId: null,
    polarStatus: null,
    currentPeriodStartAt: null,
    currentPeriodEndAt: null,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
  }

const DEFAULT_FORCED_PRO_SUBSCRIPTION: Omit<
  OrganizationSubscriptionSnapshot,
  "organizationId"
> = {
  planTier: "pro",
  billingCycle: "monthly",
  status: "active",
  paypalSubscriptionId: null,
  paypalPlanId: null,
  polarCustomerId: null,
  polarSubscriptionId: null,
  polarProductId: null,
  polarCheckoutId: null,
  polarStatus: null,
  currentPeriodStartAt: null,
  currentPeriodEndAt: null,
  cancelledAt: null,
  cancelAtPeriodEnd: false,
}

function hasPaypalSubscriptionId(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function shouldFallbackToFreePlan(row: OrganizationSubscriptionRow): boolean {
  const isPaidPlan = row.plan_tier !== "free"
  const hasLinkedPaypalSubscription = hasPaypalSubscriptionId(row.paypal_subscription_id)
  const isNonActivatedStatus =
    row.status === "approval_pending" || row.status === "approved"

  return isPaidPlan && !hasLinkedPaypalSubscription && isNonActivatedStatus
}

export function normalizePlanTier(value: PlanTier | "olympic"): PlanTier {
  return normalizePlanTierCore(value) as PlanTier
}

export function resolveForcedPlanTierOverride(input: {
  name: string
  slug: string
}): PlanTier | null {
  return resolveForcedPlanTierOverrideCore(input) as PlanTier | null
}

function buildForcedSubscriptionSnapshot(input: {
  organizationId: string
  planTier: PlanTier
}): OrganizationSubscriptionSnapshot {
  return {
    organizationId: input.organizationId,
    ...(input.planTier === "pro"
      ? DEFAULT_FORCED_PRO_SUBSCRIPTION
      : DEFAULT_FREE_SUBSCRIPTION),
  }
}

function mapSubscriptionRow(
  organizationId: string,
  row: OrganizationSubscriptionRow | null,
): OrganizationSubscriptionSnapshot {
  if (!row) {
    return {
      organizationId,
      ...DEFAULT_FREE_SUBSCRIPTION,
    }
  }

  if (shouldFallbackToFreePlan(row)) {
    return {
      organizationId,
      ...DEFAULT_FREE_SUBSCRIPTION,
    }
  }

  const normalizedPlanTier = normalizePlanTier(row.plan_tier as PlanTier | "olympic")

  if (
    shouldDowngradePaidPlanToFreeCore({
      planTier: normalizedPlanTier,
      subscriptionStatus: row.status,
      currentPeriodEndAt: row.current_period_end_at,
      now: new Date(),
    })
  ) {
    return {
      organizationId,
      ...DEFAULT_FREE_SUBSCRIPTION,
      paypalSubscriptionId: row.paypal_subscription_id,
      paypalPlanId: row.paypal_plan_id,
      polarCustomerId: row.polar_customer_id,
      polarSubscriptionId: row.polar_subscription_id,
      polarProductId: row.polar_product_id,
      polarCheckoutId: row.polar_checkout_id,
      polarStatus: row.polar_status,
      cancelledAt: row.cancelled_at,
    }
  }

  return {
    organizationId,
    planTier: normalizedPlanTier,
    billingCycle: row.billing_cycle,
    status: row.status,
    paypalSubscriptionId: row.paypal_subscription_id,
    paypalPlanId: row.paypal_plan_id,
    polarCustomerId: row.polar_customer_id,
    polarSubscriptionId: row.polar_subscription_id,
    polarProductId: row.polar_product_id,
    polarCheckoutId: row.polar_checkout_id,
    polarStatus: row.polar_status,
    currentPeriodStartAt: row.current_period_start_at,
    currentPeriodEndAt: row.current_period_end_at,
    cancelledAt: row.cancelled_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function uniqueIds(rows: IdRow[]): string[] {
  return [...new Set(rows.map((row) => row.id).filter((value) => isUuid(value)))]
}

export async function resolveOrganizationSubscription(
  organizationId: string,
  supabase?: ServerSupabaseClient,
): Promise<OrganizationSubscriptionSnapshot> {
  const scopedSupabase = supabase ?? (await createServerSupabaseClient())

  const { data: organizationRow, error: organizationError } = await scopedSupabase
    .from("organizations")
    .select("id,name,slug")
    .eq("id", organizationId)
    .maybeSingle()

  if (organizationError) {
    throw new Error(
      `Could not resolve organization plan override for ${organizationId}: ${organizationError.message}`,
    )
  }

  const forcedPlanTier = organizationRow
    ? resolveForcedPlanTierOverride(organizationRow as OrganizationPlanOverrideRow)
    : null

  if (forcedPlanTier === "pro") {
    return buildForcedSubscriptionSnapshot({
      organizationId,
      planTier: forcedPlanTier,
    })
  }

  const { data, error } = await scopedSupabase
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Could not resolve organization subscription for ${organizationId}: ${error.message}`,
    )
  }

  if (
    forcedPlanTier === "free" &&
    shouldHonorForcedFreePlanCore({
      planTier: data
        ? normalizePlanTier(data.plan_tier as PlanTier | "olympic")
        : "free",
      subscriptionStatus: data?.status ?? "active",
      polarSubscriptionId: data?.polar_subscription_id ?? null,
    })
  ) {
    return buildForcedSubscriptionSnapshot({
      organizationId,
      planTier: forcedPlanTier,
    })
  }

  return mapSubscriptionRow(organizationId, data)
}

export async function resolveOrganizationUsage(
  organizationId: string,
  supabase?: ServerSupabaseClient,
): Promise<OrganizationUsage> {
  const scopedSupabase = supabase ?? (await createServerSupabaseClient())

  const { count: teamsCount, error: teamsCountError } = await scopedSupabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)

  if (teamsCountError) {
    throw new Error(
      `Could not count active teams for usage in organization ${organizationId}: ${teamsCountError.message}`,
    )
  }

  const { count: venuesCount, error: venuesCountError } = await scopedSupabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)

  if (venuesCountError) {
    throw new Error(
      `Could not count active venues for usage in organization ${organizationId}: ${venuesCountError.message}`,
    )
  }

  const { data: activeTeamRows, error: activeTeamsError } = await scopedSupabase
    .from("teams")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)

  if (activeTeamsError) {
    throw new Error(
      `Could not resolve active teams for usage in organization ${organizationId}: ${activeTeamsError.message}`,
    )
  }

  const activeTeamIds = uniqueIds((activeTeamRows ?? []) as IdRow[])

  let campCount = 0
  let sessionCount = 0

  if (activeTeamIds.length > 0) {
    const { data: teamVenueRows, error: teamVenueError } = await scopedSupabase
      .from("team_venues")
      .select("id")
      .in("team_id", activeTeamIds)

    if (teamVenueError) {
      throw new Error(
        `Could not resolve team venues for usage in organization ${organizationId}: ${teamVenueError.message}`,
      )
    }

    const teamVenueIds = uniqueIds((teamVenueRows ?? []) as IdRow[])

    if (teamVenueIds.length > 0) {
      const { count: resolvedCampCount, error: campCountError } = await scopedSupabase
        .from("camps")
        .select("id", { count: "exact", head: true })
        .in("team_venue_id", teamVenueIds)
        .eq("is_active", true)

      if (campCountError) {
        throw new Error(
          `Could not count active camps for usage in organization ${organizationId}: ${campCountError.message}`,
        )
      }

      campCount = resolvedCampCount ?? 0

      const { data: activeCampRows, error: activeCampError } = await scopedSupabase
        .from("camps")
        .select("id")
        .in("team_venue_id", teamVenueIds)
        .eq("is_active", true)

      if (activeCampError) {
        throw new Error(
          `Could not resolve active camps for usage in organization ${organizationId}: ${activeCampError.message}`,
        )
      }

      const activeCampIds = uniqueIds((activeCampRows ?? []) as IdRow[])

      if (activeCampIds.length > 0) {
        const { count: resolvedSessionCount, error: sessionCountError } = await scopedSupabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .in("camp_id", activeCampIds)

        if (sessionCountError) {
          throw new Error(
            `Could not count sessions for usage in organization ${organizationId}: ${sessionCountError.message}`,
          )
        }

        sessionCount = resolvedSessionCount ?? 0
      }
    }
  }

  return {
    teams: teamsCount ?? 0,
    venues: venuesCount ?? 0,
    camps: campCount,
    sessions: sessionCount,
  }
}

export function hasActivePaidSubscription(input: {
  planTier: PlanTier
  status: SubscriptionStatus
}): boolean {
  if (!PAID_PLAN_TIERS.includes(input.planTier)) {
    return true
  }

  return input.status === "active"
}

export async function resolveOrganizationBillingSnapshot(
  organizationId: string,
  supabase?: ServerSupabaseClient,
): Promise<OrganizationBillingSnapshot> {
  const scopedSupabase = supabase ?? (await createServerSupabaseClient())
  const [subscription, usage] = await Promise.all([
    resolveOrganizationSubscription(organizationId, scopedSupabase),
    resolveOrganizationUsage(organizationId, scopedSupabase),
  ])

  return {
    organizationId,
    subscription,
    usage,
    limits: BILLING_PLAN_LIMITS[subscription.planTier],
    capabilities: BILLING_PLAN_CAPABILITIES[subscription.planTier],
    hasActivePaidStatus: hasActivePaidSubscription({
      planTier: subscription.planTier,
      status: subscription.status,
    }),
  }
}

export async function resolveOrganizationWriteEntitlement(input: {
  organizationId: string
  resource: BillingResource
  supabase?: ServerSupabaseClient
}): Promise<OrganizationWriteEntitlementDecision> {
  const snapshot = await resolveOrganizationBillingSnapshot(
    input.organizationId,
    input.supabase,
  )
  const currentUsage = snapshot.usage[input.resource]
  const resourceLimit = snapshot.limits[input.resource]

  if (!snapshot.hasActivePaidStatus) {
    return {
      allowed: false,
      reason: "payment_required",
      organizationId: input.organizationId,
      resource: input.resource,
      usage: snapshot.usage,
      limits: snapshot.limits,
      planTier: snapshot.subscription.planTier,
      billingCycle: snapshot.subscription.billingCycle,
      subscriptionStatus: snapshot.subscription.status,
      currentUsage,
      resourceLimit,
    }
  }

  if (resourceLimit !== null && currentUsage >= resourceLimit) {
    return {
      allowed: false,
      reason: "plan_limit_reached",
      organizationId: input.organizationId,
      resource: input.resource,
      usage: snapshot.usage,
      limits: snapshot.limits,
      planTier: snapshot.subscription.planTier,
      billingCycle: snapshot.subscription.billingCycle,
      subscriptionStatus: snapshot.subscription.status,
      currentUsage,
      resourceLimit,
    }
  }

  return {
    allowed: true,
    reason: null,
    organizationId: input.organizationId,
    resource: input.resource,
    usage: snapshot.usage,
    limits: snapshot.limits,
    planTier: snapshot.subscription.planTier,
    billingCycle: snapshot.subscription.billingCycle,
    subscriptionStatus: snapshot.subscription.status,
    currentUsage,
    resourceLimit,
  }
}

async function resolveOrganizationCapabilityEntitlement(input: {
  capability: keyof PlanCapabilities
  organizationId: string
  supabase?: ServerSupabaseClient
}): Promise<OrganizationSessionAssetUploadEntitlementDecision> {
  const snapshot = await resolveOrganizationBillingSnapshot(
    input.organizationId,
    input.supabase,
  )

  if (!snapshot.hasActivePaidStatus) {
    return {
      allowed: false,
      reason: "payment_required",
      organizationId: input.organizationId,
      planTier: snapshot.subscription.planTier,
      subscriptionStatus: snapshot.subscription.status,
    }
  }

  if (!snapshot.capabilities[input.capability]) {
    return {
      allowed: false,
      reason: "plan_limit_reached",
      organizationId: input.organizationId,
      planTier: snapshot.subscription.planTier,
      subscriptionStatus: snapshot.subscription.status,
    }
  }

  return {
    allowed: true,
    reason: null,
    organizationId: input.organizationId,
    planTier: snapshot.subscription.planTier,
    subscriptionStatus: snapshot.subscription.status,
  }
}

export async function resolveOrganizationSessionAssetUploadEntitlement(input: {
  organizationId: string
  supabase?: ServerSupabaseClient
}): Promise<OrganizationSessionAssetUploadEntitlementDecision> {
  return resolveOrganizationCapabilityEntitlement({
    ...input,
    capability: "sessionAssetUploads",
  })
}

export async function resolveOrganizationTeamExpensesEntitlement(input: {
  organizationId: string
  supabase?: ServerSupabaseClient
}): Promise<OrganizationTeamExpensesEntitlementDecision> {
  return resolveOrganizationCapabilityEntitlement({
    ...input,
    capability: "teamExpenses",
  })
}
