import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamRow = Database["public"]["Tables"]["teams"]["Row"]

export type TeamListItem = TeamRow

export async function getTeamsPageData(input: {
  activeOrganizationId: string
}): Promise<{
  teams: TeamListItem[]
}> {
  const supabase = await createServerSupabaseClient()
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .eq("organization_id", input.activeOrganizationId)
    .order("name", { ascending: true })

  if (teamsError) {
    throw new Error(`Could not load teams: ${teamsError.message}`)
  }

  return {
    teams: teamsData ?? [],
  }
}
