import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import type {
  VenueDetailCampItem,
  VenueDetailKpi,
  VenueDetailMetrics,
  VenueDetailPageData,
  VenueDetailSessionItem,
  VenueDetailTeamVenue,
  VenueDetailVenue,
  VenueDetailYearData,
} from "@/features/venues/detail-types"

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "name" | "camp_type" | "start_date" | "end_date"
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

const VENUE_SELECT_COLUMNS = "id,organization_id,name,city,country,is_active"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const CAMP_SELECT_COLUMNS = "id,name,camp_type,start_date,end_date"
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at"

function getCurrentYear(): number {
  return new Date().getUTCFullYear()
}

function parseYear(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value.slice(0, 4), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`
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

function buildAvailableYears(input: {
  camps: CampRow[]
  sessions: SessionRow[]
  fallbackYear: number
}): number[] {
  const years = new Set<number>()

  for (const camp of input.camps) {
    const year = parseYear(camp.start_date)

    if (year !== null) {
      years.add(year)
    }
  }

  for (const session of input.sessions) {
    const year = parseYear(session.session_date)

    if (year !== null) {
      years.add(year)
    }
  }

  if (years.size === 0) {
    years.add(input.fallbackYear)
  }

  return [...years].sort((a, b) => b - a)
}

function resolveSelectedYear(input: {
  availableYears: number[]
  requestedYear?: number
}): number {
  if (
    typeof input.requestedYear === "number" &&
    Number.isFinite(input.requestedYear) &&
    input.availableYears.includes(input.requestedYear)
  ) {
    return input.requestedYear
  }

  return input.availableYears[0] ?? getCurrentYear()
}

function filterCampsByYear(camps: CampRow[], selectedYear: number): CampRow[] {
  return camps.filter((camp) => parseYear(camp.start_date) === selectedYear)
}

function filterSessionsByYear(
  sessions: SessionRow[],
  selectedYear: number,
): SessionRow[] {
  return sessions.filter((session) => parseYear(session.session_date) === selectedYear)
}

function buildKpis(input: {
  campCount: number
  sessionCount: number
  metrics: VenueDetailMetrics
}): VenueDetailKpi[] {
  return [
    {
      label: "Total Camps",
      value: String(input.campCount),
      note: "Selected year",
    },
    {
      label: "Total Sessions",
      value: String(input.sessionCount),
      note: "Selected year",
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(input.metrics.averageNetTimeMinutes),
      note:
        input.metrics.sessionsWithNetTime > 0
          ? `${input.metrics.sessionsWithNetTime} sessions with net time`
          : "No net time recorded",
    },
    {
      label: "Net Time Sailed",
      value: formatTotalNetTime(input.metrics.totalNetTimeMinutes),
      note: "Sum of net time for selected year",
    },
  ]
}

function titleCaseSessionType(value: SessionRow["session_type"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildMetricsFromSessions(sessions: SessionRow[]): VenueDetailMetrics {
  const sessionsWithNetTimeValues = sessions
    .map((session) => session.net_time_minutes)
    .filter((minutes): minutes is number => typeof minutes === "number")

  const totalNetTimeMinutes = sessionsWithNetTimeValues.reduce(
    (sum, minutes) => sum + minutes,
    0,
  )
  const averageNetTimeMinutes =
    sessionsWithNetTimeValues.length > 0
      ? Math.round(totalNetTimeMinutes / sessionsWithNetTimeValues.length)
      : null

  return {
    sessionsWithNetTime: sessionsWithNetTimeValues.length,
    totalNetTimeMinutes,
    averageNetTimeMinutes,
    highlightedSessionsCount: sessions.filter((session) => session.highlighted_by_coach)
      .length,
  }
}

function buildEmptyMetrics(): VenueDetailMetrics {
  return {
    sessionsWithNetTime: 0,
    totalNetTimeMinutes: 0,
    averageNetTimeMinutes: null,
    highlightedSessionsCount: 0,
  }
}

function buildEmptyYearData(): VenueDetailYearData {
  const metrics = buildEmptyMetrics()

  return {
    kpis: buildKpis({
      campCount: 0,
      sessionCount: 0,
      metrics,
    }),
    camps: [],
    sessions: [],
    metrics,
  }
}

function buildYearData(input: {
  year: number
  camps: CampRow[]
  sessions: SessionRow[]
  campById: Map<string, CampRow>
}): VenueDetailYearData {
  const camps = filterCampsByYear(input.camps, input.year)
  const sessions = filterSessionsByYear(input.sessions, input.year)
  const sessionCountByCampId = new Map<string, number>()

  for (const session of sessions) {
    const currentCount = sessionCountByCampId.get(session.camp_id) ?? 0
    sessionCountByCampId.set(session.camp_id, currentCount + 1)
  }

  const metrics = buildMetricsFromSessions(sessions)

  const campItems: VenueDetailCampItem[] = camps.map((camp) => ({
    id: camp.id,
    name: camp.name,
    campType: camp.camp_type,
    dateRangeLabel: formatDateRange(camp.start_date, camp.end_date),
    sessionCount: sessionCountByCampId.get(camp.id) ?? 0,
  }))

  const sessionItems: VenueDetailSessionItem[] = sessions
    .map((session) => {
      const camp = input.campById.get(session.camp_id)

      if (!camp) {
        return null
      }

      return {
        id: session.id,
        campId: session.camp_id,
        campName: camp.name,
        sessionType: session.session_type,
        sessionTypeLabel: titleCaseSessionType(session.session_type),
        sessionDateLabel: formatDateLabel(session.session_date),
        durationLabel: formatHoursAndMinutes(session.net_time_minutes),
        highlightedByCoach: session.highlighted_by_coach,
      }
    })
    .filter((row): row is VenueDetailSessionItem => row !== null)

  return {
    kpis: buildKpis({
      campCount: camps.length,
      sessionCount: sessions.length,
      metrics,
    }),
    camps: campItems,
    sessions: sessionItems,
    metrics,
  }
}

function buildEmptyData(input: {
  venue: VenueDetailVenue | null
  teamVenue: VenueDetailTeamVenue | null
  requestedYear?: number
}): VenueDetailPageData {
  const currentYear = getCurrentYear()
  const availableYears = [currentYear]
  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear: input.requestedYear,
  })

  return {
    venue: input.venue,
    teamVenue: input.teamVenue,
    availableYears,
    selectedYear,
    byYear: {
      [selectedYear]: buildEmptyYearData(),
    },
  }
}

export async function getVenueDetailPageData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  venueId: string
  requestedYear?: number
}): Promise<VenueDetailPageData> {
  const supabase = await createServerSupabaseClient()

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", input.venueId)
    .eq("organization_id", input.activeOrganizationId)
    .maybeSingle()

  if (venueError) {
    throw new Error(`Could not load venue: ${venueError.message}`)
  }

  if (!venue) {
    return buildEmptyData({
      venue: null,
      teamVenue: null,
      requestedYear: input.requestedYear,
    })
  }

  if (!input.activeTeamId) {
    return buildEmptyData({
      venue,
      teamVenue: null,
      requestedYear: input.requestedYear,
    })
  }

  const { data: teamVenue, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .eq("venue_id", input.venueId)
    .maybeSingle()

  if (teamVenueError) {
    throw new Error(`Could not load team venue: ${teamVenueError.message}`)
  }

  if (!teamVenue) {
    return buildEmptyData({
      venue,
      teamVenue: null,
      requestedYear: input.requestedYear,
    })
  }

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("team_venue_id", teamVenue.id)
    .order("start_date", { ascending: false })
    .order("name", { ascending: true })

  if (campsError) {
    throw new Error(`Could not load camps: ${campsError.message}`)
  }

  const camps: CampRow[] = campRows ?? []
  const campIds = camps.map((camp) => camp.id)
  let sessions: SessionRow[] = []

  if (campIds.length > 0) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select(SESSION_SELECT_COLUMNS)
      .in("camp_id", campIds)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (sessionsError) {
      throw new Error(`Could not load sessions: ${sessionsError.message}`)
    }

    sessions = sessionRows ?? []
  }

  const availableYears = buildAvailableYears({
    camps,
    sessions,
    fallbackYear: getCurrentYear(),
  })
  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear: input.requestedYear,
  })
  const campById = new Map(camps.map((camp) => [camp.id, camp]))
  const byYear: Record<number, VenueDetailYearData> = {}

  for (const year of availableYears) {
    byYear[year] = buildYearData({
      year,
      camps,
      sessions,
      campById,
    })
  }

  return {
    venue,
    teamVenue,
    availableYears,
    selectedYear,
    byYear,
  }
}
