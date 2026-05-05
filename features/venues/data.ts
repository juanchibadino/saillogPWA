import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];

export type VenueOrganizationOption = {
  id: string;
  name: string;
};

export type VenueListItem = VenueRow & {
  organizationName: string;
};

export type VenuePageData = {
  organizations: VenueOrganizationOption[];
  venues: VenueListItem[];
};

export async function getVenuePageData(input: {
  activeOrganization: VenueOrganizationOption;
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
  const venueItems: VenueListItem[] = venueRows.map((venue) => ({
    ...venue,
    organizationName: input.activeOrganization.name,
  }));

  return {
    organizations: [input.activeOrganization],
    venues: venueItems,
  };
}
