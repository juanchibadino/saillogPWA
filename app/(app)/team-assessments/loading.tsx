import { TeamAssessmentsCreatedTabSkeleton } from "@/features/assessments/team-assessments-tab-skeletons"
import { Skeleton } from "@/components/ui/skeleton"

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

      <TeamAssessmentsCreatedTabSkeleton />
    </div>
  )
}
