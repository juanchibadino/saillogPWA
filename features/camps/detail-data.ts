import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/types/database"
import type {
  CampDetailChromeData,
  CampDetailCamp,
  CampDetailGoalsTabData,
  CampDetailKpi,
  CampDetailNotesCard,
  CampDetailNotesTabData,
  CampDetailSessionsTabData,
  CampDetailShellData,
  CampDetailTeamVenue,
  CampDetailTab,
  CampDetailTabPayload,
} from "@/features/camps/detail-types"
import {
  getTeamSessionsPageData,
  type TeamSessionHighlightFilter,
} from "@/features/sessions/data"
import {
  getCampDetailTimingErrorMessage,
  logCampDetailTiming,
  startCampDetailTiming,
} from "@/features/camps/detail-timing"

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "camp_type" | "start_date" | "end_date" | "is_active"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "organization_id" | "name" | "city" | "country"
>

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  | "id"
  | "camp_id"
  | "session_type"
  | "session_date"
  | "net_time_minutes"
  | "highlighted_by_coach"
  | "created_at"
>

type SessionSetupRow = Pick<
  Database["public"]["Tables"]["session_setups"]["Row"],
  "session_id" | "free_notes"
>

type SessionReviewRow = Pick<
  Database["public"]["Tables"]["session_reviews"]["Row"],
  "session_id" | "best_of_session" | "to_work" | "wind_patterns"
>

type SessionStandardMoveRow = Pick<
  Database["public"]["Tables"]["session_standard_moves"]["Row"],
  "session_id" | "team_standard_move_id"
>

type SessionWindPatternRow = Pick<
  Database["public"]["Tables"]["session_wind_patterns"]["Row"],
  "session_id" | "team_venue_wind_pattern_id"
>

type CampKpiSessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "net_time_minutes"
>

type TeamStandardMoveRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "name"
>

type TeamVenueWindPatternRow = Pick<
  Database["public"]["Tables"]["team_venue_wind_patterns"]["Row"],
  "id" | "name"
>

const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,camp_type,start_date,end_date,is_active"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,organization_id,name,city,country"
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"
const SESSION_REVIEW_SELECT_COLUMNS =
  "session_id,best_of_session,to_work,wind_patterns"
const SESSION_STANDARD_MOVE_SELECT_COLUMNS = "session_id,team_standard_move_id"
const SESSION_WIND_PATTERN_SELECT_COLUMNS = "session_id,team_venue_wind_pattern_id"
const TEAM_STANDARD_MOVE_SELECT_COLUMNS = "id,name"
const TEAM_VENUE_WIND_PATTERN_SELECT_COLUMNS = "id,name"

const CAMP_NOTES_SESSION_PAGE_SIZE = 10

type CampDetailTimingMetadata = Record<
  string,
  string | number | boolean | null | undefined
>

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateRangeEndpoint(value: string): {
  day: string
  month: string
  year: string
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const parts = formatter.formatToParts(new Date(`${value}T00:00:00.000Z`))
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  const year = parts.find((part) => part.type === "year")?.value ?? ""

  return { day, month, year }
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDateRangeEndpoint(startDate)
  const end = formatDateRangeEndpoint(endDate)

  if (start.year === end.year) {
    return `${start.month} ${start.day} - ${end.month} ${end.day} ${end.year}`
  }

  return `${start.month} ${start.day} ${start.year} - ${end.month} ${end.day} ${end.year}`
}

function formatHoursAndMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

function formatTotalNetTime(minutes: number): string {
  if (minutes <= 0) {
    return "00h 00m"
  }

  const totalDays = Math.floor(minutes / (24 * 60))
  const remainingMinutesAfterDays = minutes - totalDays * 24 * 60
  const hours = Math.floor(remainingMinutesAfterDays / 60)
  const restMinutes = remainingMinutesAfterDays % 60

  if (totalDays > 0) {
    return `${totalDays}d ${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
  }

  return `${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
}

function titleCaseSessionType(value: SessionRow["session_type"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function formatJsonNote(value: Json | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string") {
    return normalizeText(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatJsonNote(item))
      .filter((item): item is string => item !== null)

    if (items.length === 0) {
      return null
    }

    return items.join(", ")
  }

  const objectEntries = Object.entries(value)
    .map(([key, nestedValue]) => {
      const nestedText = formatJsonNote(nestedValue)

      if (!nestedText) {
        return null
      }

      return `${key}: ${nestedText}`
    })
    .filter((item): item is string => item !== null)

  if (objectEntries.length === 0) {
    return null
  }

  return objectEntries.join(" | ")
}

function buildKpis(input: {
  camp: CampDetailCamp
  netTimeMinutes: number[]
  totalSessions: number
}): CampDetailKpi[] {
  const totalNetTimeMinutes = input.netTimeMinutes.reduce(
    (sum, minutes) => sum + minutes,
    0,
  )
  const averageNetTimeMinutes =
    input.netTimeMinutes.length > 0
      ? Math.round(totalNetTimeMinutes / input.netTimeMinutes.length)
      : null

  return [
    {
      label: "Total Sessions",
      value: String(input.totalSessions),
      note: "Current camp",
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(averageNetTimeMinutes),
      note:
        input.netTimeMinutes.length > 0
          ? `${input.netTimeMinutes.length} sessions with net time`
          : "No net time recorded",
    },
    {
      label: "Net Time Sailed",
      value: formatTotalNetTime(totalNetTimeMinutes),
      note: "Sum of net time in camp sessions",
    },
    {
      label: "Camp Dates",
      value: formatDateRange(input.camp.startDate, input.camp.endDate),
      note: "Camp schedule window",
    },
  ]
}

function buildNotesCards(input: {
  sessions: SessionRow[]
  setupBySessionId: Map<string, SessionSetupRow>
  reviewBySessionId: Map<string, SessionReviewRow>
  standardMoveNamesBySessionId: Map<string, string[]>
  windPatternNamesBySessionId: Map<string, string[]>
}): CampDetailNotesCard[] {
  const notesCards: CampDetailNotesCard[] = []

  for (const session of input.sessions) {
    const setup = input.setupBySessionId.get(session.id)
    const review = input.reviewBySessionId.get(session.id)

    const freeNotes = normalizeText(setup?.free_notes)
    const best = normalizeText(review?.best_of_session)
    const toWork = normalizeText(review?.to_work)
    const standardMoveNames = input.standardMoveNamesBySessionId.get(session.id) ?? []
    const standardMoves =
      standardMoveNames.length > 0 ? normalizeText(standardMoveNames.join(", ")) : null
    const windPatternNames = input.windPatternNamesBySessionId.get(session.id) ?? []
    const windPattern =
      windPatternNames.length > 0
        ? normalizeText(windPatternNames.join(", "))
        : formatJsonNote(review?.wind_patterns)

    if (!freeNotes && !best && !toWork && !standardMoves && !windPattern) {
      continue
    }

    notesCards.push({
      sessionId: session.id,
      sessionDateLabel: formatDateLabel(session.session_date),
      sessionTypeLabel: titleCaseSessionType(session.session_type),
      freeNotes,
      best,
      toWork,
      standardMoves,
      windPattern,
    })
  }

  return notesCards
}

function buildLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function normalizeNotesSessionOffset(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.floor(value)
}

function getCampDetailTabRequestTimingMetadata(input: {
  accumulatePages?: boolean
  notesSessionOffset?: number
  page: number
  selectedHighlight?: TeamSessionHighlightFilter
  tab: CampDetailTab
}): CampDetailTimingMetadata {
  return {
    accumulatePages: Boolean(input.accumulatePages),
    notesSessionOffset:
      input.tab === "notes"
        ? normalizeNotesSessionOffset(input.notesSessionOffset)
        : undefined,
    requestedPage: input.page,
    selectedHighlight: input.selectedHighlight ?? null,
    tab: input.tab,
  }
}

function getCampDetailTabResponseTimingMetadata(input: {
  accumulatePages?: boolean
  data: CampDetailTabPayload
  notesSessionOffset?: number
  page: number
  selectedHighlight?: TeamSessionHighlightFilter
  tab: CampDetailTab
}): CampDetailTimingMetadata {
  const baseMetadata = getCampDetailTabRequestTimingMetadata(input)

  if (input.tab === "sessions") {
    const data = input.data as CampDetailSessionsTabData

    return {
      ...baseMetadata,
      currentPage: data.currentPage,
      hasNextPage: data.hasNextPage,
      hasPreviousPage: data.hasPreviousPage,
      pageCount: data.pageCount,
      sessionCount: data.sessions.length,
    }
  }

  if (input.tab === "goals") {
    const data = input.data as CampDetailGoalsTabData
    const hasGoals =
      typeof data.goals === "string" && data.goals.trim().length > 0

    return {
      ...baseMetadata,
      hasGoals,
    }
  }

  const data = input.data as CampDetailNotesTabData

  return {
    ...baseMetadata,
    nextSessionOffset: data.nextSessionOffset,
    noteCardCount: data.notesCards.length,
    sessionLimit: data.sessionLimit,
    sessionOffset: data.sessionOffset,
    sessionTotalCount: data.sessionTotalCount,
  }
}

export async function getCampDetailChromeData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  campId: string
}): Promise<CampDetailChromeData | null> {
  const startedAt = startCampDetailTiming()
  const logChromeTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logCampDetailTiming({
      route: "/team-camps/[id]",
      phase: "load_chrome",
      startedAt,
      campId: input.campId,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        activeOrganizationId: input.activeOrganizationId,
        ...metadata,
      },
    })
  }
  const throwChromeTimingError = (outcome: string, message: string): never => {
    logChromeTiming("error", outcome, message)
    throw new Error(message)
  }

  if (!input.activeTeamId) {
    logChromeTiming("success", "missing_active_team")
    return null
  }

  const supabase = await createServerSupabaseClient()

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("id", input.campId)
    .maybeSingle()

  if (campError) {
    throwChromeTimingError(
      "camp_query_error",
      `Could not load camp detail: ${campError.message}`,
    )
  }

  if (!campRow) {
    logChromeTiming("success", "camp_not_found")
    return null
  }

  const camp: CampRow = campRow

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", camp.team_venue_id)
    .maybeSingle()

  if (teamVenueError) {
    throwChromeTimingError(
      "team_venue_query_error",
      `Could not load camp team venue: ${teamVenueError.message}`,
    )
  }

  if (!teamVenueRow || teamVenueRow.team_id !== input.activeTeamId) {
    logChromeTiming("success", "team_venue_not_found")
    return null
  }

  const teamVenue: CampDetailTeamVenue = teamVenueRow

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", teamVenue.venue_id)
    .eq("organization_id", input.activeOrganizationId)
    .maybeSingle()

  if (venueError) {
    throwChromeTimingError(
      "venue_query_error",
      `Could not load venue for camp detail: ${venueError.message}`,
    )
  }

  if (!venueRow) {
    logChromeTiming("success", "venue_not_found")
    return null
  }

  const venue: VenueRow = venueRow
  const detailCamp: CampDetailCamp = {
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
  }

  logChromeTiming("success", "loaded", undefined, {
    teamVenueId: teamVenue.id,
    venueId: venue.id,
  })

  return {
    camp: detailCamp,
    teamVenue,
  }
}

export async function getCampDetailKpisData(input: {
  activeTeamId: string | null
  camp: CampDetailCamp
}): Promise<CampDetailKpi[]> {
  const startedAt = startCampDetailTiming()
  const logKpiTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logCampDetailTiming({
      route: "/team-camps/[id]",
      phase: "load_kpis",
      startedAt,
      campId: input.camp.id,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        ...metadata,
      },
    })
  }
  const throwKpiTimingError = (outcome: string, message: string): never => {
    logKpiTiming("error", outcome, message)
    throw new Error(message)
  }
  const supabase = await createServerSupabaseClient()
  const {
    count: sessionCount,
    data: kpiSessionRows,
    error: kpiSessionsError,
  } = await supabase
    .from("sessions")
    .select("net_time_minutes", { count: "exact" })
    .eq("camp_id", input.camp.id)

  if (kpiSessionsError) {
    throwKpiTimingError(
      "kpi_sessions_query_error",
      `Could not load camp KPI session metrics: ${kpiSessionsError.message}`,
    )
  }

  const netTimeMinutes = ((kpiSessionRows ?? []) as CampKpiSessionRow[])
    .map((row) => row.net_time_minutes)
    .filter((minutes): minutes is number => typeof minutes === "number")

  const kpis = buildKpis({
    camp: input.camp,
    netTimeMinutes,
    totalSessions: sessionCount ?? kpiSessionRows?.length ?? 0,
  })

  logKpiTiming("success", "loaded", undefined, {
    netTimeSessionCount: netTimeMinutes.length,
    sessionCount: sessionCount ?? kpiSessionRows?.length ?? 0,
  })

  return kpis
}

export async function getCampDetailShellData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  campId: string
}): Promise<CampDetailShellData | null> {
  const chromeData = await getCampDetailChromeData(input)

  if (!chromeData) {
    return null
  }

  const kpis = await getCampDetailKpisData({
    activeTeamId: input.activeTeamId,
    camp: chromeData.camp,
  })

  return {
    ...chromeData,
    kpis,
  }
}

export async function getCampDetailSessionsTabData(input: {
  activeTeamId: string
  accumulatePages?: boolean
  camp: CampDetailCamp
  page: number
  selectedHighlight?: TeamSessionHighlightFilter
}): Promise<CampDetailSessionsTabData> {
  const sessionsData = await getTeamSessionsPageData({
    activeTeamId: input.activeTeamId,
    accumulatePages: input.accumulatePages,
    page: input.page,
    selectedCampId: input.camp.id,
    selectedHighlight: input.selectedHighlight,
    selectedVenueId: input.camp.venueId,
  })

  return {
    campOptions: sessionsData.campOptions,
    currentPage: sessionsData.currentPage,
    hasNextPage: sessionsData.hasNextPage,
    hasPreviousPage: sessionsData.hasPreviousPage,
    pageCount: sessionsData.pageCount,
    selectedHighlight: sessionsData.selectedHighlight,
    sessions: sessionsData.sessions,
  }
}

export async function getCampDetailGoalsTabData(input: {
  campId: string
}): Promise<CampDetailGoalsTabData> {
  const supabase = await createServerSupabaseClient()

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("notes")
    .eq("id", input.campId)
    .maybeSingle()

  if (campError) {
    throw new Error(`Could not load camp goals: ${campError.message}`)
  }

  return {
    goals: campRow?.notes ?? null,
  }
}

export async function getCampDetailNotesTabData(input: {
  camp: CampDetailCamp
  sessionOffset?: number
  teamVenue: CampDetailTeamVenue
}): Promise<CampDetailNotesTabData> {
  const startedAt = startCampDetailTiming()
  const supabase = await createServerSupabaseClient()
  const sessionOffset = normalizeNotesSessionOffset(input.sessionOffset)
  const logNotesTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logCampDetailTiming({
      route: "/team-camps/[id]",
      phase: "load_notes",
      startedAt,
      campId: input.camp.id,
      activeTeamId: input.teamVenue.team_id,
      status,
      error,
      metadata: {
        outcome,
        sessionLimit: CAMP_NOTES_SESSION_PAGE_SIZE,
        sessionOffset,
        teamVenueId: input.teamVenue.id,
        ...metadata,
      },
    })
  }
  const throwNotesTimingError = (outcome: string, message: string): never => {
    logNotesTiming("error", outcome, message)
    throw new Error(message)
  }

  const {
    count: sessionTotalCount,
    data: sessionRows,
    error: sessionsError,
  } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS, { count: "exact" })
    .eq("camp_id", input.camp.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(sessionOffset, sessionOffset + CAMP_NOTES_SESSION_PAGE_SIZE - 1)

  if (sessionsError) {
    throwNotesTimingError(
      "sessions_query_error",
      `Could not load camp sessions for notes: ${sessionsError.message}`,
    )
  }

  const sessions: SessionRow[] = sessionRows ?? []
  const sessionIds = sessions.map((session) => session.id)

  let setupRows: SessionSetupRow[] = []
  let reviewRows: SessionReviewRow[] = []
  let sessionStandardMoveRows: SessionStandardMoveRow[] = []
  let sessionWindPatternRows: SessionWindPatternRow[] = []
  let teamStandardMoves: TeamStandardMoveRow[] = []
  let teamVenueWindPatterns: TeamVenueWindPatternRow[] = []

  if (sessionIds.length > 0) {
    const [
      { data: setupData, error: setupError },
      { data: reviewData, error: reviewError },
      { data: sessionStandardMoveData, error: sessionStandardMoveError },
      { data: sessionWindPatternData, error: sessionWindPatternError },
    ] = await Promise.all([
      supabase
        .from("session_setups")
        .select(SESSION_SETUP_SELECT_COLUMNS)
        .in("session_id", sessionIds),
      supabase
        .from("session_reviews")
        .select(SESSION_REVIEW_SELECT_COLUMNS)
        .in("session_id", sessionIds),
      supabase
        .from("session_standard_moves")
        .select(SESSION_STANDARD_MOVE_SELECT_COLUMNS)
        .in("session_id", sessionIds),
      supabase
        .from("session_wind_patterns")
        .select(SESSION_WIND_PATTERN_SELECT_COLUMNS)
        .in("session_id", sessionIds),
    ])

    if (setupError) {
      throwNotesTimingError(
        "setups_query_error",
        `Could not load session setups for camp detail: ${setupError.message}`,
      )
    }

    if (reviewError) {
      throwNotesTimingError(
        "reviews_query_error",
        `Could not load session reviews for camp detail: ${reviewError.message}`,
      )
    }

    if (sessionStandardMoveError) {
      throwNotesTimingError(
        "standard_moves_query_error",
        `Could not load session standard moves for camp detail: ${sessionStandardMoveError.message}`,
      )
    }

    if (sessionWindPatternError) {
      throwNotesTimingError(
        "wind_patterns_query_error",
        `Could not load session wind patterns for camp detail: ${sessionWindPatternError.message}`,
      )
    }

    setupRows = setupData ?? []
    reviewRows = reviewData ?? []
    sessionStandardMoveRows = sessionStandardMoveData ?? []
    sessionWindPatternRows = sessionWindPatternData ?? []

    const standardMoveIds = [...new Set(sessionStandardMoveRows.map((row) => row.team_standard_move_id))]
    const windPatternIds = [
      ...new Set(sessionWindPatternRows.map((row) => row.team_venue_wind_pattern_id)),
    ]

    if (standardMoveIds.length > 0) {
      const { data: teamStandardMoveData, error: teamStandardMoveError } = await supabase
        .from("team_standard_moves")
        .select(TEAM_STANDARD_MOVE_SELECT_COLUMNS)
        .in("id", standardMoveIds)
        .eq("team_id", input.teamVenue.team_id)

      if (teamStandardMoveError) {
        throwNotesTimingError(
          "standard_move_names_query_error",
          `Could not load team standard moves for camp detail: ${teamStandardMoveError.message}`,
        )
      }

      teamStandardMoves = teamStandardMoveData ?? []
    }

    if (windPatternIds.length > 0) {
      const { data: teamVenueWindPatternData, error: teamVenueWindPatternError } = await supabase
        .from("team_venue_wind_patterns")
        .select(TEAM_VENUE_WIND_PATTERN_SELECT_COLUMNS)
        .in("id", windPatternIds)
        .eq("team_venue_id", input.teamVenue.id)

      if (teamVenueWindPatternError) {
        throwNotesTimingError(
          "wind_pattern_names_query_error",
          `Could not load venue wind patterns for camp detail: ${teamVenueWindPatternError.message}`,
        )
      }

      teamVenueWindPatterns = teamVenueWindPatternData ?? []
    }
  }

  const setupBySessionId = new Map(setupRows.map((row) => [row.session_id, row]))
  const reviewBySessionId = new Map(reviewRows.map((row) => [row.session_id, row]))
  const standardMoveNameById = new Map(teamStandardMoves.map((row) => [row.id, row.name]))
  const windPatternNameById = new Map(teamVenueWindPatterns.map((row) => [row.id, row.name]))
  const standardMoveNamesBySessionId = new Map<string, string[]>()
  const windPatternNamesBySessionId = new Map<string, string[]>()

  for (const row of sessionStandardMoveRows) {
    const standardMoveName = standardMoveNameById.get(row.team_standard_move_id)

    if (!standardMoveName) {
      continue
    }

    const existingNames = standardMoveNamesBySessionId.get(row.session_id) ?? []
    existingNames.push(standardMoveName)
    standardMoveNamesBySessionId.set(row.session_id, existingNames)
  }

  for (const [sessionId, standardMoveNames] of standardMoveNamesBySessionId.entries()) {
    standardMoveNamesBySessionId.set(
      sessionId,
      [...standardMoveNames].sort((left, right) => left.localeCompare(right)),
    )
  }

  for (const row of sessionWindPatternRows) {
    const windPatternName = windPatternNameById.get(row.team_venue_wind_pattern_id)

    if (!windPatternName) {
      continue
    }

    const existingNames = windPatternNamesBySessionId.get(row.session_id) ?? []
    existingNames.push(windPatternName)
    windPatternNamesBySessionId.set(row.session_id, existingNames)
  }

  for (const [sessionId, windPatternNames] of windPatternNamesBySessionId.entries()) {
    windPatternNamesBySessionId.set(
      sessionId,
      [...windPatternNames].sort((left, right) => left.localeCompare(right)),
    )
  }

  const totalSessions = sessionTotalCount ?? 0
  const nextSessionOffset =
    sessionOffset + sessions.length < totalSessions
      ? sessionOffset + sessions.length
      : null

  const notesCards = buildNotesCards({
    sessions,
    setupBySessionId,
    reviewBySessionId,
    standardMoveNamesBySessionId,
    windPatternNamesBySessionId,
  })

  logNotesTiming("success", "loaded", undefined, {
    nextSessionOffset,
    noteCardCount: notesCards.length,
    returnedSessionCount: sessions.length,
    sessionTotalCount: totalSessions,
  })

  return {
    nextSessionOffset,
    notesCards,
    sessionLimit: CAMP_NOTES_SESSION_PAGE_SIZE,
    sessionOffset,
    sessionTotalCount: totalSessions,
  }
}

export async function getCampDetailTabData(input: {
  activeTeamId: string
  accumulatePages?: boolean
  camp: CampDetailCamp
  page: number
  notesSessionOffset?: number
  selectedHighlight?: TeamSessionHighlightFilter
  tab: CampDetailTab
  teamVenue: CampDetailTeamVenue
}): Promise<CampDetailTabPayload> {
  const startedAt = startCampDetailTiming()

  try {
    let data: CampDetailTabPayload

    if (input.tab === "sessions") {
      data = await getCampDetailSessionsTabData(input)
    } else if (input.tab === "goals") {
      data = await getCampDetailGoalsTabData({
        campId: input.camp.id,
      })
    } else {
      data = await getCampDetailNotesTabData({
        camp: input.camp,
        sessionOffset: input.notesSessionOffset,
        teamVenue: input.teamVenue,
      })
    }

    logCampDetailTiming({
      route: "/team-camps/[id]",
      phase: "load_tab",
      startedAt,
      campId: input.camp.id,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: getCampDetailTabResponseTimingMetadata({
        accumulatePages: input.accumulatePages,
        data,
        notesSessionOffset: input.notesSessionOffset,
        page: input.page,
        selectedHighlight: input.selectedHighlight,
        tab: input.tab,
      }),
    })

    return data
  } catch (error) {
    logCampDetailTiming({
      route: "/team-camps/[id]",
      phase: "load_tab",
      startedAt,
      campId: input.camp.id,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: getCampDetailTimingErrorMessage(error),
      metadata: getCampDetailTabRequestTimingMetadata({
        accumulatePages: input.accumulatePages,
        notesSessionOffset: input.notesSessionOffset,
        page: input.page,
        selectedHighlight: input.selectedHighlight,
        tab: input.tab,
      }),
    })

    throw error
  }
}
