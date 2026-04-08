import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OrganizationMembershipRow =
  Database["public"]["Tables"]["organization_memberships"]["Row"];
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

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)];
}

export async function getVenuePageData(input: {
  profileId: string;
  isSuperAdmin: boolean;
}): Promise<VenuePageData> {
  const supabase = await createServerSupabaseClient();

  let organizationIds: string[] = [];

  if (input.isSuperAdmin) {
    const { data: allOrganizations, error: allOrganizationsError } = await supabase
      .from("organizations")
      .select("id")
      .eq("is_active", true);

    if (allOrganizationsError) {
      throw new Error(`Could not load organizations: ${allOrganizationsError.message}`);
    }

    organizationIds = uniqueIds((allOrganizations ?? []).map((row) => row.id));
  } else {
    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", input.profileId);

    if (membershipsError) {
      throw new Error(`Could not load memberships: ${membershipsError.message}`);
    }

    const membershipRows: Pick<OrganizationMembershipRow, "organization_id">[] =
      memberships ?? [];
    organizationIds = uniqueIds(membershipRows.map((row) => row.organization_id));
  }

  if (organizationIds.length === 0) {
    return {
      organizations: [],
      venues: [],
    };
  }

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (organizationsError) {
    throw new Error(`Could not load organization details: ${organizationsError.message}`);
  }

  const organizationOptions: VenueOrganizationOption[] = organizations ?? [];

  if (organizationOptions.length === 0) {
    return {
      organizations: [],
      venues: [],
    };
  }

  const allowedOrganizationIds = organizationOptions.map((organization) => organization.id);
  const organizationNames = new Map(
    organizationOptions.map((organization) => [organization.id, organization.name]),
  );

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("*")
    .in("organization_id", allowedOrganizationIds)
    .order("created_at", { ascending: false });

  if (venuesError) {
    throw new Error(`Could not load venues: ${venuesError.message}`);
  }

  const venueRows: VenueRow[] = venues ?? [];
  const venueItems: VenueListItem[] = venueRows.map((venue) => ({
    ...venue,
    organizationName:
      organizationNames.get(venue.organization_id) ?? "Unknown organization",
  }));

  return {
    organizations: organizationOptions,
    venues: venueItems,
  };
}
