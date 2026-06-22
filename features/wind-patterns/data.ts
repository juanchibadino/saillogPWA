import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamVenueWindPatternRow = Pick<
  Database["public"]["Tables"]["team_venue_wind_patterns"]["Row"],
  "id" | "team_venue_id" | "name" | "description" | "is_active" | "created_at" | "updated_at"
>

type SessionWindPatternRow = Pick<
  Database["public"]["Tables"]["session_wind_patterns"]["Row"],
  "team_venue_wind_pattern_id"
>

const TEAM_VENUE_WIND_PATTERN_SELECT_COLUMNS =
  "id,team_venue_id,name,description,is_active,created_at,updated_at"
const SESSION_WIND_PATTERN_SELECT_COLUMNS = "team_venue_wind_pattern_id"

export type TeamVenueWindPatternListItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  usageCount: number
  updatedAt: string
}

export type TeamVenueWindPatternsPageData = {
  patterns: TeamVenueWindPatternListItem[]
  activeCount: number
  archivedCount: number
}

export async function getTeamVenueWindPatternsPageData(input: {
  teamVenueId: string
}): Promise<TeamVenueWindPatternsPageData> {
  const supabase = await createServerSupabaseClient()
  const { data: windPatternRows, error: windPatternsError } = await supabase
    .from("team_venue_wind_patterns")
    .select(TEAM_VENUE_WIND_PATTERN_SELECT_COLUMNS)
    .eq("team_venue_id", input.teamVenueId)
    .order("updated_at", { ascending: false })

  if (windPatternsError) {
    throw new Error(`Could not load venue wind patterns: ${windPatternsError.message}`)
  }

  const windPatterns = (windPatternRows ?? []) as TeamVenueWindPatternRow[]
  const windPatternIds = windPatterns.map((windPattern) => windPattern.id)
  let sessionWindPatterns: SessionWindPatternRow[] = []

  if (windPatternIds.length > 0) {
    const { data: sessionWindPatternRows, error: sessionWindPatternsError } = await supabase
      .from("session_wind_patterns")
      .select(SESSION_WIND_PATTERN_SELECT_COLUMNS)
      .in("team_venue_wind_pattern_id", windPatternIds)

    if (sessionWindPatternsError) {
      throw new Error(
        `Could not load session wind pattern usage: ${sessionWindPatternsError.message}`,
      )
    }

    sessionWindPatterns = (sessionWindPatternRows ?? []) as SessionWindPatternRow[]
  }

  const usageCountByPatternId = new Map<string, number>()

  for (const sessionWindPattern of sessionWindPatterns) {
    const currentCount =
      usageCountByPatternId.get(sessionWindPattern.team_venue_wind_pattern_id) ?? 0
    usageCountByPatternId.set(
      sessionWindPattern.team_venue_wind_pattern_id,
      currentCount + 1,
    )
  }

  const mappedPatterns: TeamVenueWindPatternListItem[] = windPatterns.map((windPattern) => ({
    id: windPattern.id,
    name: windPattern.name,
    description: windPattern.description,
    isActive: windPattern.is_active,
    usageCount: usageCountByPatternId.get(windPattern.id) ?? 0,
    updatedAt: windPattern.updated_at,
  }))

  return {
    patterns: mappedPatterns,
    activeCount: mappedPatterns.filter((windPattern) => windPattern.isActive).length,
    archivedCount: mappedPatterns.filter((windPattern) => !windPattern.isActive).length,
  }
}
