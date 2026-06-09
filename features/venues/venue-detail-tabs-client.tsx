"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";

import type {
  VenueDetailCampItem,
  VenueDetailKpi,
  VenueDetailPageData,
  VenueDetailSessionItem,
  VenueDetailYearData,
} from "@/features/venues/detail-types";
import { VenueAssessmentsPanel } from "@/features/venues/venue-assessments-panel";
import { buildCampDetailHref } from "@/features/camps/navigation";
import { buildSessionDetailHref } from "@/features/sessions/navigation";
import { CreateReportDialog } from "@/features/reports/report-form-dialogs";
import {
  buildVenueDetailHref,
  VENUE_DETAIL_TABS,
  type VenueDetailTab,
} from "@/features/venues/navigation";
import type { NavigationScope } from "@/lib/navigation/types";
import { GradientCard } from "@/components/shared/gradient-card";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMPTY_KPIS: VenueDetailKpi[] = [
  { label: "Total Camps", value: "0", note: "Selected year" },
  { label: "Total Sessions", value: "0", note: "Selected year" },
  { label: "Avg. Session", value: "—", note: "No net time recorded" },
  { label: "Net Time Sailed", value: "00h 00m", note: "Sum of net time for selected year" },
];

const EMPTY_YEAR_DATA: VenueDetailYearData = {
  kpis: EMPTY_KPIS,
  camps: [],
  sessions: [],
  reports: [],
  assessments: {
    templates: [],
    runs: [],
  },
};

const SESSIONS_PAGE_SIZE = 10;

type SessionPaginationItem = number | "ellipsis-start" | "ellipsis-end";

function resolveTab(value: string): VenueDetailTab {
  if (value === "metrics") {
    return "assessments";
  }

  return VENUE_DETAIL_TABS.includes(value as VenueDetailTab)
    ? (value as VenueDetailTab)
    : "camps";
}

function buildSessionPaginationItems(
  currentPage: number,
  totalPages: number,
): SessionPaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: SessionPaginationItem[] = [1];
  const middleStart = Math.max(2, currentPage - 1);
  const middleEnd = Math.min(totalPages - 1, currentPage + 1);

  if (middleStart > 2) {
    items.push("ellipsis-start");
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page);
  }

  if (middleEnd < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);

  return items;
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function renderTabPanel(input: {
  tab: VenueDetailTab;
  scope: NavigationScope;
  teamVenueId: string;
  camps: VenueDetailCampItem[];
  sessions: VenueDetailSessionItem[];
  selectedYear: number;
  canManageAssessments: boolean;
  canManageReports: boolean;
  assessments: VenueDetailYearData["assessments"];
  reports: VenueDetailYearData["reports"];
  sessionPagination: {
    page: number;
    pageCount: number;
    pages: SessionPaginationItem[];
    totalItems: number;
    visibleFrom: number;
    visibleTo: number;
    onSelectPage: (page: number) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
  };
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
              <li key={camp.id}>
                <Link
                  href={buildCampDetailHref({
                    scope: input.scope,
                    campId: camp.id,
                    from: "venue",
                    fromVenueId: input.teamVenueId,
                  })}
                  className="block rounded-md px-2 py-3 -mx-2 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-xs text-muted-foreground">{camp.dateRangeLabel}</p>
                    <p className="truncate text-sm font-medium">{camp.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {camp.sessionCount} {camp.sessionCount === 1 ? "session" : "sessions"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
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
                    from: "venue",
                    fromVenueId: input.teamVenueId,
                  })}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)_auto] items-center gap-3 rounded-md px-2 py-3 -mx-2 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
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
    );
  }

  if (input.tab === "assessments") {
    return (
      <VenueAssessmentsPanel
        scope={input.scope}
        teamVenueId={input.teamVenueId}
        selectedYear={input.selectedYear}
        canManageAssessments={input.canManageAssessments}
        templates={input.assessments.templates}
        runs={input.assessments.runs}
        availableCamps={input.camps}
      />
    );
  }

  const reportCreateRedirectTo = buildVenueDetailHref({
    scope: input.scope,
    teamVenueId: input.teamVenueId,
    tab: "reports",
    year: input.selectedYear,
  });
  const reportCampOptions = input.camps.map((camp) => ({
    campId: camp.id,
    name: camp.name,
    dateRangeLabel: camp.dateRangeLabel,
  }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Reports</h3>
          <p className="text-sm text-muted-foreground">
            Team venue report records for {input.selectedYear}.
          </p>
        </div>

        {input.canManageReports ? (
          <CreateReportDialog
            scope={input.scope}
            teamVenueId={input.teamVenueId}
            year={input.selectedYear}
            redirectTo={reportCreateRedirectTo}
            campOptions={reportCampOptions}
            disabled={reportCampOptions.length === 0}
          />
        ) : null}
      </header>

      {!input.canManageReports ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Report creation is limited to team admins and coaches.
          </p>
        </section>
      ) : null}

      {input.reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reports created yet for {input.selectedYear}.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {input.reports.map((report) => (
            <li key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-md -mx-2 px-2 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.campCount} {report.campCount === 1 ? "camp" : "camps"} ·{" "}
                    {report.campNames.join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateTimeLabel(report.createdAt)} UTC
                  </p>
                </div>

                <a
                  href={`/api/reports/${report.id}/pdf`}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Download PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VenueDetailTabsClient(input: {
  scope: NavigationScope;
  teamVenueId: string;
  availableYears: VenueDetailPageData["availableYears"];
  byYear: VenueDetailPageData["byYear"];
  initialYear: number;
  initialTab: VenueDetailTab;
  canManageAssessments: boolean;
  canManageReports: boolean;
  action?: ReactNode;
}) {
  const [selectedYear, setSelectedYear] = useState(input.initialYear);
  const [selectedTab, setSelectedTab] = useState<VenueDetailTab>(input.initialTab);
  const [sessionPageByYear, setSessionPageByYear] = useState<Record<number, number>>(
    {},
  );

  const yearData = useMemo(() => {
    return (
      input.byYear[selectedYear] ??
      input.byYear[input.availableYears[0] ?? input.initialYear] ??
      EMPTY_YEAR_DATA
    );
  }, [input.availableYears, input.byYear, input.initialYear, selectedYear]);

  const totalSessionItems = yearData.sessions.length;
  const sessionPageCount = Math.max(
    1,
    Math.ceil(totalSessionItems / SESSIONS_PAGE_SIZE),
  );
  const sessionPage = sessionPageByYear[selectedYear] ?? 1;
  const safeSessionPage = Math.min(sessionPage, sessionPageCount);
  const sessionPaginationItems = useMemo(
    () => buildSessionPaginationItems(safeSessionPage, sessionPageCount),
    [safeSessionPage, sessionPageCount],
  );

  function setSessionPageForSelectedYear(nextPage: number): void {
    const normalizedPage = Math.max(1, Math.min(nextPage, sessionPageCount));

    setSessionPageByYear((currentValue) => ({
      ...currentValue,
      [selectedYear]: normalizedPage,
    }));
  }

  const sessionsStartIndex = (safeSessionPage - 1) * SESSIONS_PAGE_SIZE;
  const paginatedSessions = useMemo(
    () =>
      yearData.sessions.slice(
        sessionsStartIndex,
        sessionsStartIndex + SESSIONS_PAGE_SIZE,
      ),
    [sessionsStartIndex, yearData.sessions],
  );
  const visibleSessionsFrom = totalSessionItems > 0 ? sessionsStartIndex + 1 : 0;
  const visibleSessionsTo = sessionsStartIndex + paginatedSessions.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={String(selectedYear)}
          onValueChange={(value) => {
            const parsedYear = Number.parseInt(value, 10);

            if (Number.isFinite(parsedYear) && input.availableYears.includes(parsedYear)) {
              setSelectedYear(parsedYear);
            }
          }}
          className="min-w-0"
        >
          <div className="max-w-full overflow-x-auto">
            <TabsList className="h-10 w-max">
              {input.availableYears.map((year) => (
                <TabsTrigger key={year} value={String(year)} className="min-w-fit">
                  {year}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {input.action ? <div className="shrink-0">{input.action}</div> : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {yearData.kpis.map((kpi) => (
          <GradientCard key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{kpi.note}</CardContent>
          </GradientCard>
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
                    teamVenueId: input.teamVenueId,
                    camps: yearData.camps,
                    sessions: paginatedSessions,
                    selectedYear,
                    canManageAssessments: input.canManageAssessments,
                    canManageReports: input.canManageReports,
                    assessments: yearData.assessments,
                    reports: yearData.reports,
                    sessionPagination: {
                      page: safeSessionPage,
                      pageCount: sessionPageCount,
                      pages: sessionPaginationItems,
                      totalItems: totalSessionItems,
                      visibleFrom: visibleSessionsFrom,
                      visibleTo: visibleSessionsTo,
                      onSelectPage: (page) => {
                        setSessionPageForSelectedYear(page);
                      },
                      onPreviousPage: () => {
                        setSessionPageForSelectedYear(safeSessionPage - 1);
                      },
                      onNextPage: () => {
                        setSessionPageForSelectedYear(safeSessionPage + 1);
                      },
                    },
                  })
                : null}
            </TabsContent>
          ))}
        </section>
      </Tabs>
    </div>
  );
}
