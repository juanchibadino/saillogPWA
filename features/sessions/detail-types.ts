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
  windPatterns: string[]
  legacyWindPatterns: string | null
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

export type SessionDetailAssetMetadata = Pick<
  AssetRow,
  | "id"
  | "asset_type"
  | "bucket"
  | "storage_path"
  | "file_name"
  | "mime_type"
  | "size_bytes"
  | "thumbnail_bucket"
  | "thumbnail_storage_path"
  | "thumbnail_mime_type"
  | "thumbnail_size_bytes"
  | "created_at"
>

export type SessionDetailAsset = SessionDetailAssetMetadata & {
  contentUrl: string
  signedUrl: string | null
  thumbnailSignedUrl: string | null
}

export type SessionDetailAssetPage = {
  assetLimit: number
  assetOffset: number
  assetTotalCount: number
}

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
  availableWindPatterns: {
    id: string
    name: string
    description: string | null
    isActive: boolean
  }[]
  linkedWindPatternIds: string[]
  results: SessionDetailResults
  setupDialogItems: SessionSetupDialogItem[]
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
}

export type SessionDetailSetupData = Pick<SessionDetailData, "setupDialogItems">

export type SessionDetailInfoTabData = Pick<
  SessionDetailData,
  | "info"
  | "availableStandardMoves"
  | "linkedStandardMoveIds"
  | "availableWindPatterns"
  | "linkedWindPatternIds"
>

export type SessionDetailGoalsTabData = {
  goals: string | null
}

export type SessionDetailResultsTabData = Pick<SessionDetailData, "results">

export type SessionDetailImagesTabData = Pick<SessionDetailData, "images"> &
  SessionDetailAssetPage

export type SessionDetailAnalyticsTabData = Pick<SessionDetailData, "analyticsFiles"> &
  SessionDetailAssetPage

export type SessionDetailGearTabData = Pick<
  SessionDetailData,
  "gearItems" | "linkedGearItemIds"
>

export type SessionDetailTabDataByTab = {
  info: SessionDetailInfoTabData
  goals: SessionDetailGoalsTabData
  results: SessionDetailResultsTabData
  images: SessionDetailImagesTabData
  analytics: SessionDetailAnalyticsTabData
  gear: SessionDetailGearTabData
}

export type SessionDetailTabPayload =
  SessionDetailTabDataByTab[keyof SessionDetailTabDataByTab]
