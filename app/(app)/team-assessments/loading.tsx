import { TeamAssessmentsCreatedTabSkeleton } from "@/features/assessments/team-assessments-tab-skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex h-11 w-full max-w-full items-center gap-1 rounded-lg bg-muted p-[3px] md:hidden">
          <Skeleton className="h-full min-w-0 flex-1 rounded-md" />
          <Skeleton className="h-full min-w-0 flex-1 rounded-md" />
        </div>
        <div className="hidden h-10 items-center gap-1 rounded-lg bg-muted p-[3px] md:inline-flex">
          <Skeleton className="h-full w-24 rounded-md" />
          <Skeleton className="h-full w-28 rounded-md" />
        </div>
        <Skeleton className="h-11 w-11 md:h-9 md:w-24" />
      </section>

      <TeamAssessmentsCreatedTabSkeleton />
    </div>
  )
}
