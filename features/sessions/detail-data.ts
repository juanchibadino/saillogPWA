import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/types/database"
import {
  getSessionDetailTimingErrorMessage,
  logSessionDetailTiming,
  startSessionDetailTiming,
} from "@/features/sessions/detail-timing"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { normalizeVakarosSavedTrimBuoys } from "@/features/sessions/vakaros-saved-trims.mjs"
import type {
  SessionDetailAsset,
  SessionDetailAnalyticsTabData,
  SessionDetailData,
  SessionDetailCatalogPage,
  SessionDetailGearCatalogData,
  SessionDetailGearItem,
  SessionDetailGearTabData,
  SessionDetailGearTypeFilter,
  SessionDetailGoalsTabData,
  SessionDetailGpsFile,
  SessionDetailImagesTabData,
  SessionDetailInfo,
  SessionDetailInfoTabData,
  SessionDetailResultsTabData,
  SessionDetailResults,
  SessionDetailSetupData,
  SessionDetailSession,
  SessionDetailAssetMetadata,
  SessionDetailStandardMove,
  SessionDetailStandardMovesCatalogData,
  SessionSetupDialogItem,
  SessionDetailTabPayload,
  SessionDetailVakarosSavedTrim,
  SessionDetailWindPattern,
  SessionDetailWindPatternsCatalogData,
} from "@/features/sessions/detail-types"
import type { SessionDetailTab } from "@/features/sessions/navigation"

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
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

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "name" | "team_venue_id" | "start_date" | "end_date"
>

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name" | "organization_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country" | "organization_id"
>

type SessionReviewRow = Pick<
  Database["public"]["Tables"]["session_reviews"]["Row"],
  "session_id" | "best_of_session" | "to_work" | "wind_patterns"
>

type SessionSetupRow = Pick<
  Database["public"]["Tables"]["session_setups"]["Row"],
  "session_id" | "free_notes"
>

type SessionRegattaResultRow = Pick<
  Database["public"]["Tables"]["session_regatta_results"]["Row"],
  "session_id" | "result_notes"
>

type TeamSetupItemRow = Pick<
  Database["public"]["Tables"]["team_setup_items"]["Row"],
  | "id"
  | "key"
  | "label"
  | "input_kind"
  | "metric_group"
  | "is_fixed"
  | "is_required"
  | "position"
  | "is_active"
>

type TeamSetupItemOptionRow = Pick<
  Database["public"]["Tables"]["team_setup_item_options"]["Row"],
  "id" | "team_setup_item_id" | "value" | "label" | "position" | "is_active"
>

type SessionSetupItemValueRow = Pick<
  Database["public"]["Tables"]["session_setup_item_values"]["Row"],
  "id" | "team_setup_item_id" | "text_value"
>

type SessionSetupItemSelectedOptionRow = Pick<
  Database["public"]["Tables"]["session_setup_item_selected_options"]["Row"],
  "session_setup_item_value_id" | "team_setup_item_option_id" | "allocation_percent"
>

type SessionAssetRow = SessionDetailAssetMetadata
type SessionVakarosUploadRow = Pick<
  Database["public"]["Tables"]["session_vakaros_uploads"]["Row"],
  | "id"
  | "asset_id"
  | "avg_sog_kts"
  | "bucket"
  | "distance_nm"
  | "duration_hours"
  | "end_at"
  | "max_sog_kts"
  | "p95_sog_kts"
  | "raw_storage_path"
  | "rows_1hz"
  | "rows_raw"
  | "series_1hz_storage_path"
  | "start_at"
  | "summary_storage_path"
  | "track_geojson_storage_path"
>
type SessionVakarosSavedTrimRow = Pick<
  Database["public"]["Tables"]["session_vakaros_saved_trims"]["Row"],
  | "id"
  | "upload_id"
  | "name"
  | "trim_start_index"
  | "trim_end_index"
  | "buoys"
  | "created_at"
>
type GearItemRow = Pick<
  Database["public"]["Tables"]["gear_items"]["Row"],
  "id" | "name" | "gear_type" | "status" | "condition" | "serial_number" | "barcode"
>
type TeamGearAlertRow =
  Database["public"]["Functions"]["get_team_gear_alert_rows"]["Returns"][number]
type SessionGearUsageRow = Pick<
  Database["public"]["Tables"]["session_gear_usage"]["Row"],
  "gear_item_id"
>

type TeamStandardMoveRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "name" | "description" | "is_active"
>

type SessionStandardMoveRow = Pick<
  Database["public"]["Tables"]["session_standard_moves"]["Row"],
  "session_id" | "team_standard_move_id"
>

type TeamVenueWindPatternRow = Pick<
  Database["public"]["Tables"]["team_venue_wind_patterns"]["Row"],
  "id" | "name" | "description" | "is_active"
>

type SessionWindPatternRow = Pick<
  Database["public"]["Tables"]["session_wind_patterns"]["Row"],
  "session_id" | "team_venue_wind_pattern_id"
>

const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,dock_out_at,dock_in_at,net_time_minutes,highlighted_by_coach,goals"
const CAMP_SELECT_COLUMNS = "id,name,team_venue_id,start_date,end_date"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const TEAM_SELECT_COLUMNS = "id,name,organization_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country,organization_id"
const SESSION_REVIEW_SELECT_COLUMNS = "session_id,best_of_session,to_work,wind_patterns"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"
const SESSION_REGATTA_RESULTS_SELECT_COLUMNS = "session_id,result_notes"
const SESSION_ASSETS_BASE_SELECT_COLUMNS =
  "id,asset_type,bucket,storage_path,file_name,mime_type,size_bytes,created_at"
const SESSION_ASSETS_WITH_DESCRIPTION_SELECT_COLUMNS =
  "id,asset_type,bucket,storage_path,file_name,description,mime_type,size_bytes,created_at"
const SESSION_ASSETS_WITH_THUMBNAILS_SELECT_COLUMNS =
  "id,asset_type,bucket,storage_path,file_name,description,mime_type,size_bytes,thumbnail_bucket,thumbnail_storage_path,thumbnail_mime_type,thumbnail_size_bytes,created_at"
const SESSION_VAKAROS_UPLOADS_SELECT_COLUMNS =
  "id,asset_id,bucket,raw_storage_path,series_1hz_storage_path,track_geojson_storage_path,summary_storage_path,rows_raw,rows_1hz,start_at,end_at,duration_hours,distance_nm,avg_sog_kts,p95_sog_kts,max_sog_kts"
const SESSION_VAKAROS_SAVED_TRIMS_SELECT_COLUMNS =
  "id,upload_id,name,trim_start_index,trim_end_index,buoys,created_at"
const GEAR_ITEMS_SELECT_COLUMNS = "id,name,gear_type,status,condition,serial_number,barcode"
const SESSION_GEAR_USAGE_SELECT_COLUMNS = "gear_item_id"
const TEAM_SETUP_ITEMS_SELECT_COLUMNS =
  "id,key,label,input_kind,metric_group,is_fixed,is_required,position,is_active"
const TEAM_SETUP_ITEM_OPTIONS_SELECT_COLUMNS =
  "id,team_setup_item_id,value,label,position,is_active"
const SESSION_SETUP_ITEM_VALUES_SELECT_COLUMNS = "id,team_setup_item_id,text_value"
const SESSION_SETUP_ITEM_SELECTED_OPTIONS_SELECT_COLUMNS =
  "session_setup_item_value_id,team_setup_item_option_id,allocation_percent"
const TEAM_STANDARD_MOVES_SELECT_COLUMNS = "id,name,description,is_active"
const SESSION_STANDARD_MOVES_SELECT_COLUMNS = "session_id,team_standard_move_id"
const TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS = "id,name,description,is_active"
const SESSION_WIND_PATTERNS_SELECT_COLUMNS = "session_id,team_venue_wind_pattern_id"
const SESSION_DETAIL_SHELL_SELECT = `
  ${SESSION_SELECT_COLUMNS},
  camps (
    ${CAMP_SELECT_COLUMNS},
    team_venues (
      ${TEAM_VENUE_SELECT_COLUMNS},
      teams (${TEAM_SELECT_COLUMNS}),
      venues (${VENUE_SELECT_COLUMNS})
    )
  )
`
const SESSION_DETAIL_ASSET_PAGE_SIZE = 24
const SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE = 30
const SESSION_DETAIL_GEAR_CATALOG_PAGE_SIZE = 24
const SESSION_ASSET_SIGNED_URL_SECONDS = 5 * 60
const CATALOG_LINKED_ID_MAX = 200
const CATALOG_SEARCH_MAX_LENGTH = 80
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_DETAIL_GEAR_TYPE_FILTERS: SessionDetailGearTypeFilter[] = [
  "all",
  "sails",
  "spars_and_foils",
  "running_rigging",
  "hardware_and_fittings",
]

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

type SessionAssetOptionalColumns = Pick<
  SessionAssetRow,
  | "description"
  | "thumbnail_bucket"
  | "thumbnail_storage_path"
  | "thumbnail_mime_type"
  | "thumbnail_size_bytes"
>

type SessionAssetQueryRow = Omit<SessionAssetRow, keyof SessionAssetOptionalColumns> &
  Partial<SessionAssetOptionalColumns>

type SessionAssetTypeFilter = "photo" | "analytics_file" | "gps_file"

export type SessionDetailShellData = Pick<
  SessionDetailData,
  "team" | "venue" | "camp" | "session"
>

export type SessionDetailDeferredData = Omit<
  SessionDetailData,
  "team" | "venue" | "camp" | "session"
>

type SessionDetailScopedInput = {
  activeOrganizationId: string
  activeTeamId: string
  teamVenueId: string
  sessionId: string
}

type SessionDetailShellJoinedRow = SessionRow & {
  camps:
    | (CampRow & {
        team_venues:
          | (TeamVenueRow & {
              teams: TeamRow | null
              venues: VenueRow | null
            })
          | null
      })
    | null
}

export function resolveSessionDetailGearTypeFilter(
  value: string | null | undefined,
): SessionDetailGearTypeFilter {
  if (!value) {
    return "all"
  }

  return SESSION_DETAIL_GEAR_TYPE_FILTERS.includes(value as SessionDetailGearTypeFilter)
    ? (value as SessionDetailGearTypeFilter)
    : "all"
}

function buildAssetContentUrl(input: {
  activeOrganizationId: string
  activeTeamId: string
  assetId: string
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrganizationId)
  params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId)

  return `/api/session-assets/${encodeURIComponent(input.assetId)}/content?${params.toString()}`
}

function buildGpsArtifactUrl(input: {
  activeOrganizationId: string
  activeTeamId: string
  assetId: string
  kind: "raw" | "series_1hz" | "summary" | "track_geojson"
  download?: boolean
}): string {
  const params = new URLSearchParams()
  params.set("kind", input.kind)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrganizationId)
  params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId)

  if (input.download) {
    params.set("download", "1")
  }

  return `/api/session-gps-files/${encodeURIComponent(input.assetId)}/artifact?${params.toString()}`
}

function buildStorageKey(input: {
  bucket: string
  storagePath: string
}): string {
  return `${input.bucket}\n${input.storagePath}`
}

function createSessionDetailScopedLogger(input: {
  activeTeamId: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  phase: string
  sessionId: string
  startedAt: number
}) {
  return (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logSessionDetailTiming({
      route: "/team-sessions/[id]",
      phase: input.phase,
      startedAt: input.startedAt,
      sessionId: input.sessionId,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        ...input.metadata,
        ...metadata,
      },
    })
  }
}

function throwSessionDetailScopedTimingError(
  logTiming: ReturnType<typeof createSessionDetailScopedLogger>,
  outcome: string,
  message: string,
): never {
  logTiming("error", outcome, message)
  throw new Error(message)
}

function isMissingSessionAssetThumbnailColumnError(message: string): boolean {
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes("session_assets.thumbnail_") &&
    normalizedMessage.includes("does not exist")
  )
}

function isMissingSessionAssetDescriptionColumnError(message: string): boolean {
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes("session_assets.description") &&
    normalizedMessage.includes("does not exist")
  )
}

function normalizeSessionAssetRow(row: SessionAssetQueryRow): SessionAssetRow {
  return {
    ...row,
    description: row.description ?? null,
    thumbnail_bucket: row.thumbnail_bucket ?? null,
    thumbnail_storage_path: row.thumbnail_storage_path ?? null,
    thumbnail_mime_type: row.thumbnail_mime_type ?? null,
    thumbnail_size_bytes: row.thumbnail_size_bytes ?? null,
  }
}

function buildSessionAssetsQuery(input: {
  assetLimit?: number
  assetOffset: number
  assetTypeFilter: SessionAssetTypeFilter
  selectColumns: string
  sessionId: string
  supabase: ServerSupabaseClient
}) {
  const assetLimit = Math.max(
    1,
    Math.floor(input.assetLimit ?? SESSION_DETAIL_ASSET_PAGE_SIZE),
  )
  const query = input.supabase
    .from("session_assets")
    .select(input.selectColumns, { count: "exact" })
    .eq("session_id", input.sessionId)

  return query
    .eq("asset_type", input.assetTypeFilter)
    .order("created_at", { ascending: false })
    .range(input.assetOffset, input.assetOffset + assetLimit - 1)
}

async function loadSessionAssetPage(input: {
  assetLimit?: number
  assetOffset: number
  assetTypeFilter: SessionAssetTypeFilter
  sessionId: string
  supabase: ServerSupabaseClient
}): Promise<{
  assetTotalCount: number
  assets: SessionAssetRow[]
  thumbnailColumnsAvailable: boolean
}> {
  const thumbnailResult = await buildSessionAssetsQuery({
    ...input,
    selectColumns: SESSION_ASSETS_WITH_THUMBNAILS_SELECT_COLUMNS,
  })

  if (!thumbnailResult.error) {
    return {
      assetTotalCount: thumbnailResult.count ?? thumbnailResult.data?.length ?? 0,
      assets: ((thumbnailResult.data ?? []) as unknown as SessionAssetQueryRow[]).map(
        normalizeSessionAssetRow,
      ),
      thumbnailColumnsAvailable: true,
    }
  }

  if (
    !isMissingSessionAssetThumbnailColumnError(thumbnailResult.error.message) &&
    !isMissingSessionAssetDescriptionColumnError(thumbnailResult.error.message)
  ) {
    throw new Error(thumbnailResult.error.message)
  }

  const descriptionResult = await buildSessionAssetsQuery({
    ...input,
    selectColumns: SESSION_ASSETS_WITH_DESCRIPTION_SELECT_COLUMNS,
  })

  if (!descriptionResult.error) {
    return {
      assetTotalCount: descriptionResult.count ?? descriptionResult.data?.length ?? 0,
      assets: ((descriptionResult.data ?? []) as unknown as SessionAssetQueryRow[]).map(
        normalizeSessionAssetRow,
      ),
      thumbnailColumnsAvailable: false,
    }
  }

  if (!isMissingSessionAssetDescriptionColumnError(descriptionResult.error.message)) {
    throw new Error(descriptionResult.error.message)
  }

  const baseResult = await buildSessionAssetsQuery({
    ...input,
    selectColumns: SESSION_ASSETS_BASE_SELECT_COLUMNS,
  })

  if (baseResult.error) {
    throw new Error(baseResult.error.message)
  }

  return {
    assetTotalCount: baseResult.count ?? baseResult.data?.length ?? 0,
    assets: ((baseResult.data ?? []) as unknown as SessionAssetQueryRow[]).map(
      normalizeSessionAssetRow,
    ),
    thumbnailColumnsAvailable: false,
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeCatalogSearch(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CATALOG_SEARCH_MAX_LENGTH)
}

function normalizeCatalogOffset(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

function normalizeCatalogLinkedIds(ids: string[] | null | undefined): string[] {
  return [...new Set(ids ?? [])]
    .filter((id) => UUID_PATTERN.test(id))
    .slice(0, CATALOG_LINKED_ID_MAX)
}

function buildCatalogPage(input: {
  limit: number
  offset: number
  rowCount: number
  search: string
  totalCount: number
}): SessionDetailCatalogPage {
  const nextOffset = input.offset + input.rowCount

  return {
    limit: input.limit,
    nextOffset: nextOffset < input.totalCount ? nextOffset : null,
    offset: input.offset,
    search: input.search,
    totalCount: input.totalCount,
  }
}

function buildDeferredCatalogPage(limit: number): SessionDetailCatalogPage {
  return {
    limit,
    nextOffset: 0,
    offset: 0,
    search: "",
    totalCount: 0,
  }
}

function sortCatalogRowsByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name))
}

function mergeCatalogRowsById<T extends { id: string; name: string }>(
  primaryRows: T[],
  extraRows: T[],
): T[] {
  const rowsById = new Map<string, T>()

  for (const row of [...primaryRows, ...extraRows]) {
    rowsById.set(row.id, row)
  }

  return sortCatalogRowsByName([...rowsById.values()])
}

function mapGearAlertRowsByItemId(rows: TeamGearAlertRow[]): Map<string, TeamGearAlertRow> {
  const rowsByItemId = new Map<string, TeamGearAlertRow>()

  for (const row of rows) {
    rowsByItemId.set(row.gear_item_id, row)
  }

  return rowsByItemId
}

function mapGearItem(row: GearItemRow, alertRow?: TeamGearAlertRow): SessionDetailGearItem {
  return {
    ...row,
    alertState: alertRow?.alert_state ?? "none",
    triggeredAlertCount: Number(alertRow?.triggered_alert_count ?? 0),
    usageCount: Number(alertRow?.usage_count ?? 0),
    usageMinutes: Number(alertRow?.usage_minutes ?? 0),
  }
}

async function hydrateGearItemsWithAlertState(input: {
  activeTeamId: string
  gearItems: GearItemRow[]
  supabase: ServerSupabaseClient
}): Promise<SessionDetailGearItem[]> {
  if (input.gearItems.length === 0) {
    return []
  }

  const gearItemIds = input.gearItems.map((gearItem) => gearItem.id)
  const { data, error } = await input.supabase.rpc("get_team_gear_alert_rows", {
    p_gear_item_ids: gearItemIds,
    p_team_id: input.activeTeamId,
  })

  if (error) {
    throw new Error(`Could not load gear alert states: ${error.message}`)
  }

  const alertRowsByItemId = mapGearAlertRowsByItemId(data ?? [])

  return input.gearItems.map((gearItem) =>
    mapGearItem(gearItem, alertRowsByItemId.get(gearItem.id)),
  )
}

function mapStandardMove(row: TeamStandardMoveRow): SessionDetailStandardMove {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
  }
}

function mapWindPattern(row: TeamVenueWindPatternRow): SessionDetailWindPattern {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
  }
}

async function queryLinkedStandardMoves(input: {
  activeTeamId: string
  linkedStandardMoveIds: string[]
  supabase: ServerSupabaseClient
}): Promise<SessionDetailStandardMove[]> {
  const linkedStandardMoveIds = normalizeCatalogLinkedIds(input.linkedStandardMoveIds)

  if (linkedStandardMoveIds.length === 0) {
    return []
  }

  const { data, error } = await input.supabase
    .from("team_standard_moves")
    .select(TEAM_STANDARD_MOVES_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .in("id", linkedStandardMoveIds)

  if (error) {
    throw new Error(`Could not load linked standard moves: ${error.message}`)
  }

  return sortCatalogRowsByName(((data ?? []) as TeamStandardMoveRow[]).map(mapStandardMove))
}

async function queryLinkedWindPatterns(input: {
  linkedWindPatternIds: string[]
  supabase: ServerSupabaseClient
  teamVenueId: string
}): Promise<SessionDetailWindPattern[]> {
  const linkedWindPatternIds = normalizeCatalogLinkedIds(input.linkedWindPatternIds)

  if (linkedWindPatternIds.length === 0) {
    return []
  }

  const { data, error } = await input.supabase
    .from("team_venue_wind_patterns")
    .select(TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS)
    .eq("team_venue_id", input.teamVenueId)
    .in("id", linkedWindPatternIds)

  if (error) {
    throw new Error(`Could not load linked wind patterns: ${error.message}`)
  }

  return sortCatalogRowsByName(((data ?? []) as TeamVenueWindPatternRow[]).map(mapWindPattern))
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

function buildInfo(input: {
  review: SessionReviewRow | null
  setup: SessionSetupRow | null
  standardMoveNames: string[]
  windPatternNames: string[]
}): SessionDetailInfo {
  return {
    bestOfSession: normalizeText(input.review?.best_of_session),
    toWork: normalizeText(input.review?.to_work),
    standardMoves: input.standardMoveNames,
    windPatterns: input.windPatternNames,
    legacyWindPatterns: formatJsonNote(input.review?.wind_patterns),
    freeNotes: normalizeText(input.setup?.free_notes),
  }
}

function buildResults(row: SessionRegattaResultRow | null): SessionDetailResults {
  return {
    resultNotes: normalizeText(row?.result_notes),
  }
}

async function querySessionDetailStandardMovesCatalog(input: {
  activeTeamId: string
  linkedStandardMoveIds?: string[]
  offset?: number
  search?: string | null
  supabase: ServerSupabaseClient
}): Promise<SessionDetailStandardMovesCatalogData> {
  const offset = normalizeCatalogOffset(input.offset)
  const search = normalizeCatalogSearch(input.search)
  const baseQuery = input.supabase
    .from("team_standard_moves")
    .select(TEAM_STANDARD_MOVES_SELECT_COLUMNS, { count: "exact" })
    .eq("team_id", input.activeTeamId)
    .eq("is_active", true)
  const filteredQuery =
    search.length > 0 ? baseQuery.ilike("name", `%${search}%`) : baseQuery
  const { count, data: pageRowsData, error: pageRowsError } = await filteredQuery
    .order("name", { ascending: true })
    .range(offset, offset + SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE - 1)

  if (pageRowsError) {
    throw new Error(`Could not load standard move catalog: ${pageRowsError.message}`)
  }

  const linkedStandardMoveIds = normalizeCatalogLinkedIds(input.linkedStandardMoveIds)
  let linkedRows: TeamStandardMoveRow[] = []

  if (linkedStandardMoveIds.length > 0) {
    const { data: linkedRowsData, error: linkedRowsError } = await input.supabase
      .from("team_standard_moves")
      .select(TEAM_STANDARD_MOVES_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .in("id", linkedStandardMoveIds)

    if (linkedRowsError) {
      throw new Error(`Could not load linked standard moves: ${linkedRowsError.message}`)
    }

    linkedRows = (linkedRowsData ?? []) as TeamStandardMoveRow[]
  }

  const pageRows = (pageRowsData ?? []) as TeamStandardMoveRow[]
  const mergedRows = mergeCatalogRowsById(pageRows, linkedRows)

  return {
    availableStandardMoves: mergedRows.map(mapStandardMove),
    standardMoveCatalogPage: buildCatalogPage({
      limit: SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE,
      offset,
      rowCount: pageRows.length,
      search,
      totalCount: count ?? pageRows.length,
    }),
  }
}

async function querySessionDetailWindPatternsCatalog(input: {
  linkedWindPatternIds?: string[]
  offset?: number
  search?: string | null
  supabase: ServerSupabaseClient
  teamVenueId: string
}): Promise<SessionDetailWindPatternsCatalogData> {
  const offset = normalizeCatalogOffset(input.offset)
  const search = normalizeCatalogSearch(input.search)
  const baseQuery = input.supabase
    .from("team_venue_wind_patterns")
    .select(TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS, { count: "exact" })
    .eq("team_venue_id", input.teamVenueId)
    .eq("is_active", true)
  const filteredQuery =
    search.length > 0 ? baseQuery.ilike("name", `%${search}%`) : baseQuery
  const { count, data: pageRowsData, error: pageRowsError } = await filteredQuery
    .order("name", { ascending: true })
    .range(offset, offset + SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE - 1)

  if (pageRowsError) {
    throw new Error(`Could not load wind pattern catalog: ${pageRowsError.message}`)
  }

  const linkedWindPatternIds = normalizeCatalogLinkedIds(input.linkedWindPatternIds)
  let linkedRows: TeamVenueWindPatternRow[] = []

  if (linkedWindPatternIds.length > 0) {
    const { data: linkedRowsData, error: linkedRowsError } = await input.supabase
      .from("team_venue_wind_patterns")
      .select(TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS)
      .eq("team_venue_id", input.teamVenueId)
      .in("id", linkedWindPatternIds)

    if (linkedRowsError) {
      throw new Error(`Could not load linked wind patterns: ${linkedRowsError.message}`)
    }

    linkedRows = (linkedRowsData ?? []) as TeamVenueWindPatternRow[]
  }

  const pageRows = (pageRowsData ?? []) as TeamVenueWindPatternRow[]
  const mergedRows = mergeCatalogRowsById(pageRows, linkedRows)

  return {
    availableWindPatterns: mergedRows.map(mapWindPattern),
    windPatternCatalogPage: buildCatalogPage({
      limit: SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE,
      offset,
      rowCount: pageRows.length,
      search,
      totalCount: count ?? pageRows.length,
    }),
  }
}

async function querySessionDetailGearCatalog(input: {
  activeTeamId: string
  gearType?: SessionDetailGearTypeFilter
  linkedGearItemIds?: string[]
  offset?: number
  search?: string | null
  supabase: ServerSupabaseClient
}): Promise<SessionDetailGearCatalogData> {
  const gearType = input.gearType ?? "all"
  const offset = normalizeCatalogOffset(input.offset)
  const search = normalizeCatalogSearch(input.search)
  const baseQuery = input.supabase
    .from("gear_items")
    .select(GEAR_ITEMS_SELECT_COLUMNS, { count: "exact" })
    .eq("team_id", input.activeTeamId)
  const typeQuery =
    gearType === "all" ? baseQuery : baseQuery.eq("gear_type", gearType)
  const filteredQuery =
    search.length > 0
      ? typeQuery.or(
          `name.ilike.%${search}%,serial_number.ilike.%${search}%,barcode.ilike.%${search}%`,
        )
      : typeQuery
  const { count, data: pageRowsData, error: pageRowsError } = await filteredQuery
    .order("name", { ascending: true })
    .range(offset, offset + SESSION_DETAIL_GEAR_CATALOG_PAGE_SIZE - 1)

  if (pageRowsError) {
    throw new Error(`Could not load gear catalog: ${pageRowsError.message}`)
  }

  const linkedGearItemIds = normalizeCatalogLinkedIds(input.linkedGearItemIds)
  let linkedRows: GearItemRow[] = []

  if (linkedGearItemIds.length > 0) {
    const { data: linkedRowsData, error: linkedRowsError } = await input.supabase
      .from("gear_items")
      .select(GEAR_ITEMS_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .in("id", linkedGearItemIds)

    if (linkedRowsError) {
      throw new Error(`Could not load linked gear items: ${linkedRowsError.message}`)
    }

    linkedRows = (linkedRowsData ?? []) as GearItemRow[]
  }

  const pageRows = (pageRowsData ?? []) as GearItemRow[]
  const mergedRows = mergeCatalogRowsById(pageRows, linkedRows)
  const gearItems = await hydrateGearItemsWithAlertState({
    activeTeamId: input.activeTeamId,
    gearItems: mergedRows,
    supabase: input.supabase,
  })

  return {
    gearCatalogPage: buildCatalogPage({
      limit: SESSION_DETAIL_GEAR_CATALOG_PAGE_SIZE,
      offset,
      rowCount: pageRows.length,
      search,
      totalCount: count ?? pageRows.length,
    }),
    gearItems,
    gearType,
  }
}

export async function getSessionDetailStandardMovesCatalogData(input: {
  activeTeamId: string
  linkedStandardMoveIds?: string[]
  offset?: number
  search?: string | null
}): Promise<SessionDetailStandardMovesCatalogData> {
  const supabase = await createServerSupabaseClient()

  return querySessionDetailStandardMovesCatalog({
    ...input,
    supabase,
  })
}

export async function getSessionDetailWindPatternsCatalogData(input: {
  linkedWindPatternIds?: string[]
  offset?: number
  search?: string | null
  teamVenueId: string
}): Promise<SessionDetailWindPatternsCatalogData> {
  const supabase = await createServerSupabaseClient()

  return querySessionDetailWindPatternsCatalog({
    ...input,
    supabase,
  })
}

export async function getSessionDetailGearCatalogData(input: {
  activeTeamId: string
  gearType?: SessionDetailGearTypeFilter
  linkedGearItemIds?: string[]
  offset?: number
  search?: string | null
}): Promise<SessionDetailGearCatalogData> {
  const supabase = await createServerSupabaseClient()

  return querySessionDetailGearCatalog({
    ...input,
    supabase,
  })
}

export async function getSessionDetailGearItemByBarcode(input: {
  activeTeamId: string
  barcode: string
}): Promise<SessionDetailGearItem | null> {
  const barcode = normalizeCatalogSearch(input.barcode)

  if (barcode.length === 0) {
    return null
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("gear_items")
    .select(GEAR_ITEMS_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .ilike("barcode", barcode)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not load gear item by barcode: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const [gearItem] = await hydrateGearItemsWithAlertState({
    activeTeamId: input.activeTeamId,
    gearItems: [data as GearItemRow],
    supabase,
  })

  return gearItem ?? null
}

function attachAssetContentUrls(input: {
  activeOrganizationId: string
  activeTeamId: string
  assets: SessionAssetRow[]
}): SessionDetailAsset[] {
  return input.assets.map((asset) => ({
    ...asset,
    contentUrl: buildAssetContentUrl({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      assetId: asset.id,
    }),
    signedUrl: null,
    thumbnailSignedUrl: null,
  }))
}

function mapVakarosUploadsByAssetId(
  rows: SessionVakarosUploadRow[],
): Map<string, SessionVakarosUploadRow> {
  const rowsByAssetId = new Map<string, SessionVakarosUploadRow>()

  for (const row of rows) {
    rowsByAssetId.set(row.asset_id, row)
  }

  return rowsByAssetId
}

function mapVakarosSavedTrim(row: SessionVakarosSavedTrimRow): SessionDetailVakarosSavedTrim | null {
  const buoys = normalizeVakarosSavedTrimBuoys(row.buoys)

  if (!buoys) {
    return null
  }

  return {
    id: row.id,
    buoys,
    createdAt: row.created_at,
    name: row.name,
    trimEnd: row.trim_end_index,
    trimStart: row.trim_start_index,
  }
}

function mapVakarosSavedTrimsByUploadId(
  rows: SessionVakarosSavedTrimRow[],
): Map<string, SessionDetailVakarosSavedTrim[]> {
  const rowsByUploadId = new Map<string, SessionDetailVakarosSavedTrim[]>()

  for (const row of rows) {
    const savedTrim = mapVakarosSavedTrim(row)

    if (!savedTrim) {
      continue
    }

    const savedTrims = rowsByUploadId.get(row.upload_id) ?? []
    savedTrims.push(savedTrim)
    rowsByUploadId.set(row.upload_id, savedTrims)
  }

  return rowsByUploadId
}

async function loadVakarosSavedTrimRows(input: {
  supabase: ServerSupabaseClient
  uploadIds: string[]
}): Promise<SessionVakarosSavedTrimRow[]> {
  if (input.uploadIds.length === 0) {
    return []
  }

  const { data, error } = await input.supabase
    .from("session_vakaros_saved_trims")
    .select(SESSION_VAKAROS_SAVED_TRIMS_SELECT_COLUMNS)
    .in("upload_id", input.uploadIds)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Could not load saved Vakaros trims: ${error.message}`)
  }

  return (data ?? []) as SessionVakarosSavedTrimRow[]
}

function attachGpsFileContentUrls(input: {
  activeOrganizationId: string
  activeTeamId: string
  assets: SessionAssetRow[]
  savedTrimRows: SessionVakarosSavedTrimRow[]
  vakarosUploads: SessionVakarosUploadRow[]
}): SessionDetailGpsFile[] {
  const uploadsByAssetId = mapVakarosUploadsByAssetId(input.vakarosUploads)
  const savedTrimsByUploadId = mapVakarosSavedTrimsByUploadId(input.savedTrimRows)

  return input.assets.map((asset) => {
    const upload = uploadsByAssetId.get(asset.id)

    return {
      ...asset,
      contentUrl: buildGpsArtifactUrl({
        activeOrganizationId: input.activeOrganizationId,
        activeTeamId: input.activeTeamId,
        assetId: asset.id,
        kind: "series_1hz",
      }),
      gpsArtifacts: {
        series1HzUrl: buildGpsArtifactUrl({
          activeOrganizationId: input.activeOrganizationId,
          activeTeamId: input.activeTeamId,
          assetId: asset.id,
          kind: "series_1hz",
        }),
        summaryUrl: buildGpsArtifactUrl({
          activeOrganizationId: input.activeOrganizationId,
          activeTeamId: input.activeTeamId,
          assetId: asset.id,
          kind: "summary",
          download: true,
        }),
        trackGeojsonUrl: buildGpsArtifactUrl({
          activeOrganizationId: input.activeOrganizationId,
          activeTeamId: input.activeTeamId,
          assetId: asset.id,
          kind: "track_geojson",
        }),
      },
      signedUrl: null,
      thumbnailSignedUrl: null,
      vakaros: upload
        ? {
            uploadId: upload.id,
            avgSogKts: Number(upload.avg_sog_kts),
            distanceNm: Number(upload.distance_nm),
            durationHours: Number(upload.duration_hours),
            endAt: upload.end_at,
            maxSogKts: Number(upload.max_sog_kts),
            p95SogKts: Number(upload.p95_sog_kts),
            rows1Hz: upload.rows_1hz,
            rowsRaw: upload.rows_raw,
            savedTrims: savedTrimsByUploadId.get(upload.id) ?? [],
            startAt: upload.start_at,
          }
        : null,
    }
  })
}

export async function getSessionDetailHeaderGpsFile(input: {
  activeOrganizationId: string
  activeTeamId: string
  sessionId: string
}): Promise<SessionDetailGpsFile | null> {
  const supabase = await createServerSupabaseClient()
  const gpsAssetPage = await loadSessionAssetPage({
    assetLimit: 1,
    assetOffset: 0,
    assetTypeFilter: "gps_file",
    sessionId: input.sessionId,
    supabase,
  })
  const gpsAsset = gpsAssetPage.assets[0]

  if (!gpsAsset) {
    return null
  }

  const { data: vakarosRows, error: vakarosError } = await supabase
    .from("session_vakaros_uploads")
    .select(SESSION_VAKAROS_UPLOADS_SELECT_COLUMNS)
    .eq("session_id", input.sessionId)
    .eq("asset_id", gpsAsset.id)
    .limit(1)

  if (vakarosError) {
    throw new Error(`Could not load header Vakaros metadata: ${vakarosError.message}`)
  }

  const vakarosUploads = (vakarosRows ?? []) as SessionVakarosUploadRow[]

  if (vakarosUploads.length === 0) {
    return null
  }

  const savedTrimRows = await loadVakarosSavedTrimRows({
    supabase,
    uploadIds: vakarosUploads.map((upload) => upload.id),
  })

  return (
    attachGpsFileContentUrls({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      assets: [gpsAsset],
      savedTrimRows,
      vakarosUploads,
    })[0] ?? null
  )
}

async function createStorageSignedUrlMap(input: {
  supabase: ServerSupabaseClient
  targets: Array<{
    bucket: string
    storagePath: string
  }>
}): Promise<Map<string, string>> {
  const pathsByBucket = new Map<string, Set<string>>()

  for (const target of input.targets) {
    const paths = pathsByBucket.get(target.bucket) ?? new Set<string>()
    paths.add(target.storagePath)
    pathsByBucket.set(target.bucket, paths)
  }

  const signedUrlsByStorageKey = new Map<string, string>()

  for (const [bucket, paths] of pathsByBucket) {
    const { data, error } = await input.supabase.storage
      .from(bucket)
      .createSignedUrls(Array.from(paths), SESSION_ASSET_SIGNED_URL_SECONDS)

    if (error) {
      throw new Error(`Could not create signed asset URLs: ${error.message}`)
    }

    for (const signedUrl of data ?? []) {
      if (!signedUrl.path || !signedUrl.signedUrl || signedUrl.error) {
        continue
      }

      signedUrlsByStorageKey.set(
        buildStorageKey({
          bucket,
          storagePath: signedUrl.path,
        }),
        signedUrl.signedUrl,
      )
    }
  }

  return signedUrlsByStorageKey
}

async function attachImageAssetUrls(input: {
  activeOrganizationId: string
  activeTeamId: string
  assets: SessionAssetRow[]
  supabase: ServerSupabaseClient
}): Promise<SessionDetailAsset[]> {
  const signedUrlTargets = input.assets.flatMap((asset) => {
    const targets = [
      {
        bucket: asset.bucket,
        storagePath: asset.storage_path,
      },
    ]

    if (asset.thumbnail_bucket && asset.thumbnail_storage_path) {
      targets.unshift({
        bucket: asset.thumbnail_bucket,
        storagePath: asset.thumbnail_storage_path,
      })
    }

    return targets
  })
  const signedUrlsByStorageKey = await createStorageSignedUrlMap({
    supabase: input.supabase,
    targets: signedUrlTargets,
  })

  return input.assets.map((asset) => {
    const signedUrl =
      signedUrlsByStorageKey.get(
        buildStorageKey({
          bucket: asset.bucket,
          storagePath: asset.storage_path,
        }),
      ) ?? null
    const thumbnailSignedUrl =
      asset.thumbnail_bucket && asset.thumbnail_storage_path
        ? signedUrlsByStorageKey.get(
            buildStorageKey({
              bucket: asset.thumbnail_bucket,
              storagePath: asset.thumbnail_storage_path,
            }),
          ) ?? null
        : null

    return {
      ...asset,
      contentUrl: buildAssetContentUrl({
        activeOrganizationId: input.activeOrganizationId,
        activeTeamId: input.activeTeamId,
        assetId: asset.id,
      }),
      signedUrl,
      thumbnailSignedUrl,
    }
  })
}

function buildSetupDialogItems(input: {
  teamSetupItems: TeamSetupItemRow[]
  teamSetupItemOptions: TeamSetupItemOptionRow[]
  sessionSetupValues: SessionSetupItemValueRow[]
  sessionSetupSelectedOptions: SessionSetupItemSelectedOptionRow[]
}): SessionSetupDialogItem[] {
  const optionsByItemId = new Map<string, TeamSetupItemOptionRow[]>()

  for (const option of input.teamSetupItemOptions) {
    const existingOptions = optionsByItemId.get(option.team_setup_item_id) ?? []
    existingOptions.push(option)
    optionsByItemId.set(option.team_setup_item_id, existingOptions)
  }

  const valueByItemId = new Map<string, SessionSetupItemValueRow>()

  for (const value of input.sessionSetupValues) {
    valueByItemId.set(value.team_setup_item_id, value)
  }

  const selectedOptionsByValueId = new Map<
    string,
    Array<{ optionId: string; allocationPercent: number | null }>
  >()

  for (const selectedOption of input.sessionSetupSelectedOptions) {
    const existingOptions =
      selectedOptionsByValueId.get(selectedOption.session_setup_item_value_id) ?? []
    existingOptions.push({
      optionId: selectedOption.team_setup_item_option_id,
      allocationPercent:
        typeof selectedOption.allocation_percent === "number"
          ? selectedOption.allocation_percent
          : null,
    })
    selectedOptionsByValueId.set(selectedOption.session_setup_item_value_id, existingOptions)
  }

  return input.teamSetupItems
    .filter((item) => item.is_active)
    .sort((left, right) => left.position - right.position)
    .map((item) => {
      const currentValue = valueByItemId.get(item.id)
      const selectedOptions = currentValue
        ? (selectedOptionsByValueId.get(currentValue.id) ?? [])
        : []
      const textValue = normalizeText(currentValue?.text_value) ?? ""

      return {
        id: item.id,
        key: item.key,
        label: item.label,
        inputKind: item.input_kind,
        metricGroup: item.metric_group,
        isFixed: item.is_fixed,
        isRequired: item.is_required,
        position: item.position,
        options: (optionsByItemId.get(item.id) ?? [])
          .filter((option) => option.is_active)
          .sort((left, right) => left.position - right.position)
          .map((option) => ({
            id: option.id,
            value: option.value,
            label: option.label,
          })),
        selectedOptions,
        textValue,
      }
    })
}

export async function getSessionDetailShellData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  sessionId: string
}): Promise<SessionDetailShellData | null> {
  const startedAt = startSessionDetailTiming()
  const logShellTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
  ) => {
    logSessionDetailTiming({
      route: "/team-sessions/[id]",
      phase: "load_shell",
      startedAt,
      sessionId: input.sessionId,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        activeOrganizationId: input.activeOrganizationId,
        queryShape: "joined_shell",
      },
    })
  }
  const throwShellTimingError = (outcome: string, message: string): never => {
    logShellTiming("error", outcome, message)
    throw new Error(message)
  }

  if (!input.activeTeamId) {
    logShellTiming("error", "missing_active_team")
    return null
  }

  const supabase = await createServerSupabaseClient()
  const { data, error: shellError } = await supabase
    .from("sessions")
    .select(SESSION_DETAIL_SHELL_SELECT)
    .eq("id", input.sessionId)
    .maybeSingle()

  if (shellError) {
    throwShellTimingError(
      "shell_query_error",
      `Could not load session detail shell: ${shellError.message}`,
    )
  }

  const shellRow = data as SessionDetailShellJoinedRow | null

  if (!shellRow) {
    logShellTiming("success", "session_not_found")
    return null
  }

  const { camps: campRow, ...sessionRow } = shellRow
  const session: SessionDetailSession = sessionRow

  if (!campRow) {
    logShellTiming("success", "camp_not_found")
    return null
  }

  const { team_venues: teamVenueRow, ...camp } = campRow

  if (!teamVenueRow || teamVenueRow.team_id !== input.activeTeamId) {
    logShellTiming("success", "team_venue_not_found")
    return null
  }

  const { teams: teamRow, venues: venueRow } = teamVenueRow

  if (
    !teamRow ||
    !venueRow ||
    teamRow.organization_id !== input.activeOrganizationId ||
    venueRow.organization_id !== input.activeOrganizationId
  ) {
    logShellTiming("success", "team_or_venue_not_found")
    return null
  }

  const shellData = {
    team: teamRow,
    venue: venueRow,
    camp,
    session,
  }

  logShellTiming("success", "loaded")
  return shellData
}

export async function getSessionDetailInfoTabData(
  input: SessionDetailScopedInput,
): Promise<SessionDetailInfoTabData> {
  const startedAt = startSessionDetailTiming()
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "info",
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()

  const [
    { data: reviewRow, error: reviewError },
    { data: setupRow, error: setupError },
    { data: sessionStandardMovesData, error: sessionStandardMovesError },
    { data: sessionWindPatternsData, error: sessionWindPatternsError },
  ] = await Promise.all([
    supabase
      .from("session_reviews")
      .select(SESSION_REVIEW_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .maybeSingle(),
    supabase
      .from("session_setups")
      .select(SESSION_SETUP_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .maybeSingle(),
    supabase
      .from("session_standard_moves")
      .select(SESSION_STANDARD_MOVES_SELECT_COLUMNS)
      .eq("session_id", input.sessionId),
    supabase
      .from("session_wind_patterns")
      .select(SESSION_WIND_PATTERNS_SELECT_COLUMNS)
      .eq("session_id", input.sessionId),
  ])

  if (reviewError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "review_query_error",
      `Could not load review for session detail: ${reviewError.message}`,
    )
  }

  if (setupError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "setup_query_error",
      `Could not load setup for session detail: ${setupError.message}`,
    )
  }

  if (sessionStandardMovesError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_standard_moves_query_error",
      `Could not load session standard move links for session detail: ${sessionStandardMovesError.message}`,
    )
  }

  if (sessionWindPatternsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_wind_patterns_query_error",
      `Could not load session wind pattern links for session detail: ${sessionWindPatternsError.message}`,
    )
  }

  const sessionStandardMoves = (sessionStandardMovesData ?? []) as SessionStandardMoveRow[]
  const sessionWindPatterns = (sessionWindPatternsData ?? []) as SessionWindPatternRow[]
  const rawLinkedStandardMoveIds = [
    ...new Set(sessionStandardMoves.map((row) => row.team_standard_move_id)),
  ]
  const rawLinkedWindPatternIds = [
    ...new Set(sessionWindPatterns.map((row) => row.team_venue_wind_pattern_id)),
  ]
  let linkedStandardMoves: SessionDetailStandardMove[]
  let linkedWindPatterns: SessionDetailWindPattern[]

  try {
    ;[linkedStandardMoves, linkedWindPatterns] = await Promise.all([
      queryLinkedStandardMoves({
        activeTeamId: input.activeTeamId,
        linkedStandardMoveIds: rawLinkedStandardMoveIds,
        supabase,
      }),
      queryLinkedWindPatterns({
        linkedWindPatternIds: rawLinkedWindPatternIds,
        supabase,
        teamVenueId: input.teamVenueId,
      }),
    ])
  } catch (error) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "catalog_query_error",
      getSessionDetailTimingErrorMessage(error),
    )
  }

  const standardMoveById = new Map(
    linkedStandardMoves.map((standardMove) => [
      standardMove.id,
      standardMove,
    ]),
  )
  const linkedStandardMoveIds = rawLinkedStandardMoveIds.filter((standardMoveId) =>
    standardMoveById.has(standardMoveId),
  )
  const linkedStandardMoveNames = linkedStandardMoveIds
    .map((standardMoveId) => standardMoveById.get(standardMoveId)?.name ?? null)
    .filter((standardMoveName): standardMoveName is string => standardMoveName !== null)
    .sort((left, right) => left.localeCompare(right))
  const windPatternById = new Map(
    linkedWindPatterns.map((windPattern) => [
      windPattern.id,
      windPattern,
    ]),
  )
  const linkedWindPatternIds = rawLinkedWindPatternIds.filter((windPatternId) =>
    windPatternById.has(windPatternId),
  )
  const linkedWindPatternNames = linkedWindPatternIds
    .map((windPatternId) => windPatternById.get(windPatternId)?.name ?? null)
    .filter((windPatternName): windPatternName is string => windPatternName !== null)
    .sort((left, right) => left.localeCompare(right))

  const tabData: SessionDetailInfoTabData = {
    info: buildInfo({
      review: (reviewRow as SessionReviewRow | null) ?? null,
      setup: (setupRow as SessionSetupRow | null) ?? null,
      standardMoveNames: linkedStandardMoveNames,
      windPatternNames: linkedWindPatternNames,
    }),
    availableStandardMoves: linkedStandardMoves,
    linkedStandardMoveIds,
    standardMoveCatalogPage: buildDeferredCatalogPage(
      SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE,
    ),
    availableWindPatterns: linkedWindPatterns,
    linkedWindPatternIds,
    windPatternCatalogPage: buildDeferredCatalogPage(
      SESSION_DETAIL_INFO_CATALOG_PAGE_SIZE,
    ),
  }

  logTabTiming("success", "loaded", undefined, {
    standardMoveCount: tabData.availableStandardMoves.length,
    standardMoveTotalCount: tabData.standardMoveCatalogPage.totalCount,
    windPatternCount: tabData.availableWindPatterns.length,
    windPatternTotalCount: tabData.windPatternCatalogPage.totalCount,
  })

  return tabData
}

export async function getSessionDetailResultsTabData(
  input: SessionDetailScopedInput,
): Promise<SessionDetailResultsTabData> {
  const startedAt = startSessionDetailTiming()
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "results",
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()
  const { data: regattaResultRow, error: regattaResultError } = await supabase
    .from("session_regatta_results")
    .select(SESSION_REGATTA_RESULTS_SELECT_COLUMNS)
    .eq("session_id", input.sessionId)
    .maybeSingle()

  if (regattaResultError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "regatta_result_query_error",
      `Could not load regatta result for session detail: ${regattaResultError.message}`,
    )
  }

  const tabData: SessionDetailResultsTabData = {
    results: buildResults((regattaResultRow as SessionRegattaResultRow | null) ?? null),
  }

  logTabTiming("success", "loaded")
  return tabData
}

export async function getSessionDetailImagesTabData(
  input: SessionDetailScopedInput & { assetOffset?: number },
): Promise<SessionDetailImagesTabData> {
  const startedAt = startSessionDetailTiming()
  const assetOffset = Math.max(0, input.assetOffset ?? 0)
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "images",
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()
  let assetPage: Awaited<ReturnType<typeof loadSessionAssetPage>>

  try {
    assetPage = await loadSessionAssetPage({
      assetOffset,
      assetTypeFilter: "photo",
      sessionId: input.sessionId,
      supabase,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown asset query error"
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "assets_query_error",
      `Could not load image assets for session detail: ${message}`,
    )
  }

  const images = await attachImageAssetUrls({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    assets: assetPage.assets,
    supabase,
  })

  logTabTiming("success", "loaded", undefined, {
    assetCount: images.length,
    assetOffset,
    assetTotalCount: assetPage.assetTotalCount,
    signedUrlCount: images.filter((asset) => Boolean(asset.signedUrl)).length,
    thumbnailUrlCount: images.filter((asset) => Boolean(asset.thumbnailSignedUrl)).length,
    thumbnailColumnsAvailable: assetPage.thumbnailColumnsAvailable,
  })
  return {
    images,
    assetLimit: SESSION_DETAIL_ASSET_PAGE_SIZE,
    assetOffset,
    assetTotalCount: assetPage.assetTotalCount,
  }
}

export async function getSessionDetailAnalyticsTabData(
  input: SessionDetailScopedInput & { assetOffset?: number },
): Promise<SessionDetailAnalyticsTabData> {
  const startedAt = startSessionDetailTiming()
  const assetOffset = Math.max(0, input.assetOffset ?? 0)
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "analytics",
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()
  let assetPage: Awaited<ReturnType<typeof loadSessionAssetPage>>
  let gpsAssetPage: Awaited<ReturnType<typeof loadSessionAssetPage>>

  try {
    ;[assetPage, gpsAssetPage] = await Promise.all([
      loadSessionAssetPage({
        assetOffset,
        assetTypeFilter: "analytics_file",
        sessionId: input.sessionId,
        supabase,
      }),
      loadSessionAssetPage({
        assetOffset: 0,
        assetTypeFilter: "gps_file",
        sessionId: input.sessionId,
        supabase,
      }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown asset query error"
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "assets_query_error",
      `Could not load analytics assets for session detail: ${message}`,
    )
  }

  const analyticsFiles = attachAssetContentUrls({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    assets: assetPage.assets,
  })
  const gpsAssetIds = gpsAssetPage.assets.map((asset) => asset.id)
  let vakarosUploads: SessionVakarosUploadRow[] = []
  let savedTrimRows: SessionVakarosSavedTrimRow[] = []

  if (gpsAssetIds.length > 0) {
    const { data: vakarosRows, error: vakarosError } = await supabase
      .from("session_vakaros_uploads")
      .select(SESSION_VAKAROS_UPLOADS_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .in("asset_id", gpsAssetIds)

    if (vakarosError) {
      throwSessionDetailScopedTimingError(
        logTabTiming,
        "vakaros_metadata_query_error",
        `Could not load Vakaros metadata for session detail: ${vakarosError.message}`,
      )
    }

    vakarosUploads = (vakarosRows ?? []) as SessionVakarosUploadRow[]
  }

  if (vakarosUploads.length > 0) {
    try {
      savedTrimRows = await loadVakarosSavedTrimRows({
        supabase,
        uploadIds: vakarosUploads.map((upload) => upload.id),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown saved trims query error"
      throwSessionDetailScopedTimingError(
        logTabTiming,
        "vakaros_saved_trims_query_error",
        `Could not load saved GPS trims for session detail: ${message}`,
      )
    }
  }

  const gpsFiles = attachGpsFileContentUrls({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    assets: gpsAssetPage.assets,
    savedTrimRows,
    vakarosUploads,
  })

  logTabTiming("success", "loaded", undefined, {
    assetCount: analyticsFiles.length,
    assetOffset,
    assetTotalCount: assetPage.assetTotalCount,
    gpsFileCount: gpsFiles.length,
    gpsFileTotalCount: gpsAssetPage.assetTotalCount,
    signedUrlCount: 0,
    thumbnailColumnsAvailable: assetPage.thumbnailColumnsAvailable,
  })
  return {
    analyticsFiles,
    assetLimit: SESSION_DETAIL_ASSET_PAGE_SIZE,
    assetOffset,
    assetTotalCount: assetPage.assetTotalCount,
    gpsFiles,
    gpsFileTotalCount: gpsAssetPage.assetTotalCount,
  }
}

export async function getSessionDetailGearTabData(
  input: SessionDetailScopedInput,
): Promise<SessionDetailGearTabData> {
  const startedAt = startSessionDetailTiming()
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "gear",
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()
  const { data: sessionGearUsageData, error: sessionGearUsageError } = await supabase
    .from("session_gear_usage")
    .select(SESSION_GEAR_USAGE_SELECT_COLUMNS)
    .eq("session_id", input.sessionId)

  if (sessionGearUsageError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_gear_usage_query_error",
      `Could not load session gear usage for session detail: ${sessionGearUsageError.message}`,
    )
  }

  const sessionGearUsageRows: SessionGearUsageRow[] =
    (sessionGearUsageData ?? []) as SessionGearUsageRow[]
  const rawLinkedGearItemIds = [...new Set(sessionGearUsageRows.map((row) => row.gear_item_id))]
  let gearCatalog: SessionDetailGearCatalogData

  try {
    gearCatalog = await querySessionDetailGearCatalog({
      activeTeamId: input.activeTeamId,
      linkedGearItemIds: rawLinkedGearItemIds,
      supabase,
    })
  } catch (error) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "gear_catalog_query_error",
      getSessionDetailTimingErrorMessage(error),
    )
  }

  const gearItemIds = new Set(gearCatalog.gearItems.map((item) => item.id))
  const linkedGearItemIds = rawLinkedGearItemIds.filter((gearItemId) =>
    gearItemIds.has(gearItemId),
  )

  logTabTiming("success", "loaded", undefined, {
    gearItemCount: gearCatalog.gearItems.length,
    gearItemTotalCount: gearCatalog.gearCatalogPage.totalCount,
    linkedGearItemCount: linkedGearItemIds.length,
  })

  return {
    gearCatalogPage: gearCatalog.gearCatalogPage,
    gearItems: gearCatalog.gearItems,
    gearType: gearCatalog.gearType,
    linkedGearItemIds,
  }
}

export async function getSessionDetailSetupData(
  input: SessionDetailScopedInput,
): Promise<SessionDetailSetupData> {
  const startedAt = startSessionDetailTiming()
  const logSetupTiming = createSessionDetailScopedLogger({
    phase: "load_setup",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      teamVenueId: input.teamVenueId,
    },
  })
  const supabase = await createServerSupabaseClient()
  const [
    { data: teamSetupItemsData, error: teamSetupItemsError },
    { data: setupRowData, error: setupRowError },
  ] = await Promise.all([
    supabase
      .from("team_setup_items")
      .select(TEAM_SETUP_ITEMS_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("position", { ascending: true }),
    supabase
      .from("session_setups")
      .select(SESSION_SETUP_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .maybeSingle(),
  ])

  if (teamSetupItemsError) {
    throwSessionDetailScopedTimingError(
      logSetupTiming,
      "team_setup_items_query_error",
      `Could not load team setup items for session detail: ${teamSetupItemsError.message}`,
    )
  }

  if (setupRowError) {
    throwSessionDetailScopedTimingError(
      logSetupTiming,
      "setup_query_error",
      `Could not load setup for session detail: ${setupRowError.message}`,
    )
  }

  const teamSetupItems = (teamSetupItemsData ?? []) as TeamSetupItemRow[]
  const setupRow = setupRowData as SessionSetupRow | null
  const teamSetupItemIds = teamSetupItems.map((item) => item.id)
  let teamSetupItemOptions: TeamSetupItemOptionRow[] = []
  let sessionSetupValues: SessionSetupItemValueRow[] = []
  let sessionSetupSelectedOptions: SessionSetupItemSelectedOptionRow[] = []

  if (teamSetupItemIds.length > 0) {
    const [
      { data: setupOptionsData, error: setupOptionsError },
      { data: setupValuesData, error: setupValuesError },
    ] = await Promise.all([
      supabase
        .from("team_setup_item_options")
        .select(TEAM_SETUP_ITEM_OPTIONS_SELECT_COLUMNS)
        .in("team_setup_item_id", teamSetupItemIds)
        .order("position", { ascending: true }),
      supabase
        .from("session_setup_item_values")
        .select(SESSION_SETUP_ITEM_VALUES_SELECT_COLUMNS)
        .eq("session_id", input.sessionId)
        .in("team_setup_item_id", teamSetupItemIds),
    ])

    if (setupOptionsError) {
      throwSessionDetailScopedTimingError(
        logSetupTiming,
        "setup_options_query_error",
        `Could not load team setup options for session detail: ${setupOptionsError.message}`,
      )
    }

    if (setupValuesError) {
      throwSessionDetailScopedTimingError(
        logSetupTiming,
        "setup_values_query_error",
        `Could not load session setup values for session detail: ${setupValuesError.message}`,
      )
    }

    teamSetupItemOptions = (setupOptionsData ?? []) as TeamSetupItemOptionRow[]
    sessionSetupValues = (setupValuesData ?? []) as SessionSetupItemValueRow[]

    const setupValueIds = sessionSetupValues.map((value) => value.id)

    if (setupValueIds.length > 0) {
      const { data: selectedOptionsData, error: selectedOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .select(SESSION_SETUP_ITEM_SELECTED_OPTIONS_SELECT_COLUMNS)
        .in("session_setup_item_value_id", setupValueIds)

      if (selectedOptionsError) {
        throwSessionDetailScopedTimingError(
          logSetupTiming,
          "setup_selected_options_query_error",
          `Could not load session setup selected options: ${selectedOptionsError.message}`,
        )
      }

      sessionSetupSelectedOptions =
        (selectedOptionsData ?? []) as SessionSetupItemSelectedOptionRow[]
    }
  }

  const setupDialogItems = buildSetupDialogItems({
    teamSetupItems,
    teamSetupItemOptions,
    sessionSetupValues,
    sessionSetupSelectedOptions,
  })

  logSetupTiming("success", "loaded", undefined, {
    setupItemCount: teamSetupItems.length,
  })

  return {
    freeNotes: normalizeText(setupRow?.free_notes),
    setupDialogItems,
  }
}

export async function getSessionDetailGoalsTabData(input: {
  activeTeamId: string
  goals: string | null
  sessionId: string
  teamVenueId: string
}): Promise<SessionDetailGoalsTabData> {
  const startedAt = startSessionDetailTiming()
  const logTabTiming = createSessionDetailScopedLogger({
    phase: "load_tab",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      tab: "goals",
      teamVenueId: input.teamVenueId,
    },
  })

  logTabTiming("success", "loaded")
  return { goals: input.goals }
}

export async function getSessionDetailTabData(
  input: SessionDetailScopedInput & {
    assetOffset?: number
    goals: string | null
    tab: SessionDetailTab
  },
): Promise<SessionDetailTabPayload> {
  if (input.tab === "info") {
    return getSessionDetailInfoTabData(input)
  }

  if (input.tab === "goals") {
    return getSessionDetailGoalsTabData(input)
  }

  if (input.tab === "results") {
    return getSessionDetailResultsTabData(input)
  }

  if (input.tab === "images") {
    return getSessionDetailImagesTabData(input)
  }

  if (input.tab === "analytics") {
    return getSessionDetailAnalyticsTabData(input)
  }

  return getSessionDetailGearTabData(input)
}

export async function getSessionDetailDeferredData(
  input: SessionDetailScopedInput,
): Promise<SessionDetailDeferredData> {
  const startedAt = startSessionDetailTiming()
  const logDeferredTiming = createSessionDetailScopedLogger({
    phase: "load_deferred",
    startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.activeTeamId,
    metadata: {
      teamVenueId: input.teamVenueId,
    },
  })

  try {
    const [infoData, setupData, resultsData, imagesData, analyticsData, gearData] =
      await Promise.all([
        getSessionDetailInfoTabData(input),
        getSessionDetailSetupData(input),
        getSessionDetailResultsTabData(input),
        getSessionDetailImagesTabData(input),
        getSessionDetailAnalyticsTabData(input),
        getSessionDetailGearTabData(input),
      ])

    const deferredData: SessionDetailDeferredData = {
      ...infoData,
      ...setupData,
      ...resultsData,
      ...imagesData,
      ...analyticsData,
      ...gearData,
    }

    logDeferredTiming("success", "loaded", undefined, {
      imageCount: imagesData.images.length,
      analyticsFileCount: analyticsData.analyticsFiles.length,
      gpsFileCount: analyticsData.gpsFiles.length,
      gearItemCount: gearData.gearItems.length,
      setupItemCount: setupData.setupDialogItems.length,
      standardMoveCount: infoData.availableStandardMoves.length,
      windPatternCount: infoData.availableWindPatterns.length,
    })

    return deferredData
  } catch (error) {
    logDeferredTiming("error", "load_failed", getSessionDetailTimingErrorMessage(error))
    throw error
  }
}

export async function getSessionDetailData(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  sessionId: string
}): Promise<SessionDetailData | null> {
  const shellData = await getSessionDetailShellData(input)

  if (!shellData) {
    return null
  }

  const deferredData = await getSessionDetailDeferredData({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: shellData.team.id,
    teamVenueId: shellData.camp.team_venue_id,
    sessionId: shellData.session.id,
  })

  return {
    ...shellData,
    ...deferredData,
  }
}
