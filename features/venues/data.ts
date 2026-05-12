import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type TeamVenueLinkRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>;

export type VenueOrganizationOption = {
  id: string;
  name: string;
};

export type VenueListItem = VenueRow & {
  organizationName: string;
  teamVenueId: string | null;
};

export type VenuePageData = {
  organizations: VenueOrganizationOption[];
  venues: VenueListItem[];
};

export async function getVenuePageData(input: {
  activeOrganization: VenueOrganizationOption;
  activeTeamId: string | null;
}): Promise<VenuePageData> {
  const supabase = await createServerSupabaseClient();

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("*")
    .eq("organization_id", input.activeOrganization.id)
    .order("created_at", { ascending: false });

  if (venuesError) {
    throw new Error(`Could not load venues: ${venuesError.message}`);
  }

  const venueRows: VenueRow[] = venues ?? [];
  let teamVenueIdByVenueId = new Map<string, string>();

  if (input.activeTeamId && venueRows.length > 0) {
    const venueIds = venueRows.map((venue) => venue.id);
    const { data: teamVenueRows, error: teamVenuesError } = await supabase
      .from("team_venues")
      .select("id,team_id,venue_id")
      .eq("team_id", input.activeTeamId)
      .in("venue_id", venueIds);

    if (teamVenuesError) {
      throw new Error(`Could not load team venues: ${teamVenuesError.message}`);
    }

    teamVenueIdByVenueId = new Map(
      ((teamVenueRows ?? []) as TeamVenueLinkRow[]).map((row) => [
        row.venue_id,
        row.id,
      ]),
    );
  }

  const venueItems: VenueListItem[] = venueRows.map((venue) => ({
    ...venue,
    organizationName: input.activeOrganization.name,
    teamVenueId: teamVenueIdByVenueId.get(venue.id) ?? null,
  }));

  return {
    organizations: [input.activeOrganization],
    venues: venueItems,
  };
}
