import type { Database } from "@/types/database"

type VenueRow = Database["public"]["Tables"]["venues"]["Row"]
type TeamVenueRow = Database["public"]["Tables"]["team_venues"]["Row"]
type CampRow = Database["public"]["Tables"]["camps"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]

export type VenueDetailVenue = Pick<
  VenueRow,
  "id" | "organization_id" | "name" | "city" | "country" | "is_active"
>

export type VenueDetailTeamVenue = Pick<TeamVenueRow, "id" | "team_id" | "venue_id">

export type VenueDetailKpi = {
  label: string
  value: string
  note: string
}

export type VenueDetailCampItem = {
  id: string
  name: string
  campType: CampRow["camp_type"]
  dateRangeLabel: string
  sessionCount: number
}

export type VenueDetailSessionItem = {
  id: string
  campId: string
  campName: string
  sessionType: SessionRow["session_type"]
  sessionTypeLabel: string
  sessionDateLabel: string
  durationLabel: string
  highlightedByCoach: boolean
}

export type VenueDetailMetrics = {
  sessionsWithNetTime: number
  totalNetTimeMinutes: number
  averageNetTimeMinutes: number | null
  highlightedSessionsCount: number
}

export type VenueDetailYearData = {
  kpis: VenueDetailKpi[]
  camps: VenueDetailCampItem[]
  sessions: VenueDetailSessionItem[]
  metrics: VenueDetailMetrics
}

export type VenueDetailPageData = {
  venue: VenueDetailVenue | null
  teamVenue: VenueDetailTeamVenue | null
  availableYears: number[]
  selectedYear: number
  byYear: Record<number, VenueDetailYearData>
}
