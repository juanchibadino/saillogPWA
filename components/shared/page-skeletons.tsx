import { ChevronDownIcon, PlusIcon, Settings2Icon } from "lucide-react"

import { GradientCard } from "@/components/shared/gradient-card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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

export function RootTransitionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="size-8 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground"
        />
        <p className="text-sm font-medium text-muted-foreground">
          Loading Sailog...
        </p>
      </div>
    </main>
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

const TEAM_CAMPS_TABLE_HEADERS = [
  "Camp",
  "Venue",
  "Type",
  "Date Range",
  "# Sessions",
  "Status",
]
const TEAM_CAMPS_TABLE_GRID_CLASS =
  "grid grid-cols-[1.2fr_1fr_0.7fr_1fr_0.65fr_0.65fr_3rem] items-center gap-4"

export function TeamCampsChromeSkeleton() {
  return (
    <section className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
        Camps
      </h1>
      <h2 className="hidden text-lg font-semibold md:block">Camps</h2>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground opacity-70 md:hidden"
          aria-label="Loading filters"
        >
          <Skeleton className="size-4" />
        </button>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
          >
            <PlusIcon className="size-4" />
            New
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading new camp action"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

export function TeamCampsResultsSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-camps-mobile-row-${index}`} className="p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-52" />
              <Skeleton className="h-3 w-44" />
            </div>
          </GradientCard>
        ))}
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_CAMPS_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_CAMPS_TABLE_HEADERS.map((header) => (
            <span key={`team-camps-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-camps-desktop-row-${index}`}
              className={`${TEAM_CAMPS_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-4 w-full max-w-12" />
              <Skeleton className="h-4 w-full max-w-16" />
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

export function TeamCampsPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamCampsChromeSkeleton />
      <TeamCampsResultsSkeleton />
    </div>
  )
}

const TEAM_SESSIONS_TABLE_HEADERS = [
  "Date",
  "Type",
  "Camp",
  "Venue",
  "Net Time",
  "Highlight",
]
const TEAM_SESSIONS_TABLE_GRID_CLASS =
  "grid grid-cols-[1.1fr_0.7fr_1fr_1fr_0.75fr_0.75fr_3rem] items-center gap-4"

export function TeamSessionsChromeSkeleton() {
  return (
    <section className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
        Sessions
      </h1>
      <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground opacity-70 md:hidden"
          aria-label="Loading filters"
        >
          <Skeleton className="size-4" />
        </button>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
          >
            <PlusIcon className="size-4" />
            New
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading new session action"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

export function TeamSessionsResultsSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-sessions-mobile-row-${index}`} className="p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-52" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_SESSIONS_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_SESSIONS_TABLE_HEADERS.map((header) => (
            <span key={`team-sessions-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-sessions-desktop-row-${index}`}
              className={`${TEAM_SESSIONS_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-4 w-full max-w-12" />
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

export function TeamSessionsPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamSessionsChromeSkeleton />
      <TeamSessionsResultsSkeleton />
    </div>
  )
}

const TEAM_VENUES_TABLE_HEADERS = ["Venue", "Location", "# Camps"]
const TEAM_VENUES_TABLE_GRID_CLASS =
  "grid grid-cols-[1.2fr_1fr_0.7fr_3rem] items-center gap-4"

export function TeamVenuesChromeSkeleton() {
  return (
    <section className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
        Venues
      </h1>
      <h2 className="hidden text-lg font-semibold md:block">Venues</h2>

      <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground opacity-70 md:hidden"
          aria-label="Loading status filter"
        >
          <Skeleton className="size-4" />
        </button>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Skeleton className="h-8 w-28" />
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
          >
            <PlusIcon className="size-4" />
            New
          </button>
        </div>

        <button
          type="button"
          disabled
          className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
          aria-label="Loading new team venue action"
        >
          <PlusIcon className="size-6" />
        </button>
      </div>
    </section>
  )
}

export function TeamVenuesResultsSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-venues-mobile-row-${index}`} className="p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </GradientCard>
        ))}
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_VENUES_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_VENUES_TABLE_HEADERS.map((header) => (
            <span key={`team-venues-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-venues-desktop-row-${index}`}
              className={`${TEAM_VENUES_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-4 w-full max-w-12" />
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

export function TeamVenuesPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamVenuesChromeSkeleton />
      <TeamVenuesResultsSkeleton />
    </div>
  )
}

const TEAM_GEAR_TABLE_HEADERS = [
  "Name",
  "Type",
  "Usage",
  "Status",
  "Condition",
  "Alerts",
]
const TEAM_GEAR_TABLE_GRID_CLASS =
  "grid grid-cols-[1.15fr_0.75fr_1fr_0.75fr_0.8fr_0.9fr_3rem] items-center gap-4"

export function TeamGearChromeSkeleton() {
  return (
    <section className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
        Gear
      </h1>
      <h2 className="hidden text-lg font-semibold md:block">Gear</h2>

      <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground opacity-70 md:hidden"
          aria-label="Loading gear filters"
        >
          <Settings2Icon className="size-5" />
        </button>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
          >
            <PlusIcon className="size-4" />
            New
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading new gear action"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

export function TeamGearResultsSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-gear-mobile-row-${index}`} className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0" />
            </div>
          </GradientCard>
        ))}
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_GEAR_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_GEAR_TABLE_HEADERS.map((header) => (
            <span key={`team-gear-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-gear-desktop-row-${index}`}
              className={`${TEAM_GEAR_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-5 w-full max-w-24" />
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
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-16" />
      </div>
    </section>
  )
}

export function TeamGearPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamGearChromeSkeleton />
      <TeamGearResultsSkeleton />
    </div>
  )
}

export function TeamNotesPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Skeleton className="h-10 w-full sm:w-96" />
        <Skeleton className="h-9 w-full sm:w-28" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`team-notes-card-${index}`} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-10 w-32" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <Skeleton className="h-4 w-24" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border p-4">
              <Skeleton className="h-4 w-20" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const TEAM_STANDARD_MOVES_TABLE_HEADERS = [
  "Name",
  "Description",
  "Used By",
  "Updated",
  "Status",
]
const TEAM_STANDARD_MOVES_TABLE_GRID_CLASS =
  "grid grid-cols-[minmax(0,20fr)_minmax(0,53fr)_minmax(0,7fr)_minmax(0,10fr)_minmax(0,6fr)_3rem] items-center gap-4"

export function TeamStandardMovesChromeSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Standard Moves
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Standard Moves</h2>

        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <button
            type="button"
            disabled
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground opacity-70 md:hidden"
            aria-label="Loading status filters"
          >
            <Skeleton className="size-4" />
          </button>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <Skeleton className="h-8 w-28" />
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
            >
              <PlusIcon className="size-4" />
              New
            </button>
          </div>
        </div>
      </header>

      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading new standard move action"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

export function TeamStandardMovesResultsSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-standard-moves-mobile-row-${index}`} className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-52 max-w-full" />
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0" />
            </div>
          </GradientCard>
        ))}
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_STANDARD_MOVES_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_STANDARD_MOVES_TABLE_HEADERS.map((header) => (
            <span key={`team-standard-moves-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-standard-moves-desktop-row-${index}`}
              className={`${TEAM_STANDARD_MOVES_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-48" />
              <Skeleton className="h-4 w-full max-w-10" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-5 w-full max-w-16" />
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

export function TeamStandardMovesPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamStandardMovesChromeSkeleton />
      <TeamStandardMovesResultsSkeleton />
    </div>
  )
}

const TEAM_WIND_PATTERNS_TABLE_HEADERS = [
  "Name",
  "Description",
  "Venue",
  "Updated",
  "Status",
]
const TEAM_WIND_PATTERNS_TABLE_GRID_CLASS =
  "grid grid-cols-[minmax(0,15fr)_minmax(0,47fr)_minmax(0,18fr)_minmax(0,10fr)_minmax(0,6fr)_3rem] items-center gap-4"

export function TeamWindPatternsChromeSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Wind Patterns
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Wind Patterns</h2>

        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <button
            type="button"
            disabled
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground opacity-70 md:hidden"
            aria-label="Loading status filters"
          >
            <Skeleton className="size-4" />
          </button>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <Skeleton className="h-8 w-28" />
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
            >
              <PlusIcon className="size-4" />
              New
            </button>
          </div>
        </div>
      </header>

      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading new wind pattern action"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

export function TeamWindPatternsResultsSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`team-wind-patterns-mobile-row-${index}`} className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-52 max-w-full" />
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0" />
            </div>
          </GradientCard>
        ))}
        <div className="pb-4 pt-3">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${TEAM_WIND_PATTERNS_TABLE_GRID_CLASS} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {TEAM_WIND_PATTERNS_TABLE_HEADERS.map((header) => (
            <span key={`team-wind-patterns-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`team-wind-patterns-desktop-row-${index}`}
              className={`${TEAM_WIND_PATTERNS_TABLE_GRID_CLASS} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-48" />
              <Skeleton className="h-6 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-5 w-full max-w-16" />
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

export function TeamWindPatternsPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamWindPatternsChromeSkeleton />
      <TeamWindPatternsResultsSkeleton />
    </div>
  )
}

function TeamAssetCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-full max-w-36" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

export function TeamAssetsChromeSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 min-w-0 flex-1 grid-cols-2 rounded-lg bg-muted p-1 md:max-w-56 md:flex-none">
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
        </div>

        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground opacity-70 md:hidden"
          aria-label="Loading asset filters"
        >
          <Skeleton className="size-4" />
        </button>

        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
          {["Venue", "Year", "Camp", "Session"].map((filterLabel) => (
            <button
              key={`team-assets-filter-${filterLabel}`}
              type="button"
              disabled
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground opacity-70"
            >
              <Skeleton className="h-3 w-14" />
              <ChevronDownIcon className="size-4" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TeamAssetsResultsSkeleton() {
  return (
    <section className="space-y-8" aria-busy="true">
      {Array.from({ length: 2 }).map((_, venueIndex) => (
        <div key={`team-assets-venue-${venueIndex}`} className="space-y-4">
          <header className="border-b pb-3">
            <Skeleton className="h-5 w-40" />
          </header>

          <div className="space-y-6">
            {Array.from({ length: 2 }).map((__, sessionIndex) => (
              <section
                key={`team-assets-session-${venueIndex}-${sessionIndex}`}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((___, assetIndex) => (
                    <TeamAssetCardSkeleton
                      key={`team-assets-card-${venueIndex}-${sessionIndex}-${assetIndex}`}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export function TeamAssetsPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamAssetsChromeSkeleton />
      <TeamAssetsResultsSkeleton />
    </div>
  )
}

const TEAM_REPORTS_TABLE_HEADERS = ["Report", "Venue", "Camps", "Created"]
const TEAM_REPORTS_TABLE_GRID_CLASS =
  "grid grid-cols-[1.3fr_1fr_1fr_0.9fr_7rem] items-center gap-4"
const ORGANIZATION_REPORTS_TABLE_HEADERS = ["Report", "Team", "Venue", "Camps", "Created"]
const ORGANIZATION_REPORTS_TABLE_GRID_CLASS =
  "grid grid-cols-[1.3fr_1fr_1fr_1fr_0.9fr_7rem] items-center gap-4"

export function TeamReportsResultsSkeleton() {
  return (
    <ReportsResultsSkeleton
      headers={TEAM_REPORTS_TABLE_HEADERS}
      tableGridClassName={TEAM_REPORTS_TABLE_GRID_CLASS}
      rowKeyPrefix="team-reports"
    />
  )
}

export function OrganizationReportsResultsSkeleton() {
  return (
    <ReportsResultsSkeleton
      headers={ORGANIZATION_REPORTS_TABLE_HEADERS}
      tableGridClassName={ORGANIZATION_REPORTS_TABLE_GRID_CLASS}
      rowKeyPrefix="org-reports"
    />
  )
}

function ReportsResultsSkeleton({
  headers,
  rowKeyPrefix,
  tableGridClassName,
}: {
  headers: string[]
  rowKeyPrefix: string
  tableGridClassName: string
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`${rowKeyPrefix}-mobile-row-${index}`} className="p-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
                <Skeleton className="h-3 w-36 max-w-full" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-11 w-11 rounded-lg" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${tableGridClassName} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {headers.map((header) => (
            <span key={`${rowKeyPrefix}-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`${rowKeyPrefix}-desktop-row-${index}`}
              className={`${tableGridClassName} min-h-12 px-4 py-3`}
            >
              {headers.map((header, headerIndex) => (
                <Skeleton
                  key={`${rowKeyPrefix}-desktop-row-${index}-${header}`}
                  className={cn(
                    "h-4 w-full",
                    headerIndex === 0 ? "max-w-36" : "max-w-24",
                  )}
                />
              ))}
              <Skeleton className="ml-auto h-7 w-16" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden items-center gap-1 md:flex">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-16" />
      </div>
    </section>
  )
}

export function TeamReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Reports
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Reports</h2>
        <Skeleton className="hidden h-7 w-20 md:block" />
        <Skeleton className="size-14 rounded-full md:hidden" />
      </header>

      <TeamReportsResultsSkeleton />
    </div>
  )
}

export function OrganizationReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Reports
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Reports</h2>
        <Skeleton className="h-11 w-24 md:hidden" />
        <div className="hidden md:block">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-32" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-64" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-72" />
            </div>
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </header>

      <OrganizationReportsResultsSkeleton />
    </div>
  )
}

function TeamAssessmentDetailHeaderSkeleton({
  canManageAssessments = true,
}: {
  canManageAssessments?: boolean
}) {
  return (
    <section className="space-y-4" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        {canManageAssessments ? <Skeleton className="h-9 w-9" /> : null}
      </div>
    </section>
  )
}

function TeamAssessmentDetailAnalyticsSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <GradientCard className="space-y-4 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <h2 className="text-base font-semibold">Analytics</h2>

          <div className="grid gap-3 md:grid-cols-[max-content_max-content_max-content] md:items-end xl:ml-auto xl:w-auto">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>

        <Skeleton className="h-72 w-full" />
      </GradientCard>
    </section>
  )
}

function TeamAssessmentDetailAnswersSkeleton() {
  return (
    <GradientCard className="overflow-hidden p-0" aria-busy="true">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-base font-semibold">Answers</h2>
      </div>

      <div className="divide-y divide-border md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <article
            key={`team-assessment-mobile-answer-${index}`}
            className="space-y-3 px-4 py-3"
          >
            <Skeleton className="h-4 w-full max-w-48" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[minmax(16rem,1fr)_7rem_7rem_7rem] gap-4 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
          <span>Indicator</span>
          <span>Crew 1</span>
          <span>Crew 2</span>
          <span>Crew 3</span>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`team-assessment-desktop-answer-${index}`}
              className="grid min-h-12 grid-cols-[minmax(16rem,1fr)_7rem_7rem_7rem] items-center gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-full max-w-56" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </GradientCard>
  )
}

export function TeamAssessmentDetailDeferredContentSkeleton({
  canManageAssessments = true,
}: {
  canManageAssessments?: boolean
}) {
  return (
    <>
      <TeamAssessmentDetailHeaderSkeleton canManageAssessments={canManageAssessments} />
      <TeamAssessmentDetailAnalyticsSkeleton />
      <TeamAssessmentDetailAnswersSkeleton />
    </>
  )
}

export function TeamAssessmentDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <TeamAssessmentDetailDeferredContentSkeleton />
    </div>
  )
}

type SessionDetailSkeletonTab =
  | "info"
  | "goals"
  | "results"
  | "images"
  | "analytics"
  | "gear"

const SESSION_DETAIL_SUMMARY_LABELS = ["Type", "Date", "Dock Out", "Duration"]
const SESSION_DETAIL_TABS: Array<{
  label: string
  value: SessionDetailSkeletonTab
}> = [
  { label: "Info", value: "info" },
  { label: "Goals", value: "goals" },
  { label: "Results", value: "results" },
  { label: "Images", value: "images" },
  { label: "Analytics", value: "analytics" },
  { label: "Gear", value: "gear" },
]
const SESSION_DETAIL_DEFAULT_MOBILE_TABS: SessionDetailSkeletonTab[] = [
  "info",
  "goals",
  "results",
  "images",
]
const SESSION_DETAIL_TAB_LABEL_BY_VALUE = new Map(
  SESSION_DETAIL_TABS.map((tab) => [tab.value, tab.label]),
)

function getSessionDetailMobileSkeletonTabs(
  selectedTab: SessionDetailSkeletonTab,
): SessionDetailSkeletonTab[] {
  if (SESSION_DETAIL_DEFAULT_MOBILE_TABS.includes(selectedTab)) {
    return SESSION_DETAIL_DEFAULT_MOBILE_TABS
  }

  return ["info", "goals", "results", selectedTab]
}

export function SessionDetailHeaderActionsSkeleton({
  canManageSession = true,
}: {
  canManageSession?: boolean
}) {
  if (!canManageSession) {
    return null
  }

  return (
    <div className="flex items-center gap-2" aria-busy="true">
      <button
        type="button"
        disabled
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading session setup"
      >
        <Settings2Icon className="size-6" />
      </button>
      <button
        type="button"
        disabled
        className="hidden h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70 md:inline-flex"
      >
        Setup
      </button>
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70 md:h-8"
      >
        Edit
      </button>
    </div>
  )
}

export function SessionDetailSummaryCardsSkeleton() {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {SESSION_DETAIL_SUMMARY_LABELS.map((label) => (
            <div
              key={`session-detail-mobile-summary-${label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-4">
        {SESSION_DETAIL_SUMMARY_LABELS.map((label) => (
          <GradientCard key={`session-detail-desktop-summary-${label}`} className="p-6">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-7 w-28" />
            </div>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

function SessionDetailTextPanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-40 max-w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="rounded-lg border bg-background p-4 md:col-span-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionDetailListPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <GradientCard key={`session-detail-mobile-panel-row-${index}`} className="p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </GradientCard>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_3rem] gap-4 bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`session-detail-desktop-panel-row-${index}`}
              className="grid min-h-14 grid-cols-[1fr_0.8fr_0.8fr_3rem] items-center gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-full max-w-40" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SessionDetailPanelSkeleton({
  selectedTab,
}: {
  selectedTab: SessionDetailSkeletonTab
}) {
  if (selectedTab === "images" || selectedTab === "analytics" || selectedTab === "gear") {
    return <SessionDetailListPanelSkeleton />
  }

  return <SessionDetailTextPanelSkeleton />
}

export function SessionDetailTabsSkeleton({
  selectedTab = "info",
}: {
  selectedTab?: SessionDetailSkeletonTab
}) {
  const mobileTabs = getSessionDetailMobileSkeletonTabs(selectedTab)

  return (
    <div className="space-y-4" aria-busy="true">
      <div className="space-y-4">
        <div className="flex h-11 w-full max-w-full items-center overflow-hidden rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
          {mobileTabs.map((tab) => (
            <button
              key={`session-detail-mobile-tab-${tab}`}
              type="button"
              disabled
              className="inline-flex h-[calc(100%-1px)] min-w-0 flex-1 basis-0 items-center justify-center truncate rounded-md px-2 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
              data-active={tab === selectedTab ? "true" : undefined}
            >
              {SESSION_DETAIL_TAB_LABEL_BY_VALUE.get(tab)}
            </button>
          ))}
          <button
            type="button"
            disabled
            className="inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground"
          >
            <span>More</span>
            <ChevronDownIcon className="size-4" />
          </button>
        </div>

        <div className="hidden h-10 items-center gap-1 rounded-lg bg-muted p-1 md:inline-flex">
          {SESSION_DETAIL_TABS.map((tab) => (
            <button
              key={`session-detail-desktop-tab-${tab.value}`}
              type="button"
              disabled
              className="inline-flex h-8 min-w-fit items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
              data-active={tab.value === selectedTab ? "true" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <SessionDetailPanelSkeleton selectedTab={selectedTab} />
        </section>
      </div>
    </div>
  )
}

export function SessionDetailDeferredContentSkeleton({
  selectedTab = "info",
}: {
  selectedTab?: SessionDetailSkeletonTab
}) {
  return (
    <>
      <SessionDetailSummaryCardsSkeleton />
      <SessionDetailTabsSkeleton selectedTab={selectedTab} />
    </>
  )
}

export function SessionDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team Session</h1>
          </div>

          <SessionDetailHeaderActionsSkeleton />
        </div>

        <SessionDetailSummaryCardsSkeleton />
      </section>

      <SessionDetailTabsSkeleton />
    </div>
  )
}

export type CampDetailSkeletonTab = "sessions" | "goals" | "notes"

const CAMP_DETAIL_SUMMARY_LABELS = [
  "Total Sessions",
  "Avg. Session",
  "Net Time Sailed",
  "Camp Dates",
]
const CAMP_DETAIL_TABS: Array<{
  label: string
  value: CampDetailSkeletonTab
}> = [
  { label: "Sessions", value: "sessions" },
  { label: "Goals", value: "goals" },
  { label: "Notes", value: "notes" },
]

export function CampDetailHeaderSkeleton() {
  return (
    <header className="flex flex-wrap items-center gap-2 md:gap-3" aria-busy="true">
      <Skeleton className="hidden h-8 w-56 md:block" />
      <Skeleton className="h-6 w-36 max-w-full rounded-full" />
    </header>
  )
}

export function CampDetailSummaryCardsSkeleton() {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-8">
          {CAMP_DETAIL_SUMMARY_LABELS.map((label) => (
            <div
              key={`camp-detail-mobile-summary-${label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {CAMP_DETAIL_SUMMARY_LABELS.map((label) => (
          <GradientCard key={`camp-detail-desktop-summary-${label}`}>
            <div className="space-y-3 px-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-7 w-28" />
            </div>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

function CampDetailSessionsPanelSkeleton() {
  const tableHeaders = [
    "Date",
    "Type",
    "Camp",
    "Venue",
    "Net Time",
    "Highlight",
  ]
  const tableGridClass =
    "grid grid-cols-[1.1fr_0.7fr_1fr_1fr_0.75fr_0.75fr_3rem] items-center gap-4"

  return (
    <section className="space-y-4" aria-busy="true">
      <div className="flex items-center justify-end gap-2 md:justify-between">
        <div className="flex w-full items-center justify-between gap-3 md:hidden">
          <h2 className="min-w-0 text-2xl font-semibold tracking-tight">Sessions</h2>
          <Skeleton className="h-11 w-11" />
        </div>

        <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard key={`camp-detail-mobile-session-${index}`} className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div
          className={`${tableGridClass} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
        >
          {tableHeaders.map((header) => (
            <span key={`camp-detail-sessions-header-${header}`} className="truncate">
              {header}
            </span>
          ))}
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`camp-detail-desktop-session-${index}`}
              className={`${tableGridClass} min-h-12 px-4 py-3`}
            >
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-4 w-full max-w-32" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-4 w-full max-w-12" />
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden items-center gap-1 md:flex">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-16" />
      </div>

      <button
        type="button"
        disabled
        aria-label="Loading new session action"
        className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
      >
        <PlusIcon className="size-6" />
      </button>
    </section>
  )
}

function CampDetailGoalsPanelSkeleton() {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6" aria-busy="true">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Camp Goals</h3>
            <p className="text-sm text-muted-foreground">
              Main objectives and priorities for this camp.
            </p>
          </div>
          <Skeleton className="h-11 w-20 md:h-8" />
        </div>

        <div className="min-h-48 rounded-xl border bg-muted/20 p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    </section>
  )
}

function CampDetailNotesPanelSkeleton() {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6" aria-busy="true">
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-base font-semibold">Session Notes</h3>
          <p className="text-sm text-muted-foreground">
            Notes and review points from sessions in this camp.
          </p>
        </header>

        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={`camp-detail-note-${index}`} className="rounded-xl border p-4">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </header>

              <dl className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <div key={`camp-detail-note-${index}-field-${itemIndex}`}>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-full" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-4 w-4/5" />
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function CampDetailPanelSkeleton({
  selectedTab = "sessions",
}: {
  selectedTab?: CampDetailSkeletonTab
}) {
  if (selectedTab === "goals") {
    return <CampDetailGoalsPanelSkeleton />
  }

  if (selectedTab === "notes") {
    return <CampDetailNotesPanelSkeleton />
  }

  return <CampDetailSessionsPanelSkeleton />
}

export function CampDetailTabsSkeleton({
  selectedTab = "sessions",
}: {
  selectedTab?: CampDetailSkeletonTab
}) {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
        <div className="flex h-full min-w-0 flex-1 rounded-md bg-transparent p-0">
          {CAMP_DETAIL_TABS.map((tab) => (
            <button
              key={`camp-detail-mobile-tab-${tab.value}`}
              type="button"
              disabled
              className="inline-flex h-full min-w-0 flex-1 basis-0 items-center justify-center rounded-md px-2 text-sm font-medium capitalize text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
              data-active={tab.value === selectedTab ? "true" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden h-10 items-center gap-1 rounded-lg bg-muted p-1 md:inline-flex">
        {CAMP_DETAIL_TABS.map((tab) => (
          <button
            key={`camp-detail-desktop-tab-${tab.value}`}
            type="button"
            disabled
            className="inline-flex h-8 min-w-fit items-center justify-center rounded-md px-3 text-sm font-medium capitalize text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
            data-active={tab.value === selectedTab ? "true" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CampDetailPanelSkeleton selectedTab={selectedTab} />
    </div>
  )
}

export function CampDetailDeferredContentSkeleton({
  selectedTab = "sessions",
}: {
  selectedTab?: CampDetailSkeletonTab
}) {
  return (
    <div className="space-y-6">
      <CampDetailSummaryCardsSkeleton />
      <CampDetailTabsSkeleton selectedTab={selectedTab} />
    </div>
  )
}

export function CampDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <CampDetailHeaderSkeleton />
      <CampDetailDeferredContentSkeleton />
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

export type VenueDetailSkeletonTab =
  | "camps"
  | "sessions"
  | "reports"
  | "assessments"
  | "wind-patterns"

const VENUE_DETAIL_SUMMARY_LABELS = [
  "Total Camps",
  "Total Sessions",
  "Avg. Session",
  "Net Time Sailed",
]

function formatVenueDetailSummarySkeletonLabel(
  label: string,
  selectedYear?: number,
): string {
  return typeof selectedYear === "number" ? `${label} ${selectedYear}` : label
}
const VENUE_DETAIL_TABS: Array<{
  label: string
  value: VenueDetailSkeletonTab
}> = [
  { label: "Camps", value: "camps" },
  { label: "Sessions", value: "sessions" },
  { label: "Reports", value: "reports" },
  { label: "Assess", value: "assessments" },
  { label: "Wind", value: "wind-patterns" },
]
const VENUE_DETAIL_DEFAULT_MOBILE_TABS: VenueDetailSkeletonTab[] = [
  "camps",
  "sessions",
  "reports",
  "assessments",
]
const VENUE_DETAIL_TAB_LABEL_BY_VALUE = new Map(
  VENUE_DETAIL_TABS.map((tab) => [tab.value, tab.label]),
)

function getVenueDetailMobileSkeletonTabs(
  selectedTab: VenueDetailSkeletonTab,
): VenueDetailSkeletonTab[] {
  if (VENUE_DETAIL_DEFAULT_MOBILE_TABS.includes(selectedTab)) {
    return VENUE_DETAIL_DEFAULT_MOBILE_TABS
  }

  return ["camps", "sessions", "reports", selectedTab]
}

function formatVenueDetailSkeletonPanelTitle(input: {
  selectedTab: VenueDetailSkeletonTab
  selectedYear?: number
}): string {
  if (input.selectedTab === "camps") {
    return typeof input.selectedYear === "number"
      ? `Camps ${input.selectedYear}`
      : "Camps"
  }

  if (input.selectedTab === "sessions") {
    return typeof input.selectedYear === "number"
      ? `Sessions ${input.selectedYear}`
      : "Sessions"
  }

  if (input.selectedTab === "reports") {
    return typeof input.selectedYear === "number"
      ? `Reports ${input.selectedYear}`
      : "Reports"
  }

  if (input.selectedTab === "wind-patterns") {
    return "Wind Patterns"
  }

  return typeof input.selectedYear === "number"
    ? `Assessments ${input.selectedYear}`
    : "Assessments"
}

export function VenueDetailSummaryCardsSkeleton({
  selectedYear,
}: {
  selectedYear?: number
} = {}) {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {VENUE_DETAIL_SUMMARY_LABELS.map((label) => (
            <div
              key={`venue-detail-mobile-summary-${label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">
                {formatVenueDetailSummarySkeletonLabel(label, selectedYear)}
              </p>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {VENUE_DETAIL_SUMMARY_LABELS.map((label) => (
          <GradientCard key={`venue-detail-desktop-summary-${label}`}>
            <div className="space-y-3 px-6">
              <p className="text-sm text-muted-foreground">
                {formatVenueDetailSummarySkeletonLabel(label, selectedYear)}
              </p>
              <Skeleton className="h-7 w-28" />
            </div>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

function VenueDetailSkeletonCreateButton() {
  return (
    <button
      type="button"
      disabled
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-70"
    >
      <PlusIcon className="size-4" />
      New
    </button>
  )
}

function VenueDetailSkeletonCreateFab({ ariaLabel }: { ariaLabel: string }) {
  return (
    <button
      type="button"
      disabled
      className="mobile-floating-action inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg shadow-black/20 md:hidden"
      aria-label={ariaLabel}
    >
      <PlusIcon className="size-6" />
    </button>
  )
}

function VenueDetailListPanelSkeleton({
  selectedTab,
  selectedYear,
}: {
  selectedTab: "camps" | "sessions" | "reports"
  selectedYear?: number
}) {
  const title = formatVenueDetailSkeletonPanelTitle({
    selectedTab,
    selectedYear,
  })
  const showToolbarSkeleton = selectedTab === "sessions"
  const showCreateSkeleton = selectedTab === "camps" || selectedTab === "reports"
  const createActionLabel = selectedTab === "reports" ? "report" : "camp"

  return (
    <section className="space-y-4" aria-busy="true">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          {title}
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">{title}</h2>

        {showToolbarSkeleton ? (
          <>
            <VenueDetailSkeletonCreateFab ariaLabel="Loading new session action" />
            <div className="hidden items-center justify-end gap-2 md:flex">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
              <VenueDetailSkeletonCreateButton />
            </div>
          </>
        ) : showCreateSkeleton ? (
          <>
            <VenueDetailSkeletonCreateFab
              ariaLabel={`Loading new ${createActionLabel} action`}
            />
            <div className="hidden items-center justify-end md:flex">
              <VenueDetailSkeletonCreateButton />
            </div>
          </>
        ) : null}
      </header>

      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <GradientCard
            key={`venue-detail-mobile-${selectedTab}-${index}`}
            className="px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
              <Skeleton
                className={
                  selectedTab === "reports"
                    ? "h-11 w-20 shrink-0"
                    : "h-11 w-11 shrink-0"
                }
              />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        {selectedTab === "reports" ? (
          <>
            <div className="grid h-10 grid-cols-[1.2fr_1.4fr_0.9fr_7rem] items-center gap-4 border-b bg-muted/40 px-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <span aria-hidden="true" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`venue-detail-desktop-${selectedTab}-${index}`}
                  className="grid min-h-14 grid-cols-[1.2fr_1.4fr_0.9fr_7rem] items-center gap-4 px-2 py-2"
                >
                  <Skeleton className="h-4 w-full max-w-40" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full max-w-20" />
                    <Skeleton className="h-3 w-full max-w-48" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-28" />
                  <Skeleton className="ml-auto h-7 w-16" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid h-10 grid-cols-[1.2fr_0.7fr_1fr_0.6fr_3rem] items-center gap-4 border-b bg-muted/40 px-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <span aria-hidden="true" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`venue-detail-desktop-${selectedTab}-${index}`}
                  className="grid min-h-12 grid-cols-[1.2fr_0.7fr_1fr_0.6fr_3rem] items-center gap-4 px-2 py-2"
                >
                  <Skeleton className="h-4 w-full max-w-40" />
                  <Skeleton className="h-4 w-full max-w-20" />
                  <Skeleton className="h-4 w-full max-w-28" />
                  <Skeleton className="h-4 w-full max-w-20" />
                  <Skeleton className="ml-auto h-8 w-8" />
                </div>
              ))}
            </div>
          </>
        )}
      </GradientCard>
    </section>
  )
}

function VenueDetailWindPatternsPanelSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
            Wind Patterns
          </h1>
          <h2 className="hidden text-lg font-semibold md:block">Wind Patterns</h2>
          <Skeleton className="hidden h-3 w-56 max-w-full md:block" />
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Skeleton className="h-8 w-24" />
          <VenueDetailSkeletonCreateButton />
        </div>
        <VenueDetailSkeletonCreateFab
          ariaLabel="Loading new wind pattern action"
        />
      </header>

      <div className="space-y-2 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <GradientCard
            key={`venue-detail-mobile-wind-pattern-${index}`}
            className="px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-3 w-full max-w-52" />
                <Skeleton className="h-3 w-44 max-w-full" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div className="grid h-10 grid-cols-[1fr_1.4fr_0.5fr_1fr_0.7fr_3rem] items-center gap-4 border-b bg-muted/40 px-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`venue-detail-desktop-wind-pattern-${index}`}
              className="grid min-h-12 grid-cols-[1fr_1.4fr_0.5fr_1fr_0.7fr_3rem] items-center gap-4 px-2 py-2"
            >
              <Skeleton className="h-4 w-full max-w-36" />
              <Skeleton className="h-4 w-full max-w-52" />
              <Skeleton className="h-4 w-full max-w-10" />
              <Skeleton className="h-4 w-full max-w-28" />
              <Skeleton className="h-5 w-full max-w-16" />
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </div>
      </GradientCard>
    </section>
  )
}

function VenueDetailAssessmentsPanelSkeleton({
  selectedYear,
}: {
  selectedYear?: number
}) {
  const title = formatVenueDetailSkeletonPanelTitle({
    selectedTab: "assessments",
    selectedYear,
  })

  return (
    <section className="space-y-4" aria-busy="true">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          {title}
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">{title}</h2>
        <div className="shrink-0">
          <VenueDetailSkeletonCreateFab ariaLabel="Loading new assessment run action" />
          <div className="hidden md:block">
            <VenueDetailSkeletonCreateButton />
          </div>
        </div>
      </header>

      <div className="space-y-4 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <GradientCard
            key={`venue-detail-mobile-assessment-run-${index}`}
            className="space-y-3 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-4 w-40 max-w-full" />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-11 w-11 shrink-0 self-center" />
            </div>
          </GradientCard>
        ))}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <div className="grid h-10 grid-cols-[1.3fr_0.7fr_0.8fr_1.3fr_4rem] items-center gap-4 border-b bg-muted/40 px-4 text-xs font-medium text-muted-foreground">
          <span>Assessment</span>
          <span>Progress</span>
          <span>Status</span>
          <span>Camps</span>
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`venue-detail-desktop-assessment-run-${index}`}
              className="grid min-h-12 grid-cols-[1.3fr_0.7fr_0.8fr_1.3fr_4rem] items-center gap-4 px-4 py-2"
            >
              <Skeleton className="h-4 w-full max-w-44" />
              <Skeleton className="h-4 w-full max-w-16" />
              <Skeleton className="h-5 w-full max-w-24 rounded-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </div>
      </GradientCard>
    </section>
  )
}

export function VenueDetailPanelSkeleton({
  selectedTab = "camps",
  selectedYear,
}: {
  selectedTab?: VenueDetailSkeletonTab
  selectedYear?: number
}) {
  if (selectedTab === "sessions") {
    return (
      <VenueDetailListPanelSkeleton
        selectedTab="sessions"
        selectedYear={selectedYear}
      />
    )
  }

  if (selectedTab === "camps") {
    return (
      <VenueDetailListPanelSkeleton selectedTab="camps" selectedYear={selectedYear} />
    )
  }

  if (selectedTab === "reports") {
    return (
      <VenueDetailListPanelSkeleton
        selectedTab="reports"
        selectedYear={selectedYear}
      />
    )
  }

  if (selectedTab === "wind-patterns") {
    return <VenueDetailWindPatternsPanelSkeleton />
  }

  return <VenueDetailAssessmentsPanelSkeleton selectedYear={selectedYear} />
}

export function VenueDetailTabsSkeleton({
  selectedTab = "camps",
  selectedYear,
}: {
  selectedTab?: VenueDetailSkeletonTab
  selectedYear?: number
}) {
  const mobileTabs = getVenueDetailMobileSkeletonTabs(selectedTab)

  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex h-11 w-full max-w-full items-center overflow-hidden rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
        {mobileTabs.map((tab) => (
          <button
            key={`venue-detail-mobile-tab-${tab}`}
            type="button"
            disabled
            className="inline-flex h-[calc(100%-1px)] min-w-0 flex-1 basis-0 items-center justify-center truncate rounded-md px-2 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
            data-active={tab === selectedTab ? "true" : undefined}
          >
            {VENUE_DETAIL_TAB_LABEL_BY_VALUE.get(tab)}
          </button>
        ))}
        <button
          type="button"
          disabled
          className="inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground"
        >
          <span>More</span>
          <ChevronDownIcon className="size-4" />
        </button>
      </div>

      <div className="hidden h-10 items-center gap-1 rounded-lg bg-muted p-1 md:inline-flex">
        {VENUE_DETAIL_TABS.map((tab) => (
          <button
            key={`venue-detail-desktop-tab-${tab.value}`}
            type="button"
            disabled
            className="inline-flex h-8 min-w-fit items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
            data-active={tab.value === selectedTab ? "true" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <VenueDetailPanelSkeleton selectedTab={selectedTab} selectedYear={selectedYear} />
    </div>
  )
}

export function VenueDetailDeferredContentSkeleton({
  selectedTab = "camps",
  selectedYear,
}: {
  selectedTab?: VenueDetailSkeletonTab
  selectedYear?: number
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3" aria-busy="true">
        <div className="flex max-w-full gap-2 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={`venue-detail-year-chip-${index}`} className="h-10 w-20" />
          ))}
        </div>
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>

      <VenueDetailSummaryCardsSkeleton selectedYear={selectedYear} />
      <VenueDetailTabsSkeleton selectedTab={selectedTab} selectedYear={selectedYear} />
    </div>
  )
}

export function VenueDetailPageSkeleton() {
  return <VenueDetailDeferredContentSkeleton />
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

export function OnboardingPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-white/5 p-6 sm:p-8">
        <div className="space-y-6">
          <Skeleton className="h-3 w-28 bg-white/20" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-64 bg-white/20" />
            <Skeleton className="h-4 w-full bg-white/20" />
            <Skeleton className="h-4 w-5/6 bg-white/20" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-full bg-white/20" />
            <Skeleton className="h-11 w-full rounded-full bg-white/20" />
          </div>
          <Skeleton className="h-11 w-full rounded-full bg-white/20" />
        </div>
      </div>
    </main>
  )
}
