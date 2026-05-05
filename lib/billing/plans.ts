import type { Database } from "@/types/database"

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

export const BILLING_PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
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
  olympic: {
    teams: 30,
    venues: null,
    camps: null,
    sessions: null,
  },
}

export type BillingResource = keyof PlanLimits

export const PAID_PLAN_TIERS: PlanTier[] = ["pro", "olympic"]
