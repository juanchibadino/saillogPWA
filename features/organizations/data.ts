import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type TeamOrganizationRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "organization_id"
>

export type OrganizationListItem = OrganizationRow & {
  teamCount: number
}

export async function getOrganizationsPageData(): Promise<{
  organizations: OrganizationListItem[]
}> {
  const supabase = await createServerSupabaseClient()
  const { data: organizationsData, error: organizationsError } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true })

  if (organizationsError) {
    throw new Error(`Could not load organizations: ${organizationsError.message}`)
  }

  const organizationRows: OrganizationRow[] = organizationsData ?? []
  const organizationIds = organizationRows.map((organization) => organization.id)

  let activeTeamRows: TeamOrganizationRow[] = []

  if (organizationIds.length > 0) {
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("organization_id")
      .in("organization_id", organizationIds)
      .eq("is_active", true)

    if (teamsError) {
      throw new Error(`Could not load organization team counts: ${teamsError.message}`)
    }

    activeTeamRows = (teamsData ?? []) as TeamOrganizationRow[]
  }

  const teamCountByOrganizationId = new Map<string, number>()

  for (const teamRow of activeTeamRows) {
    const currentCount = teamCountByOrganizationId.get(teamRow.organization_id) ?? 0
    teamCountByOrganizationId.set(teamRow.organization_id, currentCount + 1)
  }

  return {
    organizations: organizationRows.map((organization) => ({
      ...organization,
      teamCount: teamCountByOrganizationId.get(organization.id) ?? 0,
    })),
  }
}
