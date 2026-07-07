import { GradientCard } from "@/components/shared/gradient-card"
import { Skeleton } from "@/components/ui/skeleton"

const ASSESSMENT_RUN_TABLE_HEADERS = [
  "Assessment",
  "Venue",
  "Camps",
  "Progress",
  "Status",
  "Created",
]
const ASSESSMENT_RUN_TABLE_GRID_CLASS =
  "grid grid-cols-[1.35fr_1fr_1fr_0.7fr_0.7fr_0.8fr_3rem] items-center gap-4"

export function TeamAssessmentsCreatedTabSkeleton() {
  return (
    <section className="space-y-4">
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
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${ASSESSMENT_RUN_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {ASSESSMENT_RUN_TABLE_HEADERS.map((header) => (
            <span key={`assessment-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`assessment-row-${index}`}
              className={`${ASSESSMENT_RUN_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-44" />
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-36" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden items-center gap-1 md:flex">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-16" />
      </div>
    </section>
  )
}

export function TeamAssessmentsTemplatesTabSkeleton({
  canManageAssessments,
}: {
  canManageAssessments: boolean
}) {
  void canManageAssessments

  return (
    <section className="space-y-3">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <GradientCard key={`assessment-template-mobile-${index}`} className="px-3 py-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div className="grid grid-cols-[1.1fr_1fr_0.8fr] gap-4 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
          <span>Template</span>
          <span>Structure</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`assessment-template-row-${index}`}
              className="grid min-h-12 grid-cols-[1.1fr_1fr_0.8fr] gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-full max-w-40" />
              <Skeleton className="h-4 w-full max-w-48" />
              <Skeleton className="h-4 w-full max-w-24" />
            </div>
          ))}
        </div>
      </GradientCard>
    </section>
  )
}

export function TeamAssessmentTemplateEditorSkeleton() {
  return (
    <GradientCard
      aria-label="Loading template editor"
      className="space-y-4 p-4 md:p-5"
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full md:h-8" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full md:h-8" />
            </div>
            <Skeleton className="h-11 w-full md:h-8 md:w-36" />
            <Skeleton className="h-11 w-11 md:h-8 md:w-8" />
          </div>

          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`assessment-template-editor-item-${index}`}
                className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-11 w-full md:h-8" />
                </div>
                <Skeleton className="h-11 w-full md:h-8 md:w-28" />
                <Skeleton className="h-11 w-11 md:h-8 md:w-8" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 md:flex-row md:justify-end">
          <Skeleton className="h-8 w-full md:w-20" />
          <Skeleton className="h-8 w-full md:w-32" />
        </div>
      </div>
    </GradientCard>
  )
}
