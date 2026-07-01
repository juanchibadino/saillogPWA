import { ChevronDownIcon, PlusIcon, Settings2Icon } from "lucide-react"

import { GradientCard } from "@/components/shared/gradient-card"
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

export function TeamCampsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`team-camps-mobile-row-${index}`} className="rounded-xl border bg-card p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden rounded-xl border bg-card p-4 md:block">
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
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-end gap-2 md:justify-between">
          <div className="flex w-full items-center justify-between gap-3 md:hidden">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-11 w-11" />
          </div>

          <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

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
            className={`${tableGridClass} bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground`}
          >
            {tableHeaders.map((header) => (
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
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-16" />
        </div>
      </section>
    </div>
  )
}

export function TeamVenuesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`team-venues-mobile-row-${index}`} className="rounded-xl border bg-card p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden rounded-xl border bg-card p-4 md:block">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`team-venues-row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TeamGearPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-48" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-48" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-48" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-48" />
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
              <Skeleton key={`team-gear-row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
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

export function TeamStandardMovesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-40" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`team-standard-moves-row-${index}`} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TeamReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`team-reports-create-row-${index}`} className="h-12 w-full" />
          ))}
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`team-reports-list-row-${index}`} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function OrganizationReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
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
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`org-reports-row-${index}`} className="h-16 w-full" />
          ))}
        </div>
      </div>
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

function SessionDetailPanelSkeleton({
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
        <div className="divide-y divide-border px-6 py-3">
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
            <div className="space-y-3 px-6 py-6">
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
