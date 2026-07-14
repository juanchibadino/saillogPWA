import {
  SubscriptionBillingSkeleton,
  SubscriptionTabsSkeleton,
} from "@/features/billing/subscription-skeletons"

export default function SubscriptionLoading() {
  return (
    <div className="space-y-6">
      <SubscriptionTabsSkeleton />
      <SubscriptionBillingSkeleton />
    </div>
  )
}
