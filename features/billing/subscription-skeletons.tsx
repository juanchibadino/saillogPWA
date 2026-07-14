import { GradientCard } from "@/components/shared/gradient-card"
import { Skeleton } from "@/components/ui/skeleton"

function PlanCardSkeleton() {
  return (
    <GradientCard className="min-h-[27rem] rounded-lg border p-5 shadow-sm sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton className="h-12 w-28" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="h-px bg-border" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </GradientCard>
  )
}

export function SubscriptionTabsSkeleton() {
  return (
    <>
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] md:hidden">
        <Skeleton className="h-full min-w-0 flex-1 rounded-md" />
        <Skeleton className="ml-1 h-full min-w-0 flex-1 rounded-md" />
      </div>
      <div className="hidden h-10 w-56 items-center rounded-lg bg-muted p-[3px] md:flex">
        <Skeleton className="h-full min-w-0 flex-1 rounded-md" />
        <Skeleton className="ml-1 h-full min-w-0 flex-1 rounded-md" />
      </div>
    </>
  )
}

export function SubscriptionBillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <PlanCardSkeleton />
        <PlanCardSkeleton />
        <PlanCardSkeleton />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SubscriptionInvoiceSkeleton() {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="grid grid-cols-5 gap-4 border-b p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-4 border-b p-4 last:border-b-0">
            {Array.from({ length: 5 }, (_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}
