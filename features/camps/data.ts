import "server-only"

import {
  logTeamCampsListTiming,
  startTeamCampsListTiming,
} from "@/features/camps/list-timing"
import {
  normalizeSelectedId,
  resolveCampPagination,
} from "@/features/camps/list-route-state.mjs"
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
  sessionCount: number | null
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

export type TeamCampTypeFilter = CampRow["camp_type"]
export type TeamCampStatusFilter = "active" | "inactive"

export type TeamCampsChromeData = {
  teamVenueOptions: TeamCampVenueOption[]
  venueFilterOptions: TeamCampVenueFilterOption[]
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
}

export type TeamCampsResultsData = {
  camps: TeamCampListItem[]
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  sessionCountsStatus: "fresh" | "pending"
}

export type TeamCampsPageData = TeamCampsChromeData & TeamCampsResultsData

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

function buildSessionCountByCampId(rows: SessionCampCountRow[]): Map<string, number> {
  const sessionCountByCampId = new Map<string, number>()

  for (const row of rows) {
    const currentCount = sessionCountByCampId.get(row.camp_id) ?? 0
    sessionCountByCampId.set(row.camp_id, currentCount + 1)
  }

  return sessionCountByCampId
}

export async function getTeamCampsChromeData(input: {
  activeTeamId: string
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  page?: number
  accumulatePages?: boolean
}): Promise<TeamCampsChromeData> {
  const filtersStartedAt = startTeamCampsListTiming()
  const supabase = await createServerSupabaseClient()
  const requestedPage = normalizePage(input.page ?? 1)
  const accumulatePages = input.accumulatePages === true

  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false })

  if (teamVenueError) {
    logTeamCampsListTiming({
      phase: "filters",
      startedAt: filtersStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: teamVenueError.message,
    })
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
      logTeamCampsListTiming({
        phase: "filters",
        startedAt: filtersStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: venueError.message,
        metadata: {
          teamVenueCount: teamVenueRows.length,
          venueIdCount: venueIds.length,
        },
      })
      throw new Error(`Could not load venues for camps: ${venueError.message}`)
    }

    venueRows = data ?? []
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))

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

  const selectedVenueId = normalizeSelectedId({
    selectedId: input.selectedVenueId,
    allowedIds: new Set(venueFilterOptions.map((row) => row.venueId)),
  })

  logTeamCampsListTiming({
    phase: "filters",
    startedAt: filtersStartedAt,
    activeTeamId: input.activeTeamId,
    status: "success",
    metadata: {
      teamVenueCount: teamVenueRows.length,
      venueCount: venueRows.length,
      venueFilterCount: venueFilterOptions.length,
      requestedPage,
      accumulatePages,
      selectedVenue: Boolean(selectedVenueId),
      selectedCampType: input.selectedCampType ?? null,
      selectedCampStatus: input.selectedCampStatus ?? null,
    },
  })

  return {
    teamVenueOptions,
    venueFilterOptions,
    selectedVenueId,
    selectedCampType: input.selectedCampType,
    selectedCampStatus: input.selectedCampStatus,
  }
}

export async function getTeamCampsResultsData(input: {
  activeTeamId: string
  chromeData: TeamCampsChromeData
  includeSessionCounts?: boolean
  page: number
  accumulatePages?: boolean
}): Promise<TeamCampsResultsData> {
  const campsStartedAt = startTeamCampsListTiming()
  const supabase = await createServerSupabaseClient()
  const requestedPage = normalizePage(input.page)
  const accumulatePages = input.accumulatePages === true
  const selectedVenueId = input.chromeData.selectedVenueId
  const selectedCampType = input.chromeData.selectedCampType
  const selectedCampStatus = input.chromeData.selectedCampStatus
  const teamVenueById = new Map(
    input.chromeData.teamVenueOptions.map((row) => [row.teamVenueId, row]),
  )
  const filteredTeamVenueRows = selectedVenueId
    ? input.chromeData.teamVenueOptions.filter(
        (row) => row.venueId === selectedVenueId,
      )
    : input.chromeData.teamVenueOptions

  const filteredTeamVenueIds = filteredTeamVenueRows.map((row) => row.teamVenueId)

  if (filteredTeamVenueIds.length === 0) {
    const pagination = resolveCampPagination({
      requestedPage,
      totalItems: 0,
      accumulatePages,
      pageSize: TEAM_CAMPS_PAGE_SIZE,
    })
    logTeamCampsListTiming({
      phase: "camps",
      startedAt: campsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        reason:
          input.chromeData.teamVenueOptions.length === 0
            ? "no_team_venues"
            : "no_filtered_team_venues",
        requestedPage,
        accumulatePages,
        filteredTeamVenueCount: 0,
        totalItems: 0,
        returnedItems: 0,
        currentPage: pagination.currentPage,
        pageCount: pagination.pageCount,
        selectedVenue: Boolean(selectedVenueId),
        selectedCampType: selectedCampType ?? null,
        selectedCampStatus: selectedCampStatus ?? null,
      },
    })

    return {
      camps: [],
      currentPage: pagination.currentPage,
      pageCount: pagination.pageCount,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: false,
      sessionCountsStatus: "fresh",
    }
  }

  let campCountQuery = supabase
    .from("camps")
    .select("id", { count: "exact", head: true })
    .in("team_venue_id", filteredTeamVenueIds)

  if (selectedCampType) {
    campCountQuery = campCountQuery.eq("camp_type", selectedCampType)
  }

  if (selectedCampStatus === "active") {
    campCountQuery = campCountQuery.eq("is_active", true)
  }

  if (selectedCampStatus === "inactive") {
    campCountQuery = campCountQuery.eq("is_active", false)
  }

  const { count: campCount, error: campCountError } = await campCountQuery

  if (campCountError) {
    logTeamCampsListTiming({
      phase: "camps",
      startedAt: campsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: campCountError.message,
      metadata: {
        requestedPage,
        accumulatePages,
        filteredTeamVenueCount: filteredTeamVenueIds.length,
        operation: "count",
        selectedVenue: Boolean(selectedVenueId),
        selectedCampType: selectedCampType ?? null,
        selectedCampStatus: selectedCampStatus ?? null,
      },
    })
    throw new Error(`Could not count camps: ${campCountError.message}`)
  }

  const pagination = resolveCampPagination({
    requestedPage,
    totalItems: campCount ?? 0,
    accumulatePages,
    pageSize: TEAM_CAMPS_PAGE_SIZE,
  })
  const { currentPage, pageCount, hasPreviousPage, hasNextPage } = pagination

  if ((campCount ?? 0) === 0) {
    logTeamCampsListTiming({
      phase: "camps",
      startedAt: campsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        requestedPage,
        accumulatePages,
        filteredTeamVenueCount: filteredTeamVenueIds.length,
        totalItems: 0,
        returnedItems: 0,
        currentPage,
        pageCount,
        selectedVenue: Boolean(selectedVenueId),
        selectedCampType: selectedCampType ?? null,
        selectedCampStatus: selectedCampStatus ?? null,
      },
    })

    return {
      camps: [],
      currentPage,
      pageCount,
      hasPreviousPage,
      hasNextPage,
      sessionCountsStatus: "fresh",
    }
  }

  const visibleCount = accumulatePages
    ? currentPage * TEAM_CAMPS_PAGE_SIZE
    : TEAM_CAMPS_PAGE_SIZE
  const rangeStart = accumulatePages ? 0 : (currentPage - 1) * TEAM_CAMPS_PAGE_SIZE
  const rangeEnd = rangeStart + visibleCount - 1

  let campQuery = supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("team_venue_id", filteredTeamVenueIds)
    .order("is_active", { ascending: false })
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (selectedCampType) {
    campQuery = campQuery.eq("camp_type", selectedCampType)
  }

  if (selectedCampStatus === "active") {
    campQuery = campQuery.eq("is_active", true)
  }

  if (selectedCampStatus === "inactive") {
    campQuery = campQuery.eq("is_active", false)
  }

  const { data: campData, error: campError } = await campQuery.range(
    rangeStart,
    rangeEnd,
  )

  if (campError) {
    logTeamCampsListTiming({
      phase: "camps",
      startedAt: campsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: campError.message,
      metadata: {
        requestedPage,
        accumulatePages,
        filteredTeamVenueCount: filteredTeamVenueIds.length,
        totalItems: campCount ?? 0,
        operation: "page",
        rangeStart,
        rangeEnd,
        selectedVenue: Boolean(selectedVenueId),
        selectedCampType: selectedCampType ?? null,
        selectedCampStatus: selectedCampStatus ?? null,
      },
    })
    throw new Error(`Could not load camps: ${campError.message}`)
  }

  const visibleCampRows: CampRow[] = campData ?? []
  const visibleCampIds = visibleCampRows.map((row) => row.id)
  const includeSessionCounts = input.includeSessionCounts !== false

  let sessionCountRows: SessionCampCountRow[] = []

  if (includeSessionCounts && visibleCampIds.length > 0) {
    const sessionCountsStartedAt = startTeamCampsListTiming()
    const { data, error: sessionCountError } = await supabase
      .from("sessions")
      .select(SESSION_COUNT_SELECT_COLUMNS)
      .in("camp_id", visibleCampIds)

    if (sessionCountError) {
      logTeamCampsListTiming({
        phase: "session_counts",
        startedAt: sessionCountsStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: sessionCountError.message,
        metadata: {
          campCount: visibleCampIds.length,
        },
      })
      throw new Error(`Could not load camp session counts: ${sessionCountError.message}`)
    }

    sessionCountRows = data ?? []
    logTeamCampsListTiming({
      phase: "session_counts",
      startedAt: sessionCountsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        campCount: visibleCampIds.length,
        sessionCountRows: sessionCountRows.length,
      },
    })
  }

  const sessionCountByCampId = buildSessionCountByCampId(sessionCountRows)

  const camps: TeamCampListItem[] = visibleCampRows
    .map((camp) => {
      const teamVenue = teamVenueById.get(camp.team_venue_id)

      if (!teamVenue) {
        return null
      }

      return {
        id: camp.id,
        teamVenueId: camp.team_venue_id,
        venueId: teamVenue.venueId,
        venueName: teamVenue.venueName,
        venueLocation: teamVenue.venueLocation,
        name: camp.name,
        campType: camp.camp_type,
        startDate: camp.start_date,
        endDate: camp.end_date,
        isActive: camp.is_active,
        sessionCount: includeSessionCounts
          ? sessionCountByCampId.get(camp.id) ?? 0
          : null,
      }
    })
    .filter((row): row is TeamCampListItem => row !== null)

  logTeamCampsListTiming({
    phase: "camps",
    startedAt: campsStartedAt,
    activeTeamId: input.activeTeamId,
    status: "success",
    metadata: {
      requestedPage,
      accumulatePages,
      filteredTeamVenueCount: filteredTeamVenueIds.length,
      totalItems: campCount ?? 0,
      returnedItems: camps.length,
      currentPage,
      pageCount,
      visibleCount,
      rangeStart,
      rangeEnd,
      selectedVenue: Boolean(selectedVenueId),
      selectedCampType: selectedCampType ?? null,
      selectedCampStatus: selectedCampStatus ?? null,
    },
  })

  return {
    camps,
    currentPage,
    pageCount,
    hasPreviousPage,
    hasNextPage,
    sessionCountsStatus: includeSessionCounts ? "fresh" : "pending",
  }
}

export async function getTeamCampsPageData(input: {
  activeTeamId: string
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  page: number
  accumulatePages?: boolean
}): Promise<TeamCampsPageData> {
  const chromeData = await getTeamCampsChromeData(input)
  const resultsData = await getTeamCampsResultsData({
    activeTeamId: input.activeTeamId,
    chromeData,
    page: input.page,
    accumulatePages: input.accumulatePages,
  })

  return {
    ...chromeData,
    ...resultsData,
  }
}
