import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/types/database"
import type {
  CampDetailCamp,
  CampDetailKpi,
  CampDetailNotesCard,
  CampDetailPageData,
  CampDetailSessionItem,
  CampDetailTeamVenue,
} from "@/features/camps/detail-types"

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "camp_type" | "start_date" | "end_date" | "notes" | "is_active"
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
  "session_id" | "best_of_session" | "to_work" | "standard_moves" | "wind_patterns"
>

const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,camp_type,start_date,end_date,notes,is_active"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,organization_id,name,city,country"
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"
const SESSION_REVIEW_SELECT_COLUMNS =
  "session_id,best_of_session,to_work,standard_moves,wind_patterns"

const EMPTY_KPIS: CampDetailKpi[] = [
  { label: "Total Sessions", value: "0", note: "Current camp" },
  { label: "Avg. Session", value: "—", note: "No net time recorded" },
  { label: "Net Time Sailed", value: "00h 00m", note: "Sum of net time in camp sessions" },
  { label: "Camp Dates", value: "—", note: "Camp schedule window" },
]

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
  sessions: SessionRow[]
}): CampDetailKpi[] {
  const sessionsWithNetTimeValues = input.sessions
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

  return [
    {
      label: "Total Sessions",
      value: String(input.sessions.length),
      note: "Current camp",
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(averageNetTimeMinutes),
      note:
        sessionsWithNetTimeValues.length > 0
          ? `${sessionsWithNetTimeValues.length} sessions with net time`
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
}): CampDetailNotesCard[] {
  const notesCards: CampDetailNotesCard[] = []

  for (const session of input.sessions) {
    const setup = input.setupBySessionId.get(session.id)
    const review = input.reviewBySessionId.get(session.id)

    const freeNotes = normalizeText(setup?.free_notes)
    const best = normalizeText(review?.best_of_session)
    const toWork = normalizeText(review?.to_work)
    const standardMoves = formatJsonNote(review?.standard_moves)
    const windPattern = formatJsonNote(review?.wind_patterns)

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

function buildSessionItems(sessions: SessionRow[]): CampDetailSessionItem[] {
  return sessions.map((session) => ({
    id: session.id,
    sessionDateLabel: formatDateLabel(session.session_date),
    sessionTypeLabel: titleCaseSessionType(session.session_type),
    durationLabel: formatHoursAndMinutes(session.net_time_minutes),
    highlightedByCoach: session.highlighted_by_coach,
  }))
}

function buildLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function buildEmptyData(): CampDetailPageData {
  return {
    camp: null,
    teamVenue: null,
    kpis: EMPTY_KPIS,
    sessions: [],
    notesCards: [],
  }
}

export async function getCampDetailPageData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  campId: string
}): Promise<CampDetailPageData> {
  if (!input.activeTeamId) {
    return buildEmptyData()
  }

  const supabase = await createServerSupabaseClient()

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("id", input.campId)
    .maybeSingle()

  if (campError) {
    throw new Error(`Could not load camp detail: ${campError.message}`)
  }

  if (!campRow) {
    return buildEmptyData()
  }

  const camp: CampRow = campRow

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", camp.team_venue_id)
    .maybeSingle()

  if (teamVenueError) {
    throw new Error(`Could not load camp team venue: ${teamVenueError.message}`)
  }

  if (!teamVenueRow || teamVenueRow.team_id !== input.activeTeamId) {
    return buildEmptyData()
  }

  const teamVenue: CampDetailTeamVenue = teamVenueRow

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", teamVenue.venue_id)
    .eq("organization_id", input.activeOrganizationId)
    .maybeSingle()

  if (venueError) {
    throw new Error(`Could not load venue for camp detail: ${venueError.message}`)
  }

  if (!venueRow) {
    return buildEmptyData()
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
    goals: camp.notes,
    isActive: camp.is_active,
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .eq("camp_id", detailCamp.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (sessionsError) {
    throw new Error(`Could not load camp sessions: ${sessionsError.message}`)
  }

  const sessions: SessionRow[] = sessionRows ?? []
  const sessionIds = sessions.map((session) => session.id)

  let setupRows: SessionSetupRow[] = []
  let reviewRows: SessionReviewRow[] = []

  if (sessionIds.length > 0) {
    const [{ data: setupData, error: setupError }, { data: reviewData, error: reviewError }] =
      await Promise.all([
        supabase
          .from("session_setups")
          .select(SESSION_SETUP_SELECT_COLUMNS)
          .in("session_id", sessionIds),
        supabase
          .from("session_reviews")
          .select(SESSION_REVIEW_SELECT_COLUMNS)
          .in("session_id", sessionIds),
      ])

    if (setupError) {
      throw new Error(`Could not load session setups for camp detail: ${setupError.message}`)
    }

    if (reviewError) {
      throw new Error(`Could not load session reviews for camp detail: ${reviewError.message}`)
    }

    setupRows = setupData ?? []
    reviewRows = reviewData ?? []
  }

  const setupBySessionId = new Map(setupRows.map((row) => [row.session_id, row]))
  const reviewBySessionId = new Map(reviewRows.map((row) => [row.session_id, row]))

  return {
    camp: detailCamp,
    teamVenue,
    kpis: buildKpis({
      camp: detailCamp,
      sessions,
    }),
    sessions: buildSessionItems(sessions),
    notesCards: buildNotesCards({
      sessions,
      setupBySessionId,
      reviewBySessionId,
    }),
  }
}
