import type { Database } from "@/types/database"

import {
  BILLING_PLAN_CAPABILITIES_CORE,
  BILLING_PLAN_LIMITS_CORE,
  PAID_PLAN_TIERS_CORE,
} from "./subscription-rules.mjs"

export type PlanTier = Database["public"]["Enums"]["plan_tier"]
export type BillingCycle = Database["public"]["Enums"]["billing_cycle"]
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"]

export type LimitValue = number | null

export type PlanLimits = {
  teams: LimitValue
  venues: LimitValue
  camps: LimitValue
  sessions: LimitValue
}

export type PlanCapabilities = {
  sessionAssetUploads: boolean
  teamExpenses: boolean
}

export const BILLING_PLAN_LIMITS = BILLING_PLAN_LIMITS_CORE as Record<
  PlanTier,
  PlanLimits
>

export const BILLING_PLAN_CAPABILITIES = BILLING_PLAN_CAPABILITIES_CORE as Record<
  PlanTier,
  PlanCapabilities
>

export type BillingResource = keyof PlanLimits

export const PAID_PLAN_TIERS = PAID_PLAN_TIERS_CORE as PlanTier[]
