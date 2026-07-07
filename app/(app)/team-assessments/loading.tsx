import { GradientCard } from "@/components/shared/gradient-card"
import { Skeleton } from "@/components/ui/skeleton"

function AssessmentRowsSkeleton() {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`assessment-mobile-row-${index}`} className="p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-52" />
              <Skeleton className="h-3 w-32" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div className="grid grid-cols-[1.35fr_1fr_1fr_0.7fr_0.7fr] gap-4 border-b bg-muted/40 px-4 py-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`assessment-header-${index}`} className="h-4 w-24" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`assessment-row-${index}`}
              className="grid grid-cols-[1.35fr_1fr_1fr_0.7fr_0.7fr] gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </GradientCard>
    </>
  )
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid h-10 w-full grid-cols-2 gap-1 rounded-lg bg-muted p-[3px] md:inline-flex md:w-fit">
          <Skeleton className="h-full w-full rounded-md md:w-24" />
          <Skeleton className="h-full w-full rounded-md md:w-28" />
        </div>
        <Skeleton className="h-11 w-11 md:h-9 md:w-24" />
      </section>

      <AssessmentRowsSkeleton />
    </div>
  )
}
