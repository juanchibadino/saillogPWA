import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id,created_at"
const VENUE_SELECT_COLUMNS = "id,name,city,country,is_active"
const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,camp_type,start_date,end_date,is_active,created_at"
const SESSION_COUNT_SELECT_COLUMNS = "camp_id"

export const TEAM_CAMPS_PAGE_SIZE = 25

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id" | "created_at"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country" | "is_active"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "camp_type" | "start_date" | "end_date" | "is_active" | "created_at"
>

type SessionCampCountRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "camp_id"
>

export type TeamCampListItem = {
  id: string
  teamVenueId: string
  venueId: string
  venueName: string
  venueLocation: string
  name: string
  campType: CampRow["camp_type"]
  startDate: string
  endDate: string
  isActive: boolean
  sessionCount: number
}

export type TeamCampVenueOption = {
  teamVenueId: string
  venueId: string
  venueName: string
  venueLocation: string
}

export type TeamCampVenueFilterOption = {
  venueId: string
  venueName: string
  venueLocation: string
}

export type TeamCampsPageData = {
  camps: TeamCampListItem[]
  teamVenueOptions: TeamCampVenueOption[]
  venueFilterOptions: TeamCampVenueFilterOption[]
  selectedVenueId?: string
  currentPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
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

function normalizeSelectedVenueId(input: {
  selectedVenueId?: string
  allowedVenueIds: Set<string>
}): string | undefined {
  if (!input.selectedVenueId) {
    return undefined
  }

  if (!input.allowedVenueIds.has(input.selectedVenueId)) {
    return undefined
  }

  return input.selectedVenueId
}

function buildSessionCountByCampId(rows: SessionCampCountRow[]): Map<string, number> {
  const sessionCountByCampId = new Map<string, number>()

  for (const row of rows) {
    const currentCount = sessionCountByCampId.get(row.camp_id) ?? 0
    sessionCountByCampId.set(row.camp_id, currentCount + 1)
  }

  return sessionCountByCampId
}

export async function getTeamCampsPageData(input: {
  activeTeamId: string
  selectedVenueId?: string
  page: number
}): Promise<TeamCampsPageData> {
  const supabase = await createServerSupabaseClient()

  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false })

  if (teamVenueError) {
    throw new Error(`Could not load team venues: ${teamVenueError.message}`)
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
      throw new Error(`Could not load venues for camps: ${venueError.message}`)
    }

    venueRows = data ?? []
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))
  const teamVenueById = new Map(teamVenueRows.map((row) => [row.id, row]))

  const teamVenueOptions: TeamCampVenueOption[] = teamVenueRows
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        teamVenueId: teamVenue.id,
        venueId: venue.id,
        venueName: venue.name,
        venueLocation: buildLocation(venue.city, venue.country),
      }
    })
    .filter((row): row is TeamCampVenueOption => row !== null)
    .sort((a, b) => a.venueName.localeCompare(b.venueName))

  const venueFilterOptions: TeamCampVenueFilterOption[] = teamVenueOptions.map((row) => ({
    venueId: row.venueId,
    venueName: row.venueName,
    venueLocation: row.venueLocation,
  }))

  const selectedVenueId = normalizeSelectedVenueId({
    selectedVenueId: input.selectedVenueId,
    allowedVenueIds: new Set(venueFilterOptions.map((row) => row.venueId)),
  })

  const filteredTeamVenueRows = selectedVenueId
    ? teamVenueRows.filter((row) => row.venue_id === selectedVenueId)
    : teamVenueRows

  const filteredTeamVenueIds = filteredTeamVenueRows.map((row) => row.id)
  const currentPage = normalizePage(input.page)

  if (filteredTeamVenueIds.length === 0) {
    return {
      camps: [],
      teamVenueOptions,
      venueFilterOptions,
      selectedVenueId,
      currentPage,
      hasPreviousPage: currentPage > 1,
      hasNextPage: false,
    }
  }

  const offset = (currentPage - 1) * TEAM_CAMPS_PAGE_SIZE
  const rangeEnd = offset + TEAM_CAMPS_PAGE_SIZE

  const { data: campData, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("team_venue_id", filteredTeamVenueIds)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd)

  if (campError) {
    throw new Error(`Could not load camps: ${campError.message}`)
  }

  const paginatedCampRows: CampRow[] = campData ?? []
  const hasNextPage = paginatedCampRows.length > TEAM_CAMPS_PAGE_SIZE
  const visibleCampRows = paginatedCampRows.slice(0, TEAM_CAMPS_PAGE_SIZE)
  const visibleCampIds = visibleCampRows.map((row) => row.id)

  let sessionCountRows: SessionCampCountRow[] = []

  if (visibleCampIds.length > 0) {
    const { data, error: sessionCountError } = await supabase
      .from("sessions")
      .select(SESSION_COUNT_SELECT_COLUMNS)
      .in("camp_id", visibleCampIds)

    if (sessionCountError) {
      throw new Error(`Could not load camp session counts: ${sessionCountError.message}`)
    }

    sessionCountRows = data ?? []
  }

  const sessionCountByCampId = buildSessionCountByCampId(sessionCountRows)

  const camps: TeamCampListItem[] = visibleCampRows
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
        id: camp.id,
        teamVenueId: camp.team_venue_id,
        venueId: venue.id,
        venueName: venue.name,
        venueLocation: buildLocation(venue.city, venue.country),
        name: camp.name,
        campType: camp.camp_type,
        startDate: camp.start_date,
        endDate: camp.end_date,
        isActive: camp.is_active,
        sessionCount: sessionCountByCampId.get(camp.id) ?? 0,
      }
    })
    .filter((row): row is TeamCampListItem => row !== null)

  return {
    camps,
    teamVenueOptions,
    venueFilterOptions,
    selectedVenueId,
    currentPage,
    hasPreviousPage: currentPage > 1,
    hasNextPage,
  }
}
