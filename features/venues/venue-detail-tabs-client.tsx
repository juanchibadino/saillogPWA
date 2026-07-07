"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import type {
  VenueDetailKpi,
  VenueDetailKpisData,
  VenueDetailTabDataByTab,
  VenueDetailTabPayload,
} from "@/features/venues/detail-types";
import type { TeamSessionHighlightFilter } from "@/features/sessions/data";
import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs";
import { TeamSessionsTable } from "@/features/sessions/sessions-table";
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar";
import { VenueCampsPanel } from "@/features/venues/detail/camps-panel";
import { VenueReportsPanel } from "@/features/venues/detail/reports-panel";
import {
  VenueWindPatternsPanel,
  type VenueWindPatternStatusFilter,
} from "@/features/venues/detail/wind-patterns-panel";
import { VenueAssessmentsPanel } from "@/features/venues/venue-assessments-panel";
import { VenueDetailPanelSkeleton } from "@/components/shared/page-skeletons";
import {
  buildVenueDetailHref,
  VENUE_DETAIL_TABS,
  type VenueDetailTab,
} from "@/features/venues/navigation";
import {
  buildVenueDetailPageHref,
  resolveVenueDetailRouteRequest,
} from "@/features/venues/detail-route-state.mjs";
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import type { NavigationScope } from "@/lib/navigation/types";
import { GradientCard } from "@/components/shared/gradient-card";
import { cn } from "@/lib/utils";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMPTY_KPIS: VenueDetailKpi[] = [
  { label: "Total Camps", value: "0" },
  { label: "Total Sessions", value: "0" },
  { label: "Avg. Session", value: "—" },
  { label: "Net Time Sailed", value: "00h 00m" },
];

type WindPatternStatusFilter = VenueWindPatternStatusFilter;
type VenueDetailTabDataState = Record<number, Partial<VenueDetailTabDataByTab>>;
type VenueDetailTabLoadError = {
  message: string;
  tab: VenueDetailTab;
};
type VenueDetailTabErrorPayload = {
  detail?: string;
  error?: string;
};
type VenueDetailTabDataResponse = {
  data: VenueDetailTabPayload;
  kpis: VenueDetailKpisData;
  tab: VenueDetailTab;
};
type VenueDetailRouteRequest = {
  requestedHighlight?: TeamSessionHighlightFilter;
  requestedLoadMoreMode: boolean;
  requestedPage: number;
  requestedYear?: number;
  selectedTab: VenueDetailTab;
};

const MOBILE_VENUE_DETAIL_TAB_LIST_X_PADDING = 6;
const MOBILE_VENUE_DETAIL_TAB_MEASURE_TRIGGER_CLASS =
  "relative inline-flex h-[calc(100%-1px)] flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap";

type MobileVenueDetailTabWidthMap = Record<VenueDetailTab, number>;
type MobileVenueDetailTabMetrics = {
  containerWidth: number;
  moreWidth: number;
  tabWidths: MobileVenueDetailTabWidthMap;
};

function resolveTab(value: string): VenueDetailTab {
  if (value === "metrics") {
    return "assessments";
  }

  return VENUE_DETAIL_TABS.includes(value as VenueDetailTab)
    ? (value as VenueDetailTab)
    : "camps";
}

function formatVenueDetailTabLabel(tab: VenueDetailTab): string {
  if (tab === "wind-patterns") {
    return "Wind Patterns";
  }

  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function formatVenueDetailMobileTabLabel(tab: VenueDetailTab): string {
  if (tab === "wind-patterns") {
    return "Wind";
  }

  if (tab === "assessments") {
    return "Assess";
  }

  return formatVenueDetailTabLabel(tab);
}

function getMobileVenueDetailTabsWidth(
  tabs: readonly VenueDetailTab[],
  tabWidths: MobileVenueDetailTabWidthMap,
): number {
  return tabs.reduce(
    (totalWidth, tab) => totalWidth + tabWidths[tab],
    MOBILE_VENUE_DETAIL_TAB_LIST_X_PADDING,
  );
}

function getVisibleMobileVenueDetailTabs(input: {
  metrics: MobileVenueDetailTabMetrics;
  orderedTabs: readonly VenueDetailTab[];
  requiredTab?: VenueDetailTab;
}): VenueDetailTab[] {
  const allTabsWidth = getMobileVenueDetailTabsWidth(
    VENUE_DETAIL_TABS,
    input.metrics.tabWidths,
  );

  if (allTabsWidth <= input.metrics.containerWidth) {
    return [...VENUE_DETAIL_TABS];
  }

  const availableTabsWidth = Math.max(
    0,
    input.metrics.containerWidth -
      input.metrics.moreWidth -
      MOBILE_VENUE_DETAIL_TAB_LIST_X_PADDING,
  );
  const visibleTabs: VenueDetailTab[] = [];
  let usedTabsWidth = 0;

  for (const tab of input.orderedTabs) {
    const tabWidth = input.metrics.tabWidths[tab];

    if (tab === input.requiredTab) {
      while (visibleTabs.length > 0 && usedTabsWidth + tabWidth > availableTabsWidth) {
        const removedTab = visibleTabs.pop();

        if (!removedTab) {
          break;
        }

        usedTabsWidth -= input.metrics.tabWidths[removedTab];
      }

      if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
        visibleTabs.push(tab);
        usedTabsWidth += tabWidth;
      }

      continue;
    }

    if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
      visibleTabs.push(tab);
      usedTabsWidth += tabWidth;
    }
  }

  return visibleTabs.length > 0 ? visibleTabs : [input.orderedTabs[0] ?? "camps"];
}

function moveMobileVenueDetailTabIntoView(input: {
  orderedTabs: readonly VenueDetailTab[];
  tab: VenueDetailTab;
  visibleTabs: readonly VenueDetailTab[];
}): VenueDetailTab[] {
  if (input.visibleTabs.includes(input.tab)) {
    return [...input.orderedTabs];
  }

  const tabIndex = input.orderedTabs.indexOf(input.tab);
  const replacementTab = input.visibleTabs.at(-1);

  if (tabIndex === -1 || !replacementTab) {
    return [...input.orderedTabs];
  }

  const replacementIndex = input.orderedTabs.indexOf(replacementTab);

  if (replacementIndex === -1) {
    return [...input.orderedTabs];
  }

  const nextOrderedTabs = [...input.orderedTabs];
  nextOrderedTabs[replacementIndex] = input.tab;
  nextOrderedTabs[tabIndex] = replacementTab;
  return nextOrderedTabs;
}

function areMobileVenueDetailTabMetricsEqual(
  left: MobileVenueDetailTabMetrics,
  right: MobileVenueDetailTabMetrics,
): boolean {
  if (left.containerWidth !== right.containerWidth || left.moreWidth !== right.moreWidth) {
    return false;
  }

  return VENUE_DETAIL_TABS.every((tab) => left.tabWidths[tab] === right.tabWidths[tab]);
}

function MobileVenueDetailTabsList(input: {
  selectedTab: VenueDetailTab;
  onTabChange: (tab: VenueDetailTab) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const moreMeasureRef = useRef<HTMLButtonElement | null>(null);
  const tabMeasureRefs = useRef<Partial<Record<VenueDetailTab, HTMLButtonElement | null>>>(
    {},
  );
  const [metrics, setMetrics] = useState<MobileVenueDetailTabMetrics | null>(null);
  const [tabOrder, setTabOrder] = useState<VenueDetailTab[]>(() => [
    ...VENUE_DETAIL_TABS,
  ]);

  const measureTabs = useCallback(() => {
    const container = containerRef.current;
    const moreMeasure = moreMeasureRef.current;

    if (!container || !moreMeasure) {
      return;
    }

    const nextTabWidths = {} as MobileVenueDetailTabWidthMap;

    for (const tab of VENUE_DETAIL_TABS) {
      const tabMeasure = tabMeasureRefs.current[tab];

      if (!tabMeasure) {
        return;
      }

      nextTabWidths[tab] = Math.ceil(tabMeasure.getBoundingClientRect().width);
    }

    const nextMetrics: MobileVenueDetailTabMetrics = {
      containerWidth: Math.floor(container.getBoundingClientRect().width),
      moreWidth: Math.ceil(moreMeasure.getBoundingClientRect().width),
      tabWidths: nextTabWidths,
    };

    if (nextMetrics.containerWidth <= 0 || nextMetrics.moreWidth <= 0) {
      return;
    }

    setMetrics((currentMetrics) =>
      currentMetrics && areMobileVenueDetailTabMetricsEqual(currentMetrics, nextMetrics)
        ? currentMetrics
        : nextMetrics,
    );
  }, []);

  useEffect(() => {
    measureTabs();

    const animationFrame = window.requestAnimationFrame(measureTabs);
    const container = containerRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !container
        ? null
        : new ResizeObserver(() => {
            measureTabs();
          });

    if (resizeObserver && container) {
      resizeObserver.observe(container);
    }

    window.addEventListener("resize", measureTabs);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureTabs);
    };
  }, [measureTabs]);

  const visibleTabs = useMemo(
    () =>
      metrics
        ? getVisibleMobileVenueDetailTabs({
            metrics,
            orderedTabs: tabOrder,
            requiredTab: input.selectedTab,
          })
        : [...VENUE_DETAIL_TABS],
    [input.selectedTab, metrics, tabOrder],
  );
  const allTabsVisible = visibleTabs.length === VENUE_DETAIL_TABS.length;
  const overflowTabs = allTabsVisible
    ? []
    : tabOrder.filter((tab) => !visibleTabs.includes(tab));

  function setTabMeasureRef(tab: VenueDetailTab) {
    return (node: HTMLButtonElement | null) => {
      tabMeasureRefs.current[tab] = node;
    };
  }

  function handleOverflowTabSelect(tab: VenueDetailTab): void {
    setTabOrder((currentTabOrder) => {
      if (!metrics) {
        return currentTabOrder;
      }

      const currentVisibleTabs = getVisibleMobileVenueDetailTabs({
        metrics,
        orderedTabs: currentTabOrder,
      });

      return moveMobileVenueDetailTabIntoView({
        orderedTabs: currentTabOrder,
        tab,
        visibleTabs: currentVisibleTabs,
      });
    });
    input.onTabChange(tab);
  }

  return (
    <div ref={containerRef} className="w-full md:hidden">
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-0 basis-0 px-2">
              {formatVenueDetailMobileTabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {!allTabsVisible ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-full shrink-0 rounded-md px-2.5 text-foreground/60 hover:text-foreground"
                />
              }
            >
              <span>More</span>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {overflowTabs.map((tab) => (
                <DropdownMenuItem
                  key={tab}
                  onClick={() => handleOverflowTabSelect(tab)}
                  className="gap-2"
                >
                  <span className="flex size-4 items-center justify-center">
                    {input.selectedTab === tab ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="flex-1">{formatVenueDetailTabLabel(tab)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
      >
        <div className="inline-flex h-11 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          {VENUE_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              ref={setTabMeasureRef(tab)}
              type="button"
              tabIndex={-1}
              className={MOBILE_VENUE_DETAIL_TAB_MEASURE_TRIGGER_CLASS}
            >
              {formatVenueDetailMobileTabLabel(tab)}
            </button>
          ))}
          <button
            ref={moreMeasureRef}
            type="button"
            tabIndex={-1}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-full rounded-md px-2.5",
            })}
          >
            <span>More</span>
            <ChevronDownIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildVenueDetailTabDataState(input: {
  initialTab: VenueDetailTab;
  initialTabData: VenueDetailTabPayload;
  initialYear: number;
}): VenueDetailTabDataState {
  return {
    [input.initialYear]: {
      [input.initialTab]: input.initialTabData,
    },
  };
}

function getVenueDetailTabData(input: {
  state: VenueDetailTabDataState;
  tab: VenueDetailTab;
  year: number;
}): VenueDetailTabPayload | undefined {
  return input.state[input.year]?.[input.tab];
}

function hasVenueDetailTabData(input: {
  state: VenueDetailTabDataState;
  tab: VenueDetailTab;
  year: number;
}): boolean {
  return typeof getVenueDetailTabData(input) !== "undefined";
}

function applyVenueDetailTabData(input: {
  data: VenueDetailTabPayload;
  state: VenueDetailTabDataState;
  tab: VenueDetailTab;
  year: number;
}): VenueDetailTabDataState {
  return {
    ...input.state,
    [input.year]: {
      ...(input.state[input.year] ?? {}),
      [input.tab]: input.data,
    },
  };
}

function buildVenueDetailTabDataUrl(input: {
  campId?: string;
  highlight?: TeamSessionHighlightFilter;
  loadMore?: boolean;
  page?: number;
  scope: NavigationScope;
  teamVenueId: string;
  tab: VenueDetailTab;
  year: number;
}): string {
  const params = new URLSearchParams();
  params.set("tab", input.tab);
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId);

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId);
  }

  if (Number.isFinite(input.year)) {
    params.set("year", String(input.year));
  }

  if (input.campId) {
    params.set("camp", input.campId);
  }

  if (input.highlight) {
    params.set("highlight", input.highlight);
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)));
  }

  if (input.loadMore) {
    params.set("loadMore", "1");
  }

  return `/api/venues/${encodeURIComponent(input.teamVenueId)}/tab-data?${params.toString()}`;
}

async function resolveVenueDetailTabErrorMessage(response: Response): Promise<string> {
  let payload: VenueDetailTabErrorPayload | null = null;

  try {
    payload = (await response.json()) as VenueDetailTabErrorPayload;
  } catch {
    payload = null;
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null;

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry this tab.";
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return "This tab needs an active team scope. Select the correct team and retry.";
  }

  if (response.status === 404 || errorCode === "team_venue_not_found") {
    return "This venue is unavailable in the active team scope.";
  }

  if (response.status === 400) {
    return "This tab request is invalid. Refresh the page and try again.";
  }

  return "This tab hit a runtime error while loading. Retry just this tab.";
}

async function fetchVenueDetailTabData(input: {
  campId?: string;
  highlight?: TeamSessionHighlightFilter;
  loadMore?: boolean;
  page?: number;
  scope: NavigationScope;
  teamVenueId: string;
  tab: VenueDetailTab;
  year: number;
}): Promise<VenueDetailTabDataResponse> {
  const response = await fetch(buildVenueDetailTabDataUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await resolveVenueDetailTabErrorMessage(response));
  }

  const payload = (await response.json()) as VenueDetailTabDataResponse;

  if (payload.tab !== input.tab) {
    throw new Error("The loaded tab data did not match the selected tab.");
  }

  return payload;
}

function VenueTabDataError(input: {
  error: VenueDetailTabLoadError;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Could not load {formatVenueDetailTabLabel(input.error.tab)}.
        </p>
        <p className="text-sm text-muted-foreground">{input.error.message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={input.onRetry}>
        Retry
      </Button>
    </div>
  );
}

function isVenueKpiTabular(label: string): boolean {
  return label !== "Total Camps";
}

function formatVenueKpiLabel(label: string, selectedYear: number): string {
  return `${label} ${selectedYear}`;
}

function VenueDetailSummaryCards({
  kpis,
  selectedYear,
}: {
  kpis: VenueDetailKpi[];
  selectedYear: number;
}) {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {kpis.map((kpi) => {
            const label = formatVenueKpiLabel(kpi.label, selectedYear);

            return (
              <div
                key={`mobile-venue-summary-${kpi.label}`}
                className="flex min-h-12 items-center justify-between gap-4"
              >
                <p className="text-sm text-muted-foreground">{label}</p>
                <p
                  className={cn(
                    "text-right text-sm font-semibold",
                    isVenueKpiTabular(kpi.label) ? "tabular-nums" : null,
                  )}
                >
                  {kpi.value}
                </p>
              </div>
            );
          })}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const label = formatVenueKpiLabel(kpi.label, selectedYear);

          return (
            <GradientCard key={`desktop-venue-summary-${kpi.label}`}>
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-2xl font-semibold",
                    isVenueKpiTabular(kpi.label) ? "tabular-nums" : null,
                  )}
                >
                  {kpi.value}
                </CardTitle>
              </CardHeader>
            </GradientCard>
          );
        })}
      </div>
    </>
  );
}

function buildVenueSessionsHref(input: {
  campId?: string;
  highlight?: TeamSessionHighlightFilter;
  page?: number;
  scope: NavigationScope;
  teamVenueId: string;
  year: number;
}): string {
  const href = buildVenueDetailHref({
    scope: input.scope,
    teamVenueId: input.teamVenueId,
    tab: "sessions",
    year: input.year,
  });
  const url = new URL(href, "http://sailog.local");

  if (input.campId) {
    url.searchParams.set("camp", input.campId);
  }

  if (input.highlight) {
    url.searchParams.set("highlight", input.highlight);
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    url.searchParams.set("page", String(Math.floor(input.page)));
  }

  return `${url.pathname}${url.search}`;
}

function renderTabPanel(input: {
  tab: VenueDetailTab;
  scope: NavigationScope;
  teamVenueId: string;
  venueId: string;
  venueLocation: string;
  venueName: string;
  data: VenueDetailTabPayload;
  selectedYear: number;
  canDeleteCamps: boolean;
  canManageCamps: boolean;
  canManageAssessments: boolean;
  canManageReports: boolean;
  canManageSessions: boolean;
  canManageWindPatterns: boolean;
  windPatternStatusFilter: WindPatternStatusFilter;
}) {
  if (input.tab === "camps") {
    const data = input.data as VenueDetailTabDataByTab["camps"];

    return (
      <VenueCampsPanel
        canDeleteCamps={input.canDeleteCamps}
        canManageCamps={input.canManageCamps}
        data={data}
        scope={input.scope}
        selectedYear={input.selectedYear}
        teamVenueId={input.teamVenueId}
        venueId={input.venueId}
        venueLocation={input.venueLocation}
        venueName={input.venueName}
      />
    );
  }

  if (input.tab === "sessions") {
    const data = input.data as VenueDetailTabDataByTab["sessions"];
    const sessionsTitle = `Sessions ${input.selectedYear}`;
    const sessionReturnPath = buildVenueSessionsHref({
      scope: input.scope,
      teamVenueId: input.teamVenueId,
      year: input.selectedYear,
      campId: data.selectedCampId,
      highlight: data.selectedHighlight,
      page: data.currentPage,
    });

    return (
      <TeamSessionsTable
        sessions={data.sessions}
        campOptions={data.campOptions}
        canManageSessions={input.canManageSessions}
        noTeamSelected={input.scope.activeTeamId === null}
        title={sessionsTitle}
        toolbar={
          <TeamSessionsToolbar
            scope={input.scope}
            title={sessionsTitle}
            selectedVenueId=""
            selectedCampId={data.selectedCampId ?? ""}
            selectedHighlight={data.selectedHighlight ?? ""}
            venueDisabled
            campDisabled={data.campOptions.length === 0}
            showVenueFilter={false}
            showCampFilter
            venueOptions={[
              {
                value: "",
                label: `${input.venueName} — ${input.venueLocation}`,
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  highlight: data.selectedHighlight,
                }),
              },
            ]}
            campOptions={[
              {
                value: "",
                label: "Camps",
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  highlight: data.selectedHighlight,
                }),
              },
              ...data.campOptions.map((camp) => ({
                value: camp.campId,
                label: camp.campName,
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  campId: camp.campId,
                  highlight: data.selectedHighlight,
                }),
              })),
            ]}
            highlightOptions={[
              {
                value: "",
                label: "All",
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  campId: data.selectedCampId,
                }),
              },
              {
                value: "yes",
                label: "Yes",
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  campId: data.selectedCampId,
                  highlight: "yes",
                }),
              },
              {
                value: "no",
                label: "No",
                href: buildVenueSessionsHref({
                  scope: input.scope,
                  teamVenueId: input.teamVenueId,
                  year: input.selectedYear,
                  campId: data.selectedCampId,
                  highlight: "no",
                }),
              },
            ]}
            buildHref={({ campId, highlight }) =>
              buildVenueSessionsHref({
                scope: input.scope,
                teamVenueId: input.teamVenueId,
                year: input.selectedYear,
                campId,
                highlight,
              })
            }
            action={
              <CreateSessionDialog
                campOptions={data.campOptions}
                scope={input.scope}
                selectedCampId={data.selectedCampId}
                selectedHighlight={data.selectedHighlight}
                currentPage={data.currentPage}
                returnPath={sessionReturnPath}
                disabled={!input.canManageSessions || data.campOptions.length === 0}
                surface="sheet"
              />
            }
          />
        }
        scope={input.scope}
        selectedCampId={data.selectedCampId}
        selectedHighlight={data.selectedHighlight}
        currentPage={data.currentPage}
        pageCount={data.pageCount}
        hasPreviousPage={data.hasPreviousPage}
        hasNextPage={data.hasNextPage}
        returnPath={sessionReturnPath}
      />
    );
  }

  if (input.tab === "assessments") {
    const data = input.data as VenueDetailTabDataByTab["assessments"];

    return (
      <VenueAssessmentsPanel
        scope={input.scope}
        teamVenueId={input.teamVenueId}
        selectedYear={input.selectedYear}
        canManageAssessments={input.canManageAssessments}
        templates={data.assessments.templates}
        runs={data.assessments.runs}
        availableCamps={data.camps}
      />
    );
  }

  if (input.tab === "wind-patterns") {
    const data = input.data as VenueDetailTabDataByTab["wind-patterns"];

    return (
      <VenueWindPatternsPanel
        canManageWindPatterns={input.canManageWindPatterns}
        data={data}
        scope={input.scope}
        teamVenueId={input.teamVenueId}
        selectedYear={input.selectedYear}
        statusFilter={input.windPatternStatusFilter}
      />
    );
  }

  const data = input.data as VenueDetailTabDataByTab["reports"];

  return (
    <VenueReportsPanel
      canManageReports={input.canManageReports}
      data={data}
      scope={input.scope}
      selectedYear={input.selectedYear}
      teamVenueId={input.teamVenueId}
    />
  );
}

export function VenueDetailTabsClient(input: {
  scope: NavigationScope;
  teamVenueId: string;
  venueId: string;
  venueLocation: string;
  venueName: string;
  availableYears: number[];
  kpis: VenueDetailKpi[];
  initialYear: number;
  initialTab: VenueDetailTab;
  initialTabData: VenueDetailTabPayload;
  canDeleteCamps: boolean;
  canManageCamps: boolean;
  canManageAssessments: boolean;
  canManageReports: boolean;
  canManageSessions: boolean;
  canManageWindPatterns: boolean;
  initialWindPatternStatusFilter: WindPatternStatusFilter;
  action?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const requestedCampId = searchParams.get("camp") ?? undefined;
  const [isRouteNavigationPending, startRouteNavigationTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(input.initialYear);
  const [selectedTab, setSelectedTab] = useState<VenueDetailTab>(input.initialTab);
  const [kpisByYear, setKpisByYear] = useState<Record<number, VenueDetailKpi[]>>(
    () => ({
      [input.initialYear]: input.kpis,
    }),
  );
  const [tabDataByYear, setTabDataByYear] = useState<VenueDetailTabDataState>(() =>
    buildVenueDetailTabDataState({
      initialTab: input.initialTab,
      initialTabData: input.initialTabData,
      initialYear: input.initialYear,
    }),
  );
  const [loadError, setLoadError] = useState<VenueDetailTabLoadError | null>(null);
  const inFlightTabsRef = useRef<Set<string>>(new Set());
  const requestVersionRef = useRef(0);
  const routeRequest = useMemo(
    () =>
      resolveVenueDetailRouteRequest({
        highlightParam: searchParams.get("highlight") ?? undefined,
        loadMoreParam: searchParams.get("loadMore") ?? undefined,
        pageParam: searchParams.get("page") ?? undefined,
        tabParam: searchParams.get("tab") ?? undefined,
        yearParam: searchParams.get("year") ?? undefined,
      }) as VenueDetailRouteRequest,
    [searchParams],
  );

  const navigateToVenueDetailHref = useCallback(
    (href: string) => {
      startRouteNavigationTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const navigateToTab = useCallback(
    (tab: VenueDetailTab) => {
      setSelectedTab(tab);
      navigateToVenueDetailHref(
        buildVenueDetailPageHref({
          pathname,
          search: currentSearch,
          nextTab: tab,
          nextYear: selectedYear,
        }),
      );
    },
    [currentSearch, navigateToVenueDetailHref, pathname, selectedYear],
  );

  const navigateToYear = useCallback(
    (year: number) => {
      setSelectedYear(year);
      navigateToVenueDetailHref(
        buildVenueDetailPageHref({
          pathname,
          search: currentSearch,
          nextTab: selectedTab,
          nextYear: year,
        }),
      );
    },
    [currentSearch, navigateToVenueDetailHref, pathname, selectedTab],
  );

  const loadTabData = useCallback(
    async (tab: VenueDetailTab, year: number, options?: { force?: boolean }) => {
      const hasTabData = hasVenueDetailTabData({
        state: tabDataByYear,
        tab,
        year,
      });
      const hasKpis = typeof kpisByYear[year] !== "undefined";

      if (!options?.force && hasTabData && hasKpis) {
        return;
      }

      const requestPage = tab === "sessions" ? routeRequest.requestedPage : undefined;
      const requestLoadMore =
        tab === "sessions" ? routeRequest.requestedLoadMoreMode : undefined;
      const requestHighlight =
        tab === "sessions" ? routeRequest.requestedHighlight : undefined;
      const requestCampId = tab === "sessions" ? requestedCampId : undefined;
      const requestKey = [
        year,
        tab,
        requestPage ?? 1,
        requestLoadMore ? "load-more" : "page",
        requestHighlight ?? "all",
        requestCampId ?? "all-camps",
      ].join(":");

      if (inFlightTabsRef.current.has(requestKey)) {
        return;
      }

      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      inFlightTabsRef.current.add(requestKey);
      setLoadError((currentError) => (currentError?.tab === tab ? null : currentError));

      try {
        const payload = await fetchVenueDetailTabData({
          campId: requestCampId,
          highlight: requestHighlight,
          loadMore: requestLoadMore,
          page: requestPage,
          scope: input.scope,
          teamVenueId: input.teamVenueId,
          tab,
          year,
        });

        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        setKpisByYear((currentValue) => ({
          ...currentValue,
          [payload.kpis.selectedYear]: payload.kpis.kpis,
        }));
        setTabDataByYear((currentValue) =>
          applyVenueDetailTabData({
            data: payload.data,
            state: currentValue,
            tab,
            year: payload.kpis.selectedYear,
          }),
        );
      } catch (error) {
        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = error instanceof Error ? error.message : "Could not load this tab.";
        setLoadError({ message, tab });
      } finally {
        inFlightTabsRef.current.delete(requestKey);
      }
    },
    [
      input.scope,
      input.teamVenueId,
      kpisByYear,
      requestedCampId,
      routeRequest.requestedHighlight,
      routeRequest.requestedLoadMoreMode,
      routeRequest.requestedPage,
      tabDataByYear,
    ],
  );

  useEffect(() => {
    requestVersionRef.current += 1;
    inFlightTabsRef.current.clear();

    setSelectedYear(input.initialYear);
    setSelectedTab(input.initialTab);

    setKpisByYear({
      [input.initialYear]: input.kpis,
    });
    setTabDataByYear(
      buildVenueDetailTabDataState({
        initialTab: input.initialTab,
        initialTabData: input.initialTabData,
        initialYear: input.initialYear,
      }),
    );
    setLoadError((currentError) =>
      currentError?.tab === input.initialTab ? null : currentError,
    );
  }, [
    input.initialTab,
    input.initialTabData,
    input.initialYear,
    input.kpis,
    input.scope.activeOrgId,
    input.scope.activeTeamId,
    input.teamVenueId,
  ]);

  useEffect(() => {
    void loadTabData(selectedTab, selectedYear);
  }, [loadTabData, selectedTab, selectedYear]);

  const retrySelectedTab = useCallback(() => {
    void loadTabData(selectedTab, selectedYear, { force: true });
  }, [loadTabData, selectedTab, selectedYear]);

  const currentKpis = kpisByYear[selectedYear] ?? EMPTY_KPIS;
  const selectedTabData = getVenueDetailTabData({
    state: tabDataByYear,
    tab: selectedTab,
    year: selectedYear,
  });

  function renderPendingTab(tab: VenueDetailTab) {
    if (loadError?.tab === tab) {
      return <VenueTabDataError error={loadError} onRetry={retrySelectedTab} />;
    }

    return <VenueDetailPanelSkeleton selectedTab={tab} selectedYear={selectedYear} />;
  }

  function renderLoadedTab(tab: VenueDetailTab, data: VenueDetailTabPayload) {
    const panel = renderTabPanel({
      tab,
      scope: input.scope,
      teamVenueId: input.teamVenueId,
      venueId: input.venueId,
      venueLocation: input.venueLocation,
      venueName: input.venueName,
      data,
      selectedYear,
      canDeleteCamps: input.canDeleteCamps,
      canManageCamps: input.canManageCamps,
      canManageAssessments: input.canManageAssessments,
      canManageReports: input.canManageReports,
      canManageSessions: input.canManageSessions,
      canManageWindPatterns: input.canManageWindPatterns,
      windPatternStatusFilter: input.initialWindPatternStatusFilter,
    });

    if (
      tab === "sessions" ||
      tab === "camps" ||
      tab === "assessments" ||
      tab === "wind-patterns" ||
      tab === "reports"
    ) {
      return panel;
    }

    return <section className="rounded-xl border bg-card p-4 sm:p-6">{panel}</section>;
  }

  return (
    <div
      aria-busy={isRouteNavigationPending}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={String(selectedYear)}
          onValueChange={(value) => {
            const parsedYear = Number.parseInt(value, 10);

            if (Number.isFinite(parsedYear) && input.availableYears.includes(parsedYear)) {
              navigateToYear(parsedYear);
            }
          }}
          className="min-w-0"
        >
          <div className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden">
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

      <VenueDetailSummaryCards kpis={currentKpis} selectedYear={selectedYear} />

      <Tabs
        value={selectedTab}
        onValueChange={(value) => navigateToTab(resolveTab(value))}
        className="space-y-4"
      >
        <MobileVenueDetailTabsList
          selectedTab={selectedTab}
          onTabChange={navigateToTab}
        />

        <TabsList className="hidden h-10 md:inline-flex">
          {VENUE_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {formatVenueDetailTabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {VENUE_DETAIL_TABS.map((tab) => (
          <TabsContent key={tab} value={tab}>
            {tab === selectedTab ? (
              selectedTabData ? (
                renderLoadedTab(tab, selectedTabData)
              ) : (
                renderPendingTab(tab)
              )
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
