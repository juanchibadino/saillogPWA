import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country"
const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,start_date,end_date,is_active,created_at"
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at"

export const TEAM_SESSIONS_PAGE_SIZE = 25

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "start_date" | "end_date" | "is_active" | "created_at"
>

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "camp_id" | "session_type" | "session_date" | "net_time_minutes" | "highlighted_by_coach" | "created_at"
>

export type TeamSessionListItem = {
  id: string
  campId: string
  campName: string
  venueId: string
  venueName: string
  sessionType: SessionRow["session_type"]
  sessionDate: string
  netTimeMinutes: number | null
  highlightedByCoach: boolean
}

export type TeamSessionVenueFilterOption = {
  venueId: string
  venueName: string
  venueLocation: string
}

export type TeamSessionCampOption = {
  campId: string
  venueId: string
  venueName: string
  campName: string
  startDate: string
  endDate: string
  isActive: boolean
  label: string
}

export type TeamSessionsPageData = {
  sessions: TeamSessionListItem[]
  venueFilterOptions: TeamSessionVenueFilterOption[]
  campFilterOptions: TeamSessionCampOption[]
  campOptions: TeamSessionCampOption[]
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

function buildCampOptionsForMutations(input: {
  selectedCampId?: string
  campFilterOptions: TeamSessionCampOption[]
}): TeamSessionCampOption[] {
  if (!input.selectedCampId) {
    return input.campFilterOptions
  }

  return input.campFilterOptions.filter(
    (option) => option.campId === input.selectedCampId,
  )
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function buildLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function buildCampOptionLabel(input: {
  campName: string
  venueName: string
}): string {
  return `${input.campName} — ${input.venueName}`
}

function normalizeSelectedId(input: {
  selectedId?: string
  allowedIds: Set<string>
}): string | undefined {
  if (!input.selectedId) {
    return undefined
  }

  if (!input.allowedIds.has(input.selectedId)) {
    return undefined
  }

  return input.selectedId
}

export async function getTeamSessionsPageData(input: {
  activeTeamId: string
  selectedVenueId?: string
  selectedCampId?: string
  page: number
}): Promise<TeamSessionsPageData> {
  const supabase = await createServerSupabaseClient()
  const currentPage = normalizePage(input.page)

  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load team venues for sessions: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueRow[] = teamVenueData ?? []
  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))

  let venueRows: VenueRow[] = []

  if (venueIds.length > 0) {
    const { data, error: venueError } = await supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .in("id", venueIds)
      .order("name", { ascending: true })

    if (venueError) {
      throw new Error(`Could not load venues for sessions: ${venueError.message}`)
    }

    venueRows = data ?? []
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))
  const teamVenueById = new Map(teamVenueRows.map((row) => [row.id, row]))

  const venueFilterOptions: TeamSessionVenueFilterOption[] = teamVenueRows
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        venueId: venue.id,
        venueName: venue.name,
        venueLocation: buildLocation(venue.city, venue.country),
      }
    })
    .filter((row): row is TeamSessionVenueFilterOption => row !== null)
    .sort((a, b) => a.venueName.localeCompare(b.venueName))

  const selectedVenueId = normalizeSelectedId({
    selectedId: input.selectedVenueId,
    allowedIds: new Set(venueFilterOptions.map((row) => row.venueId)),
  })

  const filteredTeamVenueRows = selectedVenueId
    ? teamVenueRows.filter((row) => row.venue_id === selectedVenueId)
    : teamVenueRows

  const filteredTeamVenueIds = filteredTeamVenueRows.map((row) => row.id)

  if (filteredTeamVenueIds.length === 0) {
    return {
      sessions: [],
      venueFilterOptions,
      campFilterOptions: [],
      campOptions: [],
      selectedVenueId,
      currentPage,
      hasPreviousPage: currentPage > 1,
      hasNextPage: false,
    }
  }

  const { data: campData, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("team_venue_id", filteredTeamVenueIds)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (campError) {
    throw new Error(`Could not load camps for sessions: ${campError.message}`)
  }

  const campRows: CampRow[] = campData ?? []
  const campById = new Map(campRows.map((row) => [row.id, row]))

  const campFilterOptions: TeamSessionCampOption[] = campRows
    .map((camp) => {
      const teamVenue = teamVenueById.get(camp.team_venue_id)

      if (!teamVenue) {
        return null
      }

      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        campId: camp.id,
        venueId: venue.id,
        venueName: venue.name,
        campName: camp.name,
        startDate: camp.start_date,
        endDate: camp.end_date,
        isActive: camp.is_active,
        label: buildCampOptionLabel({
          campName: camp.name,
          venueName: venue.name,
        }),
      }
    })
    .filter((row): row is TeamSessionCampOption => row !== null)

  const selectedCampId = normalizeSelectedId({
    selectedId: input.selectedCampId,
    allowedIds: new Set(campFilterOptions.map((row) => row.campId)),
  })

  const sessionCampIds = selectedCampId
    ? [selectedCampId]
    : campFilterOptions.map((row) => row.campId)

  if (sessionCampIds.length === 0) {
    return {
      sessions: [],
      venueFilterOptions,
      campFilterOptions,
      campOptions: buildCampOptionsForMutations({
        selectedCampId,
        campFilterOptions,
      }),
      selectedVenueId,
      selectedCampId,
      currentPage,
      hasPreviousPage: currentPage > 1,
      hasNextPage: false,
    }
  }

  const offset = (currentPage - 1) * TEAM_SESSIONS_PAGE_SIZE
  const rangeEnd = offset + TEAM_SESSIONS_PAGE_SIZE

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .in("camp_id", sessionCampIds)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd)

  if (sessionError) {
    throw new Error(`Could not load sessions: ${sessionError.message}`)
  }

  const paginatedSessionRows: SessionRow[] = sessionData ?? []
  const hasNextPage = paginatedSessionRows.length > TEAM_SESSIONS_PAGE_SIZE
  const visibleSessionRows = paginatedSessionRows.slice(0, TEAM_SESSIONS_PAGE_SIZE)

  const sessions: TeamSessionListItem[] = visibleSessionRows
    .map((session) => {
      const camp = campById.get(session.camp_id)

      if (!camp) {
        return null
      }

      const teamVenue = teamVenueById.get(camp.team_venue_id)

      if (!teamVenue) {
        return null
      }

      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        id: session.id,
        campId: camp.id,
        campName: camp.name,
        venueId: venue.id,
        venueName: venue.name,
        sessionType: session.session_type,
        sessionDate: session.session_date,
        netTimeMinutes: session.net_time_minutes,
        highlightedByCoach: session.highlighted_by_coach,
      }
    })
    .filter((row): row is TeamSessionListItem => row !== null)

  return {
    sessions,
    venueFilterOptions,
    campFilterOptions,
    campOptions: buildCampOptionsForMutations({
      selectedCampId,
      campFilterOptions,
    }),
    selectedVenueId,
    selectedCampId,
    currentPage,
    hasPreviousPage: currentPage > 1,
    hasNextPage,
  }
}
