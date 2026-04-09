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

export function VenuesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-36" />
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
