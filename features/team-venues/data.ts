import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TeamVenueRow = Database["public"]["Tables"]["team_venues"]["Row"];
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];

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
  campCountCurrentYear: number;
  totalCampCount: number;
};

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

export type TeamVenuesPageData = {
  linkedVenues: TeamVenueListItem[];
  availableVenueOptions: TeamVenueCreateOption[];
  statusCounts: TeamVenueStatusCounts;
};

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

function buildStatusCounts(rows: TeamVenueListItem[]): TeamVenueStatusCounts {
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

export async function getTeamVenuesPageData(input: {
  activeOrganizationId: string;
  activeTeamId: string;
  statusFilter: TeamVenueStatusFilter;
  currentYear: number;
}): Promise<TeamVenuesPageData> {
  const supabase = await createServerSupabaseClient();

  const { data: teamVenueRows, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("*")
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false });

  if (teamVenueError) {
    throw new Error(`Could not load team-venue links: ${teamVenueError.message}`);
  }

  const allTeamVenueRows: TeamVenueRow[] = teamVenueRows ?? [];

  const { data: venueRows, error: venueError } = await supabase
    .from("venues")
    .select("*")
    .eq("organization_id", input.activeOrganizationId)
    .order("name", { ascending: true });

  if (venueError) {
    throw new Error(`Could not load organization venues: ${venueError.message}`);
  }

  const organizationVenues: VenueRow[] = venueRows ?? [];
  const venueById = new Map(organizationVenues.map((venue) => [venue.id, venue]));
  const linkedVenueIdsSet = new Set(allTeamVenueRows.map((row) => row.venue_id));

  const allLinkedVenues: TeamVenueListItem[] = allTeamVenueRows
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
        campCountCurrentYear: 0,
        totalCampCount: 0,
      };
    })
    .filter((row): row is TeamVenueListItem => row !== null);

  const statusCounts = buildStatusCounts(allLinkedVenues);
  const visibleTeamVenues = allLinkedVenues.filter((row) =>
    input.statusFilter === "active" ? row.isActive : !row.isActive,
  );
  const visibleTeamVenueIds = visibleTeamVenues.map((row) => row.id);

  let campCountRows: CampCountRow[] = [];

  if (visibleTeamVenueIds.length > 0) {
    const startOfYear = `${input.currentYear}-01-01`;
    const startOfNextYear = `${input.currentYear + 1}-01-01`;

    const { data, error: campsError } = await supabase
      .from("camps")
      .select("team_venue_id")
      .in("team_venue_id", visibleTeamVenueIds)
      .gte("start_date", startOfYear)
      .lt("start_date", startOfNextYear);

    if (campsError) {
      throw new Error(`Could not load camps for metrics: ${campsError.message}`);
    }

    campCountRows = (data ?? []) as CampCountRow[];
  }

  const campCountByTeamVenueId = buildCampCountMap(campCountRows);
  let allCampCountRows: CampCountRow[] = [];

  if (visibleTeamVenueIds.length > 0) {
    const { data, error: allCampsError } = await supabase
      .from("camps")
      .select("team_venue_id")
      .in("team_venue_id", visibleTeamVenueIds);

    if (allCampsError) {
      throw new Error(`Could not load total camps for delete rules: ${allCampsError.message}`);
    }

    allCampCountRows = (data ?? []) as CampCountRow[];
  }

  const totalCampCountByTeamVenueId = buildCampCountMap(allCampCountRows);

  const linkedVenues: TeamVenueListItem[] = visibleTeamVenues
    .map((row) => ({
      ...row,
      campCountCurrentYear: campCountByTeamVenueId.get(row.id) ?? 0,
      totalCampCount: totalCampCountByTeamVenueId.get(row.id) ?? 0,
    }))
    .sort((a, b) => a.venueName.localeCompare(b.venueName));

  const availableVenueOptions: TeamVenueCreateOption[] = organizationVenues
    .filter((venue) => !linkedVenueIdsSet.has(venue.id))
    .map((venue) => ({
      venueId: venue.id,
      name: venue.name,
      city: venue.city,
      country: venue.country,
      isActive: venue.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    linkedVenues,
    availableVenueOptions,
    statusCounts,
  };
}

export function formatTeamVenueLocation(input: { city: string; country: string }): string {
  return buildLocation(input.city, input.country);
}
