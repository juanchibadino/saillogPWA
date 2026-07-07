import { GradientCard } from "@/components/shared/gradient-card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Skeleton className="h-9 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-9 w-9" />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <GradientCard key={`assessment-detail-card-${index}`} className="p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-24" />
            </GradientCard>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <GradientCard key={`assessment-chart-${index}`} className="space-y-3 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-72 w-full" />
          </GradientCard>
        ))}
      </div>

      <GradientCard className="overflow-hidden p-0">
        <div className="border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`assessment-summary-${index}`} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))}
        </div>
      </GradientCard>
    </div>
  )
}
