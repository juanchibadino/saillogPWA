import "server-only";

import {
  resolveTeamVenuePagination,
} from "@/features/team-venues/list-route-state.mjs";
import {
  formatTeamVenuesListTimingError,
  logTeamVenuesListTiming,
  startTeamVenuesListTiming,
} from "@/features/team-venues/list-timing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id,created_at";
const VENUE_SELECT_COLUMNS = "id,name,city,country,is_active";
const CAMP_COUNT_SELECT_COLUMNS = "team_venue_id";

export const TEAM_VENUES_PAGE_SIZE = 25;

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id" | "created_at"
>;
type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country" | "is_active"
>;

type CampCountRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "team_venue_id"
>;

export type TeamVenueListItem = {
  id: string;
  teamId: string;
  venueId: string;
  venueName: string;
  city: string;
  country: string;
  isActive: boolean;
  campCountCurrentYear: number | null;
  totalCampCount: number | null;
};

export type TeamVenueChromeItem = Omit<
  TeamVenueListItem,
  "campCountCurrentYear" | "totalCampCount"
>;

export type TeamVenueCreateOption = {
  venueId: string;
  name: string;
  city: string;
  country: string;
  isActive: boolean;
};

export type TeamVenueStatusFilter = "active" | "deprecated";

export type TeamVenueStatusCounts = {
  active: number;
  deprecated: number;
};

export type TeamVenuesChromeData = {
  linkedVenueOptions: TeamVenueChromeItem[];
  availableVenueOptions: TeamVenueCreateOption[];
  statusCounts: TeamVenueStatusCounts;
  selectedStatusFilter: TeamVenueStatusFilter;
};

export type TeamVenuesResultsData = {
  linkedVenues: TeamVenueListItem[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  metricsStatus: "fresh" | "pending";
};

export type TeamVenuesPageData = TeamVenuesChromeData & TeamVenuesResultsData;

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function buildLocation(city: string, country: string): string {
  return `${city}, ${country}`;
}

function buildCampCountMap(rows: CampCountRow[]): Map<string, number> {
  const countByTeamVenueId = new Map<string, number>();

  for (const row of rows) {
    const currentCount = countByTeamVenueId.get(row.team_venue_id) ?? 0;
    countByTeamVenueId.set(row.team_venue_id, currentCount + 1);
  }

  return countByTeamVenueId;
}

function buildStatusCounts(rows: TeamVenueChromeItem[]): TeamVenueStatusCounts {
  return rows.reduce<TeamVenueStatusCounts>(
    (counts, row) => {
      if (row.isActive) {
        counts.active += 1;
      } else {
        counts.deprecated += 1;
      }

      return counts;
    },
    {
      active: 0,
      deprecated: 0,
    },
  );
}

function sortTeamVenueChromeItems(
  rows: TeamVenueChromeItem[],
): TeamVenueChromeItem[] {
  return [...rows].sort((a, b) => a.venueName.localeCompare(b.venueName));
}

export async function getTeamVenuesChromeData(input: {
  activeOrganizationId: string;
  activeTeamId: string;
  includeAvailableVenueOptions?: boolean;
  statusFilter: TeamVenueStatusFilter;
  page?: number;
  accumulatePages?: boolean;
}): Promise<TeamVenuesChromeData> {
  const startedAt = startTeamVenuesListTiming();

  try {
    const supabase = await createServerSupabaseClient();

    const { data: teamVenueRows, error: teamVenueError } = await supabase
      .from("team_venues")
      .select(TEAM_VENUE_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("created_at", { ascending: false });

    if (teamVenueError) {
      throw new Error(`Could not load team-venue links: ${teamVenueError.message}`);
    }

    const allTeamVenueRows: TeamVenueRow[] = teamVenueRows ?? [];
    const linkedVenueIdsSet = new Set(allTeamVenueRows.map((row) => row.venue_id));
    const shouldLoadAvailableVenueOptions =
      input.includeAvailableVenueOptions !== false;
    let organizationVenues: VenueRow[] = [];

    if (shouldLoadAvailableVenueOptions) {
      const { data: venueRows, error: venueError } = await supabase
        .from("venues")
        .select(VENUE_SELECT_COLUMNS)
        .eq("organization_id", input.activeOrganizationId)
        .order("name", { ascending: true });

      if (venueError) {
        throw new Error(`Could not load organization venues: ${venueError.message}`);
      }

      organizationVenues = venueRows ?? [];
    } else if (linkedVenueIdsSet.size > 0) {
      const { data: venueRows, error: venueError } = await supabase
        .from("venues")
        .select(VENUE_SELECT_COLUMNS)
        .eq("organization_id", input.activeOrganizationId)
        .in("id", [...linkedVenueIdsSet])
        .order("name", { ascending: true });

      if (venueError) {
        throw new Error(`Could not load linked venues: ${venueError.message}`);
      }

      organizationVenues = venueRows ?? [];
    }

    const venueById = new Map(organizationVenues.map((venue) => [venue.id, venue]));

    const linkedVenueOptions = sortTeamVenueChromeItems(
      allTeamVenueRows
        .map((row) => {
          const venue = venueById.get(row.venue_id);

          if (!venue) {
            return null;
          }

          return {
            id: row.id,
            teamId: row.team_id,
            venueId: row.venue_id,
            venueName: venue.name,
            city: venue.city,
            country: venue.country,
            isActive: venue.is_active,
          };
        })
        .filter((row): row is TeamVenueChromeItem => row !== null),
    );

    const availableVenueOptions: TeamVenueCreateOption[] =
      shouldLoadAvailableVenueOptions
        ? organizationVenues
            .filter((venue) => !linkedVenueIdsSet.has(venue.id))
            .map((venue) => ({
              venueId: venue.id,
              name: venue.name,
              city: venue.city,
              country: venue.country,
              isActive: venue.is_active,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    logTeamVenuesListTiming({
      phase: "chrome/catalog",
      startedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        activeOrganizationId: input.activeOrganizationId,
        accumulatePages: input.accumulatePages === true,
        availableVenueCount: availableVenueOptions.length,
        includeAvailableVenueOptions: shouldLoadAvailableVenueOptions,
        linkedVenueCount: linkedVenueOptions.length,
        organizationVenueCount: organizationVenues.length,
        requestedPage: input.page ?? 1,
        statusFilter: input.statusFilter,
      },
    });

    return {
      linkedVenueOptions,
      availableVenueOptions,
      statusCounts: buildStatusCounts(linkedVenueOptions),
      selectedStatusFilter: input.statusFilter,
    };
  } catch (error) {
    logTeamVenuesListTiming({
      phase: "chrome/catalog",
      startedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: formatTeamVenuesListTimingError(error),
      metadata: {
        activeOrganizationId: input.activeOrganizationId,
        accumulatePages: input.accumulatePages === true,
        includeAvailableVenueOptions: input.includeAvailableVenueOptions !== false,
        requestedPage: input.page ?? 1,
        statusFilter: input.statusFilter,
      },
    });
    throw error;
  }
}

export async function getTeamVenuesResultsData(input: {
  activeTeamId?: string | null;
  chromeData: TeamVenuesChromeData;
  currentYear: number;
  includeMetrics?: boolean;
  page: number;
  accumulatePages?: boolean;
  statusFilter?: TeamVenueStatusFilter;
}): Promise<TeamVenuesResultsData> {
  const resultsStartedAt = startTeamVenuesListTiming();
  const requestedPage = normalizePage(input.page);
  const accumulatePages = input.accumulatePages === true;
  const statusFilter =
    input.statusFilter ?? input.chromeData.selectedStatusFilter;
  const filteredTeamVenues = input.chromeData.linkedVenueOptions.filter((row) =>
    statusFilter === "active" ? row.isActive : !row.isActive,
  );
  const pagination = resolveTeamVenuePagination({
    requestedPage,
    totalItems: filteredTeamVenues.length,
    accumulatePages,
    pageSize: TEAM_VENUES_PAGE_SIZE,
  });
  const { currentPage, pageCount, hasPreviousPage, hasNextPage } = pagination;
  const visibleCount = accumulatePages
    ? currentPage * TEAM_VENUES_PAGE_SIZE
    : TEAM_VENUES_PAGE_SIZE;
  const rangeStart = accumulatePages
    ? 0
    : (currentPage - 1) * TEAM_VENUES_PAGE_SIZE;
  const rangeEnd = rangeStart + visibleCount;
  const visibleTeamVenues = filteredTeamVenues.slice(rangeStart, rangeEnd);
  const visibleTeamVenueIds = visibleTeamVenues.map((row) => row.id);
  const includeMetrics = input.includeMetrics !== false;

  logTeamVenuesListTiming({
    phase: "results",
    startedAt: resultsStartedAt,
    activeTeamId: input.activeTeamId,
    status: "success",
    metadata: {
      accumulatePages,
      currentPage,
      pageCount,
      requestedPage,
      statusFilter,
      totalCount: filteredTeamVenues.length,
      visibleTeamVenueCount: visibleTeamVenues.length,
    },
  });

  let campCountRows: CampCountRow[] = [];
  let allCampCountRows: CampCountRow[] = [];

  if (includeMetrics) {
    const campCountsStartedAt = startTeamVenuesListTiming();

    try {
      const supabase = await createServerSupabaseClient();

      if (visibleTeamVenueIds.length > 0) {
        const startOfYear = `${input.currentYear}-01-01`;
        const startOfNextYear = `${input.currentYear + 1}-01-01`;

        const { data, error: campsError } = await supabase
          .from("camps")
          .select(CAMP_COUNT_SELECT_COLUMNS)
          .in("team_venue_id", visibleTeamVenueIds)
          .gte("start_date", startOfYear)
          .lt("start_date", startOfNextYear);

        if (campsError) {
          throw new Error(`Could not load camps for metrics: ${campsError.message}`);
        }

        campCountRows = data ?? [];

        const { data: allCampData, error: allCampsError } = await supabase
          .from("camps")
          .select(CAMP_COUNT_SELECT_COLUMNS)
          .in("team_venue_id", visibleTeamVenueIds);

        if (allCampsError) {
          throw new Error(`Could not load total camps for delete rules: ${allCampsError.message}`);
        }

        allCampCountRows = allCampData ?? [];
      }

      logTeamVenuesListTiming({
        phase: "camp counts",
        startedAt: campCountsStartedAt,
        activeTeamId: input.activeTeamId,
        status: "success",
        metadata: {
          currentYear: input.currentYear,
          currentYearCampRowCount: campCountRows.length,
          totalCampRowCount: allCampCountRows.length,
          visibleTeamVenueCount: visibleTeamVenueIds.length,
        },
      });
    } catch (error) {
      logTeamVenuesListTiming({
        phase: "camp counts",
        startedAt: campCountsStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: formatTeamVenuesListTimingError(error),
        metadata: {
          currentYear: input.currentYear,
          visibleTeamVenueCount: visibleTeamVenueIds.length,
        },
      });
      throw error;
    }
  }

  const campCountByTeamVenueId = buildCampCountMap(campCountRows);
  const totalCampCountByTeamVenueId = buildCampCountMap(allCampCountRows);
  const linkedVenues: TeamVenueListItem[] = visibleTeamVenues.map((row) => ({
    ...row,
    campCountCurrentYear: includeMetrics
      ? campCountByTeamVenueId.get(row.id) ?? 0
      : null,
    totalCampCount: includeMetrics
      ? totalCampCountByTeamVenueId.get(row.id) ?? 0
      : null,
  }));

  return {
    linkedVenues,
    totalCount: filteredTeamVenues.length,
    currentPage,
    pageCount,
    hasPreviousPage,
    hasNextPage,
    metricsStatus: includeMetrics ? "fresh" : "pending",
  };
}

export async function getTeamVenuesPageData(input: {
  activeOrganizationId: string;
  activeTeamId: string;
  statusFilter: TeamVenueStatusFilter;
  currentYear: number;
  page?: number;
  accumulatePages?: boolean;
}): Promise<TeamVenuesPageData> {
  const chromeData = await getTeamVenuesChromeData(input);
  const resultsData = await getTeamVenuesResultsData({
    activeTeamId: input.activeTeamId,
    chromeData,
    currentYear: input.currentYear,
    page: input.page ?? 1,
    accumulatePages: input.accumulatePages,
    statusFilter: input.statusFilter,
  });

  return {
    ...chromeData,
    ...resultsData,
  };
}

export function formatTeamVenueLocation(input: { city: string; country: string }): string {
  return buildLocation(input.city, input.country);
}
