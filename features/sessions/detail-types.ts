import type { Database } from "@/types/database"

type TeamRow = Database["public"]["Tables"]["teams"]["Row"]
type VenueRow = Database["public"]["Tables"]["venues"]["Row"]
type CampRow = Database["public"]["Tables"]["camps"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type AssetRow = Database["public"]["Tables"]["session_assets"]["Row"]
type GearItemRow = Database["public"]["Tables"]["gear_items"]["Row"]

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
  | "goals"
>

export type SessionDetailInfo = {
  bestOfSession: string | null
  toWork: string | null
  standardMoves: string[]
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

export type SessionSetupDialogSelectedOption = {
  optionId: string
  allocationPercent: number | null
}

export type SessionSetupDialogItem = {
  id: string
  key: string
  label: string
  inputKind: "single_select" | "multi_select" | "text"
  metricGroup: "weather" | "boat"
  isFixed: boolean
  position: number
  options: SessionSetupDialogOption[]
  selectedOptions: SessionSetupDialogSelectedOption[]
  textValue: string
}

export type SessionDetailAsset = Pick<
  AssetRow,
  "id" | "asset_type" | "bucket" | "storage_path" | "file_name" | "mime_type" | "size_bytes" | "created_at"
>

export type SessionDetailGearItem = Pick<
  GearItemRow,
  "id" | "name" | "gear_type" | "status" | "condition" | "serial_number" | "barcode"
>

export type SessionDetailData = {
  team: SessionDetailTeam
  venue: SessionDetailVenue
  camp: SessionDetailCamp
  session: SessionDetailSession
  info: SessionDetailInfo
  availableStandardMoves: {
    id: string
    name: string
    description: string | null
    isActive: boolean
  }[]
  linkedStandardMoveIds: string[]
  results: SessionDetailResults
  setupDialogItems: SessionSetupDialogItem[]
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
}
