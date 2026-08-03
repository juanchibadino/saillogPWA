import type { Database } from "@/types/database"

type TeamRow = Database["public"]["Tables"]["teams"]["Row"]
type VenueRow = Database["public"]["Tables"]["venues"]["Row"]
type CampRow = Database["public"]["Tables"]["camps"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type AssetRow = Database["public"]["Tables"]["session_assets"]["Row"]
type GearItemRow = Database["public"]["Tables"]["gear_items"]["Row"]

export type SessionDetailTeam = Pick<TeamRow, "id" | "name">

export type SessionDetailVenue = Pick<VenueRow, "id" | "name" | "city" | "country">

export type SessionDetailCamp = Pick<
  CampRow,
  "id" | "name" | "team_venue_id" | "start_date" | "end_date"
>

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
  isRequired: boolean
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
  | "description"
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

export type SessionDetailVakarosBuoy = {
  id: string
  lat: number
  lon: number
  mode: "windward" | "leeward"
}

export type SessionDetailVakarosSavedTrim = {
  id: string
  buoys: SessionDetailVakarosBuoy[]
  createdAt: string
  name: string
  trimEnd: number
  trimStart: number
}

export type SessionDetailGpsFile = SessionDetailAsset & {
  gpsArtifacts: {
    series1HzUrl: string
    summaryUrl: string
    trackGeojsonUrl: string
  }
  vakaros: {
    uploadId: string
    avgSogKts: number
    distanceNm: number
    durationHours: number
    endAt: string | null
    maxSogKts: number
    p95SogKts: number
    rows1Hz: number
    rowsRaw: number
    savedTrims: SessionDetailVakarosSavedTrim[]
    startAt: string | null
  } | null
}

export type SessionDetailAssetPage = {
  assetLimit: number
  assetOffset: number
  assetTotalCount: number
}

export type SessionDetailCatalogPage = {
  limit: number
  nextOffset: number | null
  offset: number
  search: string
  totalCount: number
}

export type SessionDetailGearItem = Pick<
  GearItemRow,
  "id" | "name" | "gear_type" | "status" | "condition" | "serial_number" | "barcode"
> & {
  alertState: Database["public"]["Enums"]["gear_alert_state"]
  triggeredAlertCount: number
  usageCount: number
  usageMinutes: number
}

export type SessionDetailGearTypeFilter = "all" | GearItemRow["gear_type"]

export type SessionDetailStandardMove = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

export type SessionDetailWindPattern = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

export type SessionDetailStandardMovesCatalogData = {
  availableStandardMoves: SessionDetailStandardMove[]
  standardMoveCatalogPage: SessionDetailCatalogPage
}

export type SessionDetailWindPatternsCatalogData = {
  availableWindPatterns: SessionDetailWindPattern[]
  windPatternCatalogPage: SessionDetailCatalogPage
}

export type SessionDetailGearCatalogData = {
  gearCatalogPage: SessionDetailCatalogPage
  gearItems: SessionDetailGearItem[]
  gearType: SessionDetailGearTypeFilter
}

export type SessionDetailData = {
  team: SessionDetailTeam
  venue: SessionDetailVenue
  camp: SessionDetailCamp
  session: SessionDetailSession
  info: SessionDetailInfo
  availableStandardMoves: SessionDetailStandardMove[]
  linkedStandardMoveIds: string[]
  standardMoveCatalogPage: SessionDetailCatalogPage
  availableWindPatterns: SessionDetailWindPattern[]
  linkedWindPatternIds: string[]
  windPatternCatalogPage: SessionDetailCatalogPage
  results: SessionDetailResults
  setupDialogItems: SessionSetupDialogItem[]
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
  gpsFiles: SessionDetailGpsFile[]
  gearItems: SessionDetailGearItem[]
  gearCatalogPage: SessionDetailCatalogPage
  gearType: SessionDetailGearTypeFilter
  linkedGearItemIds: string[]
}

export type SessionDetailSetupData = {
  freeNotes: string | null
  setupDialogItems: SessionSetupDialogItem[]
}

export type SessionDetailInfoTabData = Pick<
  SessionDetailData,
  | "info"
  | "availableStandardMoves"
  | "linkedStandardMoveIds"
  | "standardMoveCatalogPage"
  | "availableWindPatterns"
  | "linkedWindPatternIds"
  | "windPatternCatalogPage"
>

export type SessionDetailGoalsTabData = {
  goals: string | null
}

export type SessionDetailResultsTabData = Pick<SessionDetailData, "results">

export type SessionDetailImagesTabData = Pick<SessionDetailData, "images"> &
  SessionDetailAssetPage

export type SessionDetailAnalyticsTabData = Pick<
  SessionDetailData,
  "analyticsFiles" | "gpsFiles"
> &
  SessionDetailAssetPage & {
    gpsFileTotalCount: number
  }

export type SessionDetailGearTabData = Pick<
  SessionDetailData,
  "gearCatalogPage" | "gearItems" | "gearType" | "linkedGearItemIds"
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
