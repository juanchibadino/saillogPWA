"use client";

import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  VenueDetailKpi,
  VenueDetailKpisData,
  VenueDetailTabDataByTab,
  VenueDetailTabPayload,
} from "@/features/venues/detail-types";
import type { TeamSessionHighlightFilter } from "@/features/sessions/data";
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts";
import {
  readScopedRouteCache,
  SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
  writeScopedRouteCache,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache";
import { useStaleRouteData } from "@/features/shared/use-stale-route-data";
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
  buildVenueDetailTabApiUrl,
  buildVenueDetailTabCacheMetadata,
  VENUE_DETAIL_TAB_CACHE_ROUTE,
  type VenueDetailTabRequestInput,
} from "@/features/venues/venue-detail-tab-cache";
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
type VenueDetailTabLoadError = {
  message: string;
  tab: VenueDetailTab;
};
type VenueDetailTabErrorPayload = {
  detail?: string;
  error?: string;
};
type VenueDetailTabDataResponse = {
  cache: ApiSliceCacheMetadata;
  data: VenueDetailTabPayload;
  kpis: VenueDetailKpisData;
  tab: VenueDetailTab;
};
type VenueDetailWarmTab = "camps" | "sessions" | "wind-patterns";
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

const VENUE_DETAIL_WARM_TABS: readonly VenueDetailWarmTab[] = [
  "camps",
  "sessions",
  "wind-patterns",
];

function resolveCacheScope(scope: NavigationScope): ScopedRouteCacheScope {
  return {
    orgId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  };
}

function buildVenueDetailTabRequest(input: {
  campId?: string;
  highlight?: TeamSessionHighlightFilter;
  loadMore: boolean;
  page: number;
  scope: NavigationScope;
  teamVenueId: string;
  tab: VenueDetailTab;
  year: number;
}): VenueDetailTabRequestInput {
  if (input.tab !== "sessions") {
    return {
      scope: input.scope,
      teamVenueId: input.teamVenueId,
      tab: input.tab,
      year: input.year,
      page: 1,
      loadMore: false,
    };
  }

  return {
    scope: input.scope,
    teamVenueId: input.teamVenueId,
    tab: input.tab,
    year: input.year,
    campId: input.campId,
    highlight: input.highlight,
    loadMore: input.loadMore,
    page: input.page,
  };
}

function buildVenueDetailTabCacheFromRequest(input: {
  cacheScope: ScopedRouteCacheScope;
  request: VenueDetailTabRequestInput;
}): ApiSliceCacheMetadata {
  return buildVenueDetailTabCacheMetadata({
    scope: input.cacheScope,
    teamVenueId: input.request.teamVenueId,
    tab: input.request.tab,
    year: input.request.year,
    campId: input.request.campId,
    highlight: input.request.highlight,
    loadMore: input.request.loadMore,
    page: input.request.page,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVenueDetailKpi(value: unknown): value is VenueDetailKpi {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.label === "string" && typeof value.value === "string";
}

function isVenueDetailKpisData(value: unknown): value is VenueDetailKpisData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.availableYears) &&
    value.availableYears.every((year) => typeof year === "number") &&
    typeof value.selectedYear === "number" &&
    Array.isArray(value.kpis) &&
    value.kpis.every(isVenueDetailKpi)
  );
}

function isVenueDetailTabPayload(
  value: unknown,
  tab: VenueDetailTab,
): value is VenueDetailTabPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (tab === "camps") {
    return Array.isArray(value.camps);
  }

  if (tab === "sessions") {
    return (
      Array.isArray(value.sessions) &&
      Array.isArray(value.campOptions) &&
      typeof value.currentPage === "number" &&
      typeof value.hasNextPage === "boolean" &&
      typeof value.hasPreviousPage === "boolean" &&
      typeof value.pageCount === "number"
    );
  }

  if (tab === "wind-patterns") {
    const windPatterns = value.windPatterns;

    return (
      isRecord(windPatterns) &&
      Array.isArray(windPatterns.patterns) &&
      typeof windPatterns.activeCount === "number" &&
      typeof windPatterns.archivedCount === "number"
    );
  }

  if (tab === "assessments") {
    const assessments = value.assessments;

    return (
      Array.isArray(value.camps) &&
      isRecord(assessments) &&
      Array.isArray(assessments.templates) &&
      Array.isArray(assessments.runs)
    );
  }

  return Array.isArray(value.camps) && Array.isArray(value.reports);
}

function isVenueDetailTabDataResponse(
  value: unknown,
  tab: VenueDetailTab,
): value is VenueDetailTabDataResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.cache) &&
    value.tab === tab &&
    isVenueDetailKpisData(value.kpis) &&
    isVenueDetailTabPayload(value.data, tab)
  );
}

function doesVenueDetailCacheMetadataMatch(input: {
  cache: ApiSliceCacheMetadata;
  expectedCache: ApiSliceCacheMetadata;
  expectedTab: VenueDetailTab;
}): boolean {
  return (
    input.cache.key === input.expectedCache.key &&
    input.cache.scopeKey === input.expectedCache.scopeKey &&
    input.cache.route === VENUE_DETAIL_TAB_CACHE_ROUTE &&
    String(input.cache.entityId) === String(input.expectedCache.entityId) &&
    input.cache.tab === input.expectedTab &&
    String(input.cache.year) === String(input.expectedCache.year) &&
    input.cache.filters === input.expectedCache.filters &&
    String(input.cache.page) === String(input.expectedCache.page)
  );
}

function isValidVenueDetailTabResponse(input: {
  expectedCache: ApiSliceCacheMetadata;
  expectedTab: VenueDetailTab;
  payload: VenueDetailTabDataResponse;
}): boolean {
  return (
    doesVenueDetailCacheMetadataMatch({
      cache: input.payload.cache,
      expectedCache: input.expectedCache,
      expectedTab: input.expectedTab,
    }) &&
    input.payload.kpis.selectedYear === Number(input.expectedCache.year) &&
    isVenueDetailTabPayload(input.payload.data, input.expectedTab)
  );
}

function buildInitialVenueDetailTabResponse(input: {
  availableYears: number[];
  cache: ApiSliceCacheMetadata;
  initialKpis: VenueDetailKpi[];
  initialTab: VenueDetailTab;
  initialTabData: VenueDetailTabPayload;
  initialYear: number;
  selectedTab: VenueDetailTab;
  selectedYear: number;
}): VenueDetailTabDataResponse | null {
  if (
    input.selectedTab !== input.initialTab ||
    input.selectedYear !== input.initialYear ||
    input.cache.tab !== input.initialTab ||
    Number(input.cache.year) !== input.initialYear
  ) {
    return null;
  }

  return {
    cache: input.cache,
    data: input.initialTabData,
    kpis: {
      availableYears: input.availableYears,
      selectedYear: input.initialYear,
      kpis: input.initialKpis,
    },
    tab: input.initialTab,
  };
}

function resolveVenueDetailWarmYear(input: {
  availableYears: readonly number[];
  selectedYear: number;
}): number {
  const currentYear = new Date().getUTCFullYear();
  return input.availableYears.includes(currentYear) ? currentYear : input.selectedYear;
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
  campId?: string | null;
  highlight?: TeamSessionHighlightFilter | null;
  loadMore?: boolean;
  page?: number;
  scope: NavigationScope;
  signal?: AbortSignal;
  teamVenueId: string;
  tab: VenueDetailTab;
  year: number;
}): Promise<VenueDetailTabDataResponse> {
  const response = await fetch(
    buildVenueDetailTabApiUrl({
      campId: input.campId,
      highlight: input.highlight,
      loadMore: input.loadMore === true,
      page: input.page ?? 1,
      scope: input.scope,
      teamVenueId: input.teamVenueId,
      tab: input.tab,
      year: input.year,
    }),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: input.signal,
    },
  );

  if (!response.ok) {
    throw new Error(await resolveVenueDetailTabErrorMessage(response));
  }

  const payload = (await response.json()) as unknown;

  if (!isVenueDetailTabDataResponse(payload, input.tab)) {
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const requestedCampId = searchParams.get("camp") ?? undefined;
  const [selectedYearState, setSelectedYear] = useState(input.initialYear);
  const [selectedTab, setSelectedTab] = useState<VenueDetailTab>(input.initialTab);
  const selectedYear = input.availableYears.includes(selectedYearState)
    ? selectedYearState
    : input.initialYear;
  const cacheScope = useMemo(() => resolveCacheScope(input.scope), [input.scope]);
  const warmInFlightTabsRef = useRef<Set<string>>(new Set());
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

  const replaceVenueDetailHref = useCallback(
    (href: string) => {
      window.history.replaceState(null, "", `${href}${window.location.hash}`);
    },
    [],
  );

  const navigateToTab = useCallback(
    (tab: VenueDetailTab) => {
      setSelectedTab(tab);
      replaceVenueDetailHref(
        buildVenueDetailPageHref({
          pathname,
          search: currentSearch,
          nextTab: tab,
          nextYear: selectedYear,
        }),
      );
    },
    [currentSearch, pathname, replaceVenueDetailHref, selectedYear],
  );

  const navigateToYear = useCallback(
    (year: number) => {
      setSelectedYear(year);
      replaceVenueDetailHref(
        buildVenueDetailPageHref({
          pathname,
          search: currentSearch,
          nextTab: selectedTab,
          nextYear: year,
        }),
      );
    },
    [currentSearch, pathname, replaceVenueDetailHref, selectedTab],
  );

  const selectedTabRequest = useMemo(
    () =>
      buildVenueDetailTabRequest({
        campId: requestedCampId,
        highlight: routeRequest.requestedHighlight,
        loadMore: routeRequest.requestedLoadMoreMode,
        page: routeRequest.requestedPage,
        scope: input.scope,
        teamVenueId: input.teamVenueId,
        tab: selectedTab,
        year: selectedYear,
      }),
    [
      input.scope,
      input.teamVenueId,
      requestedCampId,
      routeRequest.requestedHighlight,
      routeRequest.requestedLoadMoreMode,
      routeRequest.requestedPage,
      selectedTab,
      selectedYear,
    ],
  );
  const selectedTabCache = useMemo(
    () =>
      buildVenueDetailTabCacheFromRequest({
        cacheScope,
        request: selectedTabRequest,
      }),
    [cacheScope, selectedTabRequest],
  );
  const selectedInitialPayload = useMemo(
    () =>
      buildInitialVenueDetailTabResponse({
        availableYears: input.availableYears,
        cache: selectedTabCache,
        initialKpis: input.kpis,
        initialTab: input.initialTab,
        initialTabData: input.initialTabData,
        initialYear: input.initialYear,
        selectedTab,
        selectedYear,
      }),
    [
      input.availableYears,
      input.initialTab,
      input.initialTabData,
      input.initialYear,
      input.kpis,
      selectedTab,
      selectedTabCache,
      selectedYear,
    ],
  );
  const fetchFreshTabData = useCallback(
    async ({ signal }: { signal: AbortSignal }) =>
      fetchVenueDetailTabData({
        ...selectedTabRequest,
        signal,
      }),
    [selectedTabRequest],
  );
  const validateFreshPayload = useCallback(
    (payload: VenueDetailTabDataResponse) =>
      isValidVenueDetailTabResponse({
        expectedCache: selectedTabCache,
        expectedTab: selectedTab,
        payload,
      }),
    [selectedTab, selectedTabCache],
  );
  const routeData = useStaleRouteData<VenueDetailTabDataResponse>({
    cacheKey: selectedTabCache.key,
    scope: cacheScope,
    staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
    initialData: selectedInitialPayload,
    enabled: input.scope.activeTeamId !== null,
    fetchFreshData: fetchFreshTabData,
    validateFreshPayload,
  });

  useEffect(() => {
    if (input.scope.activeTeamId === null) {
      return;
    }

    const controller = new AbortController();
    const warmYear = resolveVenueDetailWarmYear({
      availableYears: input.availableYears,
      selectedYear,
    });

    for (const tab of VENUE_DETAIL_WARM_TABS) {
      const warmRequest = buildVenueDetailTabRequest({
        loadMore: false,
        page: 1,
        scope: input.scope,
        teamVenueId: input.teamVenueId,
        tab,
        year: warmYear,
      });
      const warmCache = buildVenueDetailTabCacheFromRequest({
        cacheScope,
        request: warmRequest,
      });

      if (
        warmCache.key === selectedTabCache.key ||
        warmInFlightTabsRef.current.has(warmCache.key)
      ) {
        continue;
      }

      const cachedWarmPayload = readScopedRouteCache<VenueDetailTabDataResponse>({
        key: warmCache.key,
        scope: cacheScope,
      });

      if (cachedWarmPayload.status === "hit" && !cachedWarmPayload.isStale) {
        continue;
      }

      warmInFlightTabsRef.current.add(warmCache.key);

      void fetchVenueDetailTabData({
        ...warmRequest,
        signal: controller.signal,
      })
        .then((payload) => {
          if (
            controller.signal.aborted ||
            !isValidVenueDetailTabResponse({
              expectedCache: warmCache,
              expectedTab: tab,
              payload,
            })
          ) {
            return;
          }

          writeScopedRouteCache({
            key: warmCache.key,
            scope: cacheScope,
            payload,
            staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
          });
        })
        .catch(() => {
          // Warm failures should never interrupt the visible tab.
        })
        .finally(() => {
          warmInFlightTabsRef.current.delete(warmCache.key);
        });
    }

    return () => {
      controller.abort();
    };
  }, [
    cacheScope,
    input.availableYears,
    input.scope,
    input.teamVenueId,
    selectedTabCache.key,
    selectedYear,
  ]);

  const retrySelectedTab = routeData.retry;
  const selectedRoutePayload =
    routeData.data &&
    isValidVenueDetailTabResponse({
      expectedCache: selectedTabCache,
      expectedTab: selectedTab,
      payload: routeData.data,
    })
      ? routeData.data
      : null;

  const currentKpis =
    selectedRoutePayload?.kpis.kpis ?? selectedInitialPayload?.kpis.kpis ?? EMPTY_KPIS;
  const selectedTabData = selectedRoutePayload?.data ?? selectedInitialPayload?.data ?? null;
  const showInlineError = routeData.status === "error" && selectedTabData !== null;
  const isSelectedTabRevalidating = routeData.isRevalidating && selectedTabData !== null;

  function renderPendingTab(tab: VenueDetailTab) {
    if (routeData.status === "error") {
      return (
        <VenueTabDataError
          error={{
            message: routeData.error?.message ?? "Could not load this tab.",
            tab,
          }}
          onRetry={retrySelectedTab}
        />
      );
    }

    return <VenueDetailPanelSkeleton selectedTab={tab} selectedYear={selectedYear} />;
  }

  function renderLoadedTab(tab: VenueDetailTab, data: VenueDetailTabPayload) {
    if (!isVenueDetailTabPayload(data, tab)) {
      return renderPendingTab(tab);
    }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={String(selectedYear)}
          onValueChange={(value) => {
            const parsedYear = Number.parseInt(value, 10);

            if (Number.isFinite(parsedYear) && input.availableYears.includes(parsedYear)) {
              navigateToYear(parsedYear);
            }
          }}
          className="min-w-0 flex-1 md:flex-none"
        >
          <div className="no-scrollbar flex h-11 w-full max-w-full items-center overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
            <TabsList className="h-full w-max min-w-full rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
              {input.availableYears.map((year) => (
                <TabsTrigger key={year} value={String(year)} className="min-w-fit px-3">
                  {year}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="no-scrollbar hidden max-w-full overflow-x-auto overflow-y-hidden md:block">
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
                <div className="relative">
                  {showInlineError ? (
                    <div
                      role="alert"
                      className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
                    >
                      <span>
                        {routeData.error?.message ?? "Could not refresh this tab."}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={retrySelectedTab}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "transition-opacity",
                      isSelectedTabRevalidating && "opacity-75",
                    )}
                  >
                    {renderLoadedTab(tab, selectedTabData)}
                  </div>

                  {isSelectedTabRevalidating ? (
                    <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
                      <Loader2Icon className="size-4 animate-spin" />
                      <span className="sr-only">
                        Refreshing {formatVenueDetailTabLabel(tab)}
                      </span>
                    </div>
                  ) : null}
                </div>
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
