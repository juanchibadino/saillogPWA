import "server-only"

import {
  resolveTeamWindPatternsPagination,
} from "@/features/wind-patterns/list-route-state.mjs"
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
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country,is_active"

export const TEAM_WIND_PATTERNS_PAGE_SIZE = 25

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country" | "is_active"
>

export type TeamVenueWindPatternListItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  usageCount: number
  updatedAt: string
}

export type TeamWindPatternVenueOption = {
  teamVenueId: string
  venueId: string
  venueName: string
  city: string
  country: string
  isActive: boolean
}

export type TeamWindPatternListItem = TeamVenueWindPatternListItem & {
  teamVenueId: string
  venueId: string
  venueName: string
}

export type TeamWindPatternStatusFilter = "active" | "archived" | "all"

export type TeamWindPatternStatusCounts = {
  active: number
  archived: number
}

export type TeamWindPatternsChromeData = {
  selectedStatusFilter: TeamWindPatternStatusFilter
  statusCounts: TeamWindPatternStatusCounts
  venueOptions: TeamWindPatternVenueOption[]
}

export type TeamWindPatternsResultsData = {
  patterns: TeamWindPatternListItem[]
  totalCount: number
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type TeamWindPatternsPageData =
  TeamWindPatternsChromeData &
  TeamWindPatternsResultsData

export type TeamVenueWindPatternsPageData = {
  patterns: TeamVenueWindPatternListItem[]
  activeCount: number
  archivedCount: number
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function applyStatusFilter<QueryBuilder>(
  query: QueryBuilder,
  statusFilter: TeamWindPatternStatusFilter,
): QueryBuilder {
  if (
    statusFilter === "active" &&
    typeof (query as { eq?: unknown }).eq === "function"
  ) {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      true,
    )
  }

  if (
    statusFilter === "archived" &&
    typeof (query as { eq?: unknown }).eq === "function"
  ) {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      false,
    )
  }

  return query
}

async function loadTeamVenueOptions(input: {
  activeOrganizationId: string
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<TeamWindPatternVenueOption[]> {
  const { data: teamVenueRows, error: teamVenueError } = await input.supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false })

  if (teamVenueError) {
    throw new Error(`Could not load team venues for wind patterns: ${teamVenueError.message}`)
  }

  const teamVenues = (teamVenueRows ?? []) as TeamVenueRow[]
  const venueIds = [...new Set(teamVenues.map((teamVenue) => teamVenue.venue_id))]

  if (venueIds.length === 0) {
    return []
  }

  const { data: venueRows, error: venueError } = await input.supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("organization_id", input.activeOrganizationId)
    .in("id", venueIds)
    .order("name", { ascending: true })

  if (venueError) {
    throw new Error(`Could not load venues for wind patterns: ${venueError.message}`)
  }

  const venueById = new Map(
    ((venueRows ?? []) as VenueRow[]).map((venue) => [venue.id, venue]),
  )

  return teamVenues
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        teamVenueId: teamVenue.id,
        venueId: venue.id,
        venueName: venue.name,
        city: venue.city,
        country: venue.country,
        isActive: venue.is_active,
      }
    })
    .filter((option): option is TeamWindPatternVenueOption => option !== null)
    .sort((a, b) => a.venueName.localeCompare(b.venueName))
}

async function countTeamWindPatterns(input: {
  teamVenueIds: string[]
  isActive?: boolean
  supabase: ServerSupabaseClient
}): Promise<number> {
  if (input.teamVenueIds.length === 0) {
    return 0
  }

  let query = input.supabase
    .from("team_venue_wind_patterns")
    .select("id", { count: "exact", head: true })
    .in("team_venue_id", input.teamVenueIds)

  if (typeof input.isActive === "boolean") {
    query = query.eq("is_active", input.isActive)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Could not count team wind patterns: ${error.message}`)
  }

  return count ?? 0
}

async function buildUsageCountByPatternId(input: {
  windPatternIds: string[]
  supabase: ServerSupabaseClient
}): Promise<Map<string, number>> {
  if (input.windPatternIds.length === 0) {
    return new Map()
  }

  const usageCountEntries = await Promise.all(
    input.windPatternIds.map(async (windPatternId) => {
      const { count, error } = await input.supabase
        .from("session_wind_patterns")
        .select(SESSION_WIND_PATTERN_SELECT_COLUMNS, {
          count: "exact",
          head: true,
        })
        .eq("team_venue_wind_pattern_id", windPatternId)

      if (error) {
        throw new Error(
          `Could not count session wind pattern usage: ${error.message}`,
        )
      }

      return [windPatternId, count ?? 0] as const
    }),
  )

  return new Map(usageCountEntries)
}

export async function getTeamWindPatternsChromeData(input: {
  activeOrganizationId: string
  activeTeamId: string
  statusFilter: TeamWindPatternStatusFilter
  page?: number
  accumulatePages?: boolean
}): Promise<TeamWindPatternsChromeData> {
  const supabase = await createServerSupabaseClient()
  const venueOptions = await loadTeamVenueOptions({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    supabase,
  })
  const teamVenueIds = venueOptions.map((venueOption) => venueOption.teamVenueId)
  const [activeCount, archivedCount] = await Promise.all([
    countTeamWindPatterns({
      teamVenueIds,
      isActive: true,
      supabase,
    }),
    countTeamWindPatterns({
      teamVenueIds,
      isActive: false,
      supabase,
    }),
  ])

  return {
    selectedStatusFilter: input.statusFilter,
    statusCounts: {
      active: activeCount,
      archived: archivedCount,
    },
    venueOptions,
  }
}

export async function getTeamWindPatternsResultsData(input: {
  activeTeamId: string
  chromeData: TeamWindPatternsChromeData
  page: number
  accumulatePages?: boolean
  statusFilter?: TeamWindPatternStatusFilter
}): Promise<TeamWindPatternsResultsData> {
  const supabase = await createServerSupabaseClient()
  const requestedPage = normalizePage(input.page)
  const accumulatePages = input.accumulatePages === true
  const statusFilter = input.statusFilter ?? input.chromeData.selectedStatusFilter
  const teamVenueIds = input.chromeData.venueOptions.map((venueOption) => venueOption.teamVenueId)
  const venueOptionByTeamVenueId = new Map(
    input.chromeData.venueOptions.map((venueOption) => [
      venueOption.teamVenueId,
      venueOption,
    ]),
  )

  if (teamVenueIds.length === 0) {
    return {
      patterns: [],
      totalCount: 0,
      currentPage: requestedPage,
      pageCount: 1,
      hasPreviousPage: requestedPage > 1,
      hasNextPage: false,
    }
  }

  let countQuery = supabase
    .from("team_venue_wind_patterns")
    .select("id", { count: "exact", head: true })
    .in("team_venue_id", teamVenueIds)

  countQuery = applyStatusFilter(countQuery, statusFilter)

  const { count: windPatternCount, error: countError } = await countQuery

  if (countError) {
    throw new Error(`Could not count team wind patterns: ${countError.message}`)
  }

  const pagination = resolveTeamWindPatternsPagination({
    requestedPage,
    totalItems: windPatternCount ?? 0,
    accumulatePages,
    pageSize: TEAM_WIND_PATTERNS_PAGE_SIZE,
  })
  const { currentPage, pageCount, hasPreviousPage, hasNextPage } = pagination

  if ((windPatternCount ?? 0) === 0) {
    return {
      patterns: [],
      totalCount: 0,
      currentPage,
      pageCount,
      hasPreviousPage,
      hasNextPage,
    }
  }

  const visibleCount = accumulatePages
    ? currentPage * TEAM_WIND_PATTERNS_PAGE_SIZE
    : TEAM_WIND_PATTERNS_PAGE_SIZE
  const rangeStart = accumulatePages
    ? 0
    : (currentPage - 1) * TEAM_WIND_PATTERNS_PAGE_SIZE
  const rangeEnd = rangeStart + visibleCount - 1

  let windPatternsQuery = supabase
    .from("team_venue_wind_patterns")
    .select(TEAM_VENUE_WIND_PATTERN_SELECT_COLUMNS)
    .in("team_venue_id", teamVenueIds)
    .order("updated_at", { ascending: false })

  windPatternsQuery = applyStatusFilter(windPatternsQuery, statusFilter)

  const { data: windPatternRows, error: windPatternsError } =
    await windPatternsQuery.range(rangeStart, rangeEnd)

  if (windPatternsError) {
    throw new Error(`Could not load team wind patterns: ${windPatternsError.message}`)
  }

  const visibleWindPatterns = (windPatternRows ?? []) as TeamVenueWindPatternRow[]
  const windPatternIds = visibleWindPatterns.map((windPattern) => windPattern.id)
  const usageCountByPatternId = await buildUsageCountByPatternId({
    windPatternIds,
    supabase,
  })

  const mappedPatterns: TeamWindPatternListItem[] = visibleWindPatterns
    .map((windPattern) => {
      const venueOption = venueOptionByTeamVenueId.get(windPattern.team_venue_id)

      if (!venueOption) {
        return null
      }

      return {
        id: windPattern.id,
        name: windPattern.name,
        description: windPattern.description,
        isActive: windPattern.is_active,
        usageCount: usageCountByPatternId.get(windPattern.id) ?? 0,
        updatedAt: windPattern.updated_at,
        teamVenueId: windPattern.team_venue_id,
        venueId: venueOption.venueId,
        venueName: venueOption.venueName,
      }
    })
    .filter((pattern): pattern is TeamWindPatternListItem => pattern !== null)

  return {
    patterns: mappedPatterns,
    totalCount: windPatternCount ?? 0,
    currentPage,
    pageCount,
    hasPreviousPage,
    hasNextPage,
  }
}

export async function getTeamWindPatternsPageData(input: {
  activeOrganizationId: string
  activeTeamId: string
  statusFilter?: TeamWindPatternStatusFilter
  page?: number
  accumulatePages?: boolean
}): Promise<TeamWindPatternsPageData> {
  const statusFilter = input.statusFilter ?? "active"
  const chromeData = await getTeamWindPatternsChromeData({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    statusFilter,
    page: input.page,
    accumulatePages: input.accumulatePages,
  })
  const resultsData = await getTeamWindPatternsResultsData({
    activeTeamId: input.activeTeamId,
    chromeData,
    page: input.page ?? 1,
    accumulatePages: input.accumulatePages,
    statusFilter,
  })

  return {
    ...chromeData,
    ...resultsData,
  }
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
