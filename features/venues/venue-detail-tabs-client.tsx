"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type {
  VenueDetailCampItem,
  VenueDetailKpi,
  VenueDetailMetrics,
  VenueDetailPageData,
  VenueDetailSessionItem,
  VenueDetailYearData,
} from "@/features/venues/detail-types"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import { VENUE_DETAIL_TABS, type VenueDetailTab } from "@/features/venues/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const EMPTY_KPIS: VenueDetailKpi[] = [
  { label: "Total Camps", value: "0", note: "Selected year" },
  { label: "Total Sessions", value: "0", note: "Selected year" },
  { label: "Avg. Session", value: "—", note: "No net time recorded" },
  { label: "Net Time Sailed", value: "00h 00m", note: "Sum of net time for selected year" },
]

const EMPTY_METRICS: VenueDetailMetrics = {
  sessionsWithNetTime: 0,
  totalNetTimeMinutes: 0,
  averageNetTimeMinutes: null,
  highlightedSessionsCount: 0,
}

const EMPTY_YEAR_DATA: VenueDetailYearData = {
  kpis: EMPTY_KPIS,
  camps: [],
  sessions: [],
  metrics: EMPTY_METRICS,
}

const SESSIONS_PAGE_SIZE = 10

type SessionPaginationItem = number | "ellipsis-start" | "ellipsis-end"

function resolveTab(value: string): VenueDetailTab {
  return VENUE_DETAIL_TABS.includes(value as VenueDetailTab)
    ? (value as VenueDetailTab)
    : "camps"
}

function buildSessionPaginationItems(
  currentPage: number,
  totalPages: number,
): SessionPaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: SessionPaginationItem[] = [1]
  const middleStart = Math.max(2, currentPage - 1)
  const middleEnd = Math.min(totalPages - 1, currentPage + 1)

  if (middleStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < totalPages - 1) {
    items.push("ellipsis-end")
  }

  items.push(totalPages)

  return items
}

function renderTabPanel(input: {
  tab: VenueDetailTab
  scope: NavigationScope
  camps: VenueDetailCampItem[]
  sessions: VenueDetailSessionItem[]
  metrics: VenueDetailMetrics
  selectedYear: number
  sessionPagination: {
    page: number
    pageCount: number
    pages: SessionPaginationItem[]
    totalItems: number
    visibleFrom: number
    visibleTo: number
    onSelectPage: (page: number) => void
    onPreviousPage: () => void
    onNextPage: () => void
  }
}) {
  if (input.tab === "camps") {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-base font-semibold">Camps</h3>
          <p className="text-sm text-muted-foreground">Camps of {input.selectedYear}</p>
        </header>

        {input.camps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No camps found for {input.selectedYear}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {input.camps.map((camp) => (
              <li key={camp.id} className="py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs text-muted-foreground">{camp.dateRangeLabel}</p>
                  <p className="truncate text-sm font-medium">{camp.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {camp.sessionCount} {camp.sessionCount === 1 ? "session" : "sessions"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (input.tab === "sessions") {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-base font-semibold">Latest Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Last 10 sessions of {input.selectedYear}
          </p>
        </header>

        {input.sessionPagination.totalItems === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions found for {input.selectedYear}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {input.sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={buildSessionDetailHref({
                    scope: input.scope,
                    sessionId: session.id,
                  })}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)_auto] items-center gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium underline-offset-4 hover:underline">
                      {session.sessionDateLabel}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{session.campName}</p>
                  </div>

                  <p className="justify-self-start text-left text-xs font-medium text-muted-foreground md:text-sm">
                    {session.sessionTypeLabel}
                  </p>

                  <div className="text-right">
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {session.durationLabel}
                    </p>
                    {session.highlightedByCoach ? (
                      <p className="text-xs text-emerald-700">Highlighted</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {input.sessionPagination.pageCount > 1 ? (
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Showing {input.sessionPagination.visibleFrom}-{input.sessionPagination.visibleTo} of{" "}
              {input.sessionPagination.totalItems}
            </p>

            <Pagination className="justify-start">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={input.sessionPagination.onPreviousPage}
                    disabled={input.sessionPagination.page === 1}
                  />
                </PaginationItem>

                {input.sessionPagination.pages.map((pageItem) => (
                  <PaginationItem key={`${pageItem}`}>
                    {typeof pageItem === "number" ? (
                      <PaginationLink
                        isActive={pageItem === input.sessionPagination.page}
                        onClick={() => input.sessionPagination.onSelectPage(pageItem)}
                      >
                        {pageItem}
                      </PaginationLink>
                    ) : (
                      <PaginationEllipsis />
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={input.sessionPagination.onNextPage}
                    disabled={
                      input.sessionPagination.page === input.sessionPagination.pageCount
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </div>
    )
  }

  if (input.tab === "metrics") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions with net time</CardDescription>
            <CardTitle>{input.metrics.sessionsWithNetTime}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Used to compute average and total duration.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Highlighted sessions</CardDescription>
            <CardTitle>{input.metrics.highlightedSessionsCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coach-marked highlights for the selected year.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-6">
      <h3 className="text-base font-semibold">Reports coming soon</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        This tab will host export-oriented and operational report views.
      </p>
    </div>
  )
}

export function VenueDetailTabsClient(input: {
  scope: NavigationScope
  availableYears: VenueDetailPageData["availableYears"]
  byYear: VenueDetailPageData["byYear"]
  initialYear: number
  initialTab: VenueDetailTab
}) {
  const [selectedYear, setSelectedYear] = useState(input.initialYear)
  const [selectedTab, setSelectedTab] = useState<VenueDetailTab>(input.initialTab)
  const [sessionPageByYear, setSessionPageByYear] = useState<Record<number, number>>(
    {},
  )

  const yearData = useMemo(() => {
    return (
      input.byYear[selectedYear] ??
      input.byYear[input.availableYears[0] ?? input.initialYear] ??
      EMPTY_YEAR_DATA
    )
  }, [input.availableYears, input.byYear, input.initialYear, selectedYear])

  const totalSessionItems = yearData.sessions.length
  const sessionPageCount = Math.max(
    1,
    Math.ceil(totalSessionItems / SESSIONS_PAGE_SIZE),
  )
  const sessionPage = sessionPageByYear[selectedYear] ?? 1
  const safeSessionPage = Math.min(sessionPage, sessionPageCount)
  const sessionPaginationItems = useMemo(
    () => buildSessionPaginationItems(safeSessionPage, sessionPageCount),
    [safeSessionPage, sessionPageCount],
  )

  function setSessionPageForSelectedYear(nextPage: number): void {
    const normalizedPage = Math.max(1, Math.min(nextPage, sessionPageCount))

    setSessionPageByYear((currentValue) => ({
      ...currentValue,
      [selectedYear]: normalizedPage,
    }))
  }

  const sessionsStartIndex = (safeSessionPage - 1) * SESSIONS_PAGE_SIZE
  const paginatedSessions = useMemo(
    () =>
      yearData.sessions.slice(
        sessionsStartIndex,
        sessionsStartIndex + SESSIONS_PAGE_SIZE,
      ),
    [sessionsStartIndex, yearData.sessions],
  )
  const visibleSessionsFrom = totalSessionItems > 0 ? sessionsStartIndex + 1 : 0
  const visibleSessionsTo = sessionsStartIndex + paginatedSessions.length

  return (
    <div className="space-y-6">
      <Tabs
        value={String(selectedYear)}
        onValueChange={(value) => {
          const parsedYear = Number.parseInt(value, 10)

          if (Number.isFinite(parsedYear) && input.availableYears.includes(parsedYear)) {
            setSelectedYear(parsedYear)
          }
        }}
      >
        <TabsList className="h-10">
          {input.availableYears.map((year) => (
            <TabsTrigger key={year} value={String(year)} className="min-w-fit">
              {year}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {yearData.kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{kpi.note}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(resolveTab(value))}
        className="space-y-4"
      >
        <TabsList className="h-10">
          {VENUE_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <section className="rounded-xl border bg-card p-4 sm:p-6">
          {VENUE_DETAIL_TABS.map((tab) => (
            <TabsContent key={tab} value={tab}>
                  {tab === selectedTab
                  ? renderTabPanel({
                      tab,
                      scope: input.scope,
                      camps: yearData.camps,
                      sessions: paginatedSessions,
                      metrics: yearData.metrics,
                    selectedYear,
                    sessionPagination: {
                      page: safeSessionPage,
                      pageCount: sessionPageCount,
                      pages: sessionPaginationItems,
                      totalItems: totalSessionItems,
                      visibleFrom: visibleSessionsFrom,
                      visibleTo: visibleSessionsTo,
                      onSelectPage: (page) => {
                        setSessionPageForSelectedYear(page)
                      },
                      onPreviousPage: () => {
                        setSessionPageForSelectedYear(safeSessionPage - 1)
                      },
                      onNextPage: () => {
                        setSessionPageForSelectedYear(safeSessionPage + 1)
                      },
                    },
                  })
                : null}
            </TabsContent>
          ))}
        </section>
      </Tabs>
    </div>
  )
}
