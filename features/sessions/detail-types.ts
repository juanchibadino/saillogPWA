import type { Database } from "@/types/database"

type TeamRow = Database["public"]["Tables"]["teams"]["Row"]
type VenueRow = Database["public"]["Tables"]["venues"]["Row"]
type CampRow = Database["public"]["Tables"]["camps"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type AssetRow = Database["public"]["Tables"]["session_assets"]["Row"]

export type SessionDetailTeam = Pick<TeamRow, "id" | "name">

export type SessionDetailVenue = Pick<VenueRow, "id" | "name" | "city" | "country">

export type SessionDetailCamp = Pick<CampRow, "id" | "name" | "team_venue_id">

export type SessionDetailSession = Pick<
  SessionRow,
  | "id"
  | "camp_id"
  | "session_type"
  | "session_date"
  | "dock_out_at"
  | "dock_in_at"
  | "net_time_minutes"
  | "highlighted_by_coach"
>

export type SessionDetailInfo = {
  bestOfSession: string | null
  toWork: string | null
  standardMoves: string | null
  windPatterns: string | null
  freeNotes: string | null
}

export type SessionDetailResults = {
  resultNotes: string | null
}

export type SessionSetupDialogOption = {
  id: string
  value: string
  label: string
}

export type SessionSetupDialogItem = {
  id: string
  key: string
  label: string
  inputKind: "single_select" | "multi_select" | "text"
  options: SessionSetupDialogOption[]
  selectedOptionIds: string[]
  textValue: string
}

export type SessionDetailAsset = Pick<
  AssetRow,
  "id" | "asset_type" | "bucket" | "storage_path" | "file_name" | "mime_type" | "size_bytes" | "created_at"
>

export type SessionDetailData = {
  team: SessionDetailTeam
  venue: SessionDetailVenue
  camp: SessionDetailCamp
  session: SessionDetailSession
  info: SessionDetailInfo
  results: SessionDetailResults
  setupDialogItems: SessionSetupDialogItem[]
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
}
