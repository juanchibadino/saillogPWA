import { Skeleton } from "@/components/ui/skeleton"

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

export function GlobalPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </main>
  )
}

export function InAppContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`row-${index}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={`home-card-${index}`} />
        ))}
      </div>
    </div>
  )
}

export function TeamHomePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`team-home-kpi-${index}`} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`team-home-list-${index}`} className="rounded-xl border bg-card p-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <Skeleton key={`team-home-list-row-${index}-${rowIndex}`} className="h-16 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 lg:col-span-3">
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function TeamCampsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`team-camps-row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TeamSessionsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-64" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`team-sessions-row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SessionDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={`session-detail-kpi-${index}`} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`session-detail-tab-${index}`} className="h-9 w-24 rounded-full" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`session-detail-row-${index}`} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CampDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`camp-detail-kpi-${index}`} />
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`camp-detail-tab-${index}`} className="h-9 w-24 rounded-full" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`camp-detail-row-${index}`} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function VenuesPageSkeleton() {
  return (
    <div className="space-y-6">

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`venue-row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function VenueDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`venue-detail-year-${index}`} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`venue-detail-kpi-${index}`} />
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`venue-detail-tab-${index}`} className="h-9 w-24 rounded-full" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`venue-detail-row-${index}`} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SignInPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    </main>
  )
}
