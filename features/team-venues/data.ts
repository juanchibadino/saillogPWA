import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TeamVenueRow = Database["public"]["Tables"]["team_venues"]["Row"];
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];

type CampCountRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "team_venue_id" | "start_date"
>;

export type TeamVenueListItem = {
  id: string;
  teamId: string;
  venueId: string;
  venueName: string;
  city: string;
  country: string;
  campCountCurrentYear: number;
};

export type TeamVenueCreateOption = {
  venueId: string;
  name: string;
  city: string;
  country: string;
};

export type TeamVenuesPageData = {
  linkedVenues: TeamVenueListItem[];
  availableVenueOptions: TeamVenueCreateOption[];
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

export async function getTeamVenuesPageData(input: {
  activeOrganizationId: string;
  activeTeamId: string;
  selectedVenueId?: string;
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
  const visibleTeamVenueRows = input.selectedVenueId
    ? allTeamVenueRows.filter((row) => row.venue_id === input.selectedVenueId)
    : allTeamVenueRows;

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

  const visibleTeamVenueIds = visibleTeamVenueRows.map((row) => row.id);
  const visibleVenueIdsSet = new Set(visibleTeamVenueRows.map((row) => row.venue_id));
  const linkedVenueIdsSet = new Set(allTeamVenueRows.map((row) => row.venue_id));

  let campCountRows: CampCountRow[] = [];

  if (visibleTeamVenueIds.length > 0) {
    const startOfYear = `${input.currentYear}-01-01`;
    const startOfNextYear = `${input.currentYear + 1}-01-01`;

    const { data, error: campsError } = await supabase
      .from("camps")
      .select("team_venue_id,start_date")
      .in("team_venue_id", visibleTeamVenueIds)
      .gte("start_date", startOfYear)
      .lt("start_date", startOfNextYear);

    if (campsError) {
      throw new Error(`Could not load camps for metrics: ${campsError.message}`);
    }

    campCountRows = (data ?? []) as CampCountRow[];
  }

  const campCountByTeamVenueId = buildCampCountMap(campCountRows);

  const linkedVenues: TeamVenueListItem[] = visibleTeamVenueRows
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
        campCountCurrentYear: campCountByTeamVenueId.get(row.id) ?? 0,
      };
    })
    .filter((row): row is TeamVenueListItem => row !== null)
    .sort((a, b) => a.venueName.localeCompare(b.venueName));

  const availableVenueOptions: TeamVenueCreateOption[] = organizationVenues
    .filter((venue) => venue.is_active)
    .filter((venue) => !linkedVenueIdsSet.has(venue.id))
    .filter((venue) => !visibleVenueIdsSet.has(venue.id) || !input.selectedVenueId)
    .map((venue) => ({
      venueId: venue.id,
      name: venue.name,
      city: venue.city,
      country: venue.country,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    linkedVenues,
    availableVenueOptions,
  };
}

export function formatTeamVenueLocation(input: { city: string; country: string }): string {
  return buildLocation(input.city, input.country);
}
