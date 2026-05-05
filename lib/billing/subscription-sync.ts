import "server-only"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"

import {
  fetchPaypalSubscription,
  getSubscriptionStatusFromEventType,
  isUuid,
  resolveBillingCycleFromPaypalPlanId,
  type PaypalSubscription,
  type PaypalSubscriptionSyncResult,
} from "./paypal"

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"]

type SyncInput = {
  subscriptionId?: string
  subscription?: PaypalSubscription
  eventType?: string
  fallbackOrganizationId?: string
  createdByProfileId?: string | null
}

function resolveOrganizationId(input: {
  customId?: string
  fallbackOrganizationId?: string
}): string | null {
  const customId = input.customId?.trim()

  if (customId && isUuid(customId)) {
    return customId
  }

  const fallbackOrganizationId = input.fallbackOrganizationId?.trim()

  if (fallbackOrganizationId && isUuid(fallbackOrganizationId)) {
    return fallbackOrganizationId
  }

  return null
}

function resolveStatus(input: {
  eventType?: string
  paypalStatus: string
}): SubscriptionStatus {
  if (!input.eventType) {
    return getSubscriptionStatusFromEventType({
      eventType: "BILLING.SUBSCRIPTION.UPDATED",
      paypalStatus: input.paypalStatus,
    })
  }

  return getSubscriptionStatusFromEventType({
    eventType: input.eventType,
    paypalStatus: input.paypalStatus,
  })
}

export async function syncOrganizationSubscriptionFromPaypal(
  input: SyncInput,
): Promise<PaypalSubscriptionSyncResult> {
  const subscription = input.subscription
    ? input.subscription
    : await fetchPaypalSubscription(input.subscriptionId ?? "")

  const paypalPlanId = subscription.plan_id?.trim()

  if (!paypalPlanId) {
    throw new Error("PayPal subscription payload is missing plan_id.")
  }

  const billingCycle = resolveBillingCycleFromPaypalPlanId(paypalPlanId)

  if (!billingCycle) {
    throw new Error(`Unsupported PayPal plan id: ${paypalPlanId}`)
  }

  const organizationId = resolveOrganizationId({
    customId: subscription.custom_id,
    fallbackOrganizationId: input.fallbackOrganizationId,
  })

  if (!organizationId) {
    throw new Error("Could not resolve organization_id from PayPal subscription payload.")
  }

  const subscriptionStatus = resolveStatus({
    eventType: input.eventType,
    paypalStatus: subscription.status,
  })

  const currentPeriodStartAt = subscription.start_time ?? null
  const currentPeriodEndAt = subscription.billing_info?.next_billing_time ?? null

  const adminSupabase = createAdminSupabaseClient()
  const { error } = await adminSupabase.from("organization_subscriptions").upsert(
    {
      organization_id: organizationId,
      plan_tier: "pro",
      billing_cycle: billingCycle,
      status: subscriptionStatus,
      paypal_subscription_id: subscription.id,
      paypal_plan_id: paypalPlanId,
      current_period_start_at: currentPeriodStartAt,
      current_period_end_at: currentPeriodEndAt,
      created_by_profile_id: input.createdByProfileId ?? null,
    },
    {
      onConflict: "organization_id",
    },
  )

  if (error) {
    throw new Error(`Could not sync organization subscription: ${error.message}`)
  }

  return {
    organizationId,
    planTier: "pro",
    billingCycle,
    status: subscriptionStatus,
    paypalPlanId,
    paypalSubscriptionId: subscription.id,
    currentPeriodStartAt,
    currentPeriodEndAt,
  }
}
