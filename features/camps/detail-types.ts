import type { Database } from "@/types/database"

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
  goals: CampRow["notes"]
  isActive: CampRow["is_active"]
}

export type CampDetailTeamVenue = Pick<TeamVenueRow, "id" | "team_id" | "venue_id">

export type CampDetailKpi = {
  label: string
  value: string
  note: string
}

export type CampDetailSessionItem = {
  id: string
  sessionDateLabel: string
  sessionTypeLabel: string
  durationLabel: string
  highlightedByCoach: boolean
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

export type CampDetailPageData = {
  camp: CampDetailCamp | null
  teamVenue: CampDetailTeamVenue | null
  kpis: CampDetailKpi[]
  sessions: CampDetailSessionItem[]
  notesCards: CampDetailNotesCard[]
}
