import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveVenuesPagination,
} from "@/features/venues/list-route-state.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "organization_id" | "name" | "city" | "country" | "is_active" | "created_at"
>;
type TeamVenueLinkRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>;
type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name" | "is_active"
>;
type ServerSupabaseClient = SupabaseClient<Database>;

const VENUE_SELECT_COLUMNS =
  "id,organization_id,name,city,country,is_active,created_at";

export const VENUES_PAGE_SIZE = 25;

export type VenueOrganizationOption = {
  id: string;
  name: string;
};

export type VenueStatusFilter = "all" | "active" | "inactive";

export type VenueStatusCounts = {
  all: number;
  active: number;
  inactive: number;
};

export type VenueTeamContextItem = {
  teamId: string;
  teamVenueId: string;
  teamName: string;
  isActive: boolean;
  isActiveTeam: boolean;
};

export type VenueListItem = VenueRow & {
  organizationName: string;
  teamVenueId: string | null;
  teamContexts: VenueTeamContextItem[];
};

export type VenuesChromeData = {
  organizations: VenueOrganizationOption[];
  statusCounts: VenueStatusCounts;
  selectedStatusFilter: VenueStatusFilter;
};

export type VenuesResultsData = {
  venues: VenueListItem[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type VenuePageData = {
  organizations: VenueOrganizationOption[];
  venues: VenueListItem[];
};

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function applyVenueStatusFilter<QueryBuilder>(
  query: QueryBuilder,
  statusFilter: VenueStatusFilter,
): QueryBuilder {
  if (statusFilter === "active") {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      true,
    );
  }

  if (statusFilter === "inactive") {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      false,
    );
  }

  return query;
}

async function countVenues(input: {
  activeOrganizationId: string;
  statusFilter: VenueStatusFilter;
}): Promise<number> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.activeOrganizationId);

  query = applyVenueStatusFilter(query, input.statusFilter);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Could not count venues: ${error.message}`);
  }

  return count ?? 0;
}

async function loadTeamContextsByVenueId(input: {
  activeOrganizationId: string;
  activeTeamId: string | null;
  supabase: ServerSupabaseClient;
  venueIds: string[];
}): Promise<Map<string, VenueTeamContextItem[]>> {
  if (input.venueIds.length === 0) {
    return new Map();
  }

  const { data: teamVenueRows, error: teamVenuesError } = await input.supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .in("venue_id", input.venueIds);

  if (teamVenuesError) {
    throw new Error(`Could not load team venues: ${teamVenuesError.message}`);
  }

  const links: TeamVenueLinkRow[] = teamVenueRows ?? [];

  if (links.length === 0) {
    return new Map();
  }

  const teamIds = [...new Set(links.map((row) => row.team_id))];
  const { data: teamRows, error: teamsError } = await input.supabase
    .from("teams")
    .select("id,name,is_active")
    .eq("organization_id", input.activeOrganizationId)
    .in("id", teamIds)
    .order("name", { ascending: true });

  if (teamsError) {
    throw new Error(`Could not load venue teams: ${teamsError.message}`);
  }

  const teamById = new Map(
    ((teamRows ?? []) as TeamRow[]).map((team) => [team.id, team]),
  );
  const contextsByVenueId = new Map<string, VenueTeamContextItem[]>();

  for (const link of links) {
    const team = teamById.get(link.team_id);

    if (!team) {
      continue;
    }

    const contexts = contextsByVenueId.get(link.venue_id) ?? [];
    contexts.push({
      teamId: team.id,
      teamVenueId: link.id,
      teamName: team.name,
      isActive: team.is_active,
      isActiveTeam: input.activeTeamId === team.id,
    });
    contextsByVenueId.set(link.venue_id, contexts);
  }

  for (const [venueId, contexts] of contextsByVenueId) {
    contextsByVenueId.set(
      venueId,
      contexts.sort((first, second) => {
        if (first.isActiveTeam !== second.isActiveTeam) {
          return first.isActiveTeam ? -1 : 1;
        }

        return first.teamName.localeCompare(second.teamName);
      }),
    );
  }

  return contextsByVenueId;
}

export async function getVenuesChromeData(input: {
  activeOrganization: VenueOrganizationOption;
  statusFilter: VenueStatusFilter;
}): Promise<VenuesChromeData> {
  const [all, active, inactive] = await Promise.all([
    countVenues({
      activeOrganizationId: input.activeOrganization.id,
      statusFilter: "all",
    }),
    countVenues({
      activeOrganizationId: input.activeOrganization.id,
      statusFilter: "active",
    }),
    countVenues({
      activeOrganizationId: input.activeOrganization.id,
      statusFilter: "inactive",
    }),
  ]);

  return {
    organizations: [input.activeOrganization],
    statusCounts: {
      all,
      active,
      inactive,
    },
    selectedStatusFilter: input.statusFilter,
  };
}

export async function getVenuesResultsData(input: {
  activeOrganization: VenueOrganizationOption;
  activeTeamId: string | null;
  accumulatePages?: boolean;
  page: number;
  statusFilter: VenueStatusFilter;
}): Promise<VenuesResultsData> {
  const supabase = await createServerSupabaseClient();
  const requestedPage = normalizePage(input.page);
  const accumulatePages = input.accumulatePages === true;
  const totalCount = await countVenues({
    activeOrganizationId: input.activeOrganization.id,
    statusFilter: input.statusFilter,
  });
  const pagination = resolveVenuesPagination({
    requestedPage,
    totalItems: totalCount,
    accumulatePages,
    pageSize: VENUES_PAGE_SIZE,
  });
  const visibleCount = accumulatePages
    ? pagination.currentPage * VENUES_PAGE_SIZE
    : VENUES_PAGE_SIZE;
  const rangeStart = accumulatePages
    ? 0
    : (pagination.currentPage - 1) * VENUES_PAGE_SIZE;
  const rangeEnd = rangeStart + visibleCount - 1;

  let venuesQuery = supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("organization_id", input.activeOrganization.id)
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  venuesQuery = applyVenueStatusFilter(venuesQuery, input.statusFilter);

  const { data: venues, error: venuesError } = await venuesQuery;

  if (venuesError) {
    throw new Error(`Could not load venues: ${venuesError.message}`);
  }

  const venueRows: VenueRow[] = venues ?? [];
  const teamContextsByVenueId = await loadTeamContextsByVenueId({
    activeOrganizationId: input.activeOrganization.id,
    activeTeamId: input.activeTeamId,
    supabase,
    venueIds: venueRows.map((venue) => venue.id),
  });

  const venueItems: VenueListItem[] = venueRows.map((venue) => ({
    ...venue,
    organizationName: input.activeOrganization.name,
    teamVenueId:
      teamContextsByVenueId
        .get(venue.id)
        ?.find((teamContext) => teamContext.isActiveTeam)?.teamVenueId ?? null,
    teamContexts: teamContextsByVenueId.get(venue.id) ?? [],
  }));

  return {
    venues: venueItems,
    totalCount,
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
  };
}

export async function getVenuePageData(input: {
  activeOrganization: VenueOrganizationOption;
  activeTeamId: string | null;
}): Promise<VenuePageData> {
  const supabase = await createServerSupabaseClient();

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("organization_id", input.activeOrganization.id)
    .order("created_at", { ascending: false });

  if (venuesError) {
    throw new Error(`Could not load venues: ${venuesError.message}`);
  }

  const venueRows: VenueRow[] = venues ?? [];
  const teamContextsByVenueId = await loadTeamContextsByVenueId({
    activeOrganizationId: input.activeOrganization.id,
    activeTeamId: input.activeTeamId,
    supabase,
    venueIds: venueRows.map((venue) => venue.id),
  });

  const venueItems: VenueListItem[] = venueRows.map((venue) => ({
    ...venue,
    organizationName: input.activeOrganization.name,
    teamVenueId:
      teamContextsByVenueId
        .get(venue.id)
        ?.find((teamContext) => teamContext.isActiveTeam)?.teamVenueId ?? null,
    teamContexts: teamContextsByVenueId.get(venue.id) ?? [],
  }));

  return {
    organizations: [input.activeOrganization],
    venues: venueItems,
  };
}
