import type { Database } from "@/types/database"
import type {
  TeamSessionCampOption,
  TeamSessionHighlightFilter,
  TeamSessionListItem,
} from "@/features/sessions/data"

type CampRow = Database["public"]["Tables"]["camps"]["Row"]
type TeamVenueRow = Database["public"]["Tables"]["team_venues"]["Row"]

export type CampDetailTab = "sessions" | "goals" | "notes"

export type CampDetailCamp = {
  id: CampRow["id"]
  teamVenueId: CampRow["team_venue_id"]
  venueId: string
  venueName: string
  venueLocation: string
  name: CampRow["name"]
  campType: CampRow["camp_type"]
  startDate: CampRow["start_date"]
  endDate: CampRow["end_date"]
  isActive: CampRow["is_active"]
}

export type CampDetailTeamVenue = Pick<TeamVenueRow, "id" | "team_id" | "venue_id">

export type CampDetailKpi = {
  label: string
  value: string
  note: string
}

export type CampDetailNotesCard = {
  sessionId: string
  sessionDateLabel: string
  sessionTypeLabel: string
  freeNotes: string | null
  best: string | null
  toWork: string | null
  standardMoves: string | null
  windPattern: string | null
}

export type CampDetailChromeData = {
  camp: CampDetailCamp
  teamVenue: CampDetailTeamVenue
}

export type CampDetailShellData = CampDetailChromeData & {
  kpis: CampDetailKpi[]
}

export type CampDetailSessionsTabData = {
  sessions: TeamSessionListItem[]
  campOptions: TeamSessionCampOption[]
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  selectedHighlight?: TeamSessionHighlightFilter
}

export type CampDetailGoalsTabData = {
  goals: CampRow["notes"]
}

export type CampDetailNotesTabData = {
  nextSessionOffset: number | null
  notesCards: CampDetailNotesCard[]
  sessionLimit: number
  sessionOffset: number
  sessionTotalCount: number
}

export type CampDetailTabDataByTab = {
  sessions: CampDetailSessionsTabData
  goals: CampDetailGoalsTabData
  notes: CampDetailNotesTabData
}

export type CampDetailTabPayload =
  CampDetailTabDataByTab[keyof CampDetailTabDataByTab]
