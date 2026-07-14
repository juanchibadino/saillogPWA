export const SUBSCRIPTION_PLAN_UPDATED_EVENT = "dockout:subscription-plan-updated"

export type SubscriptionPlanUpdatedEventDetail = {
  organizationId: string
  planTier: "free" | "pro" | "premium"
}
