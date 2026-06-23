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
import type {
  SessionDetailAsset,
  SessionDetailAnalyticsTabData,
  SessionDetailCamp,
  SessionDetailData,
  SessionDetailGearItem,
  SessionDetailGearTabData,
  SessionDetailGoalsTabData,
  SessionDetailImagesTabData,
  SessionDetailInfo,
  SessionDetailInfoTabData,
  SessionDetailResultsTabData,
  SessionDetailResults,
  SessionDetailSetupData,
  SessionDetailSession,
  SessionDetailAssetMetadata,
  SessionSetupDialogItem,
  SessionDetailTabPayload,
  SessionDetailTeam,
  SessionDetailVenue,
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
  "id" | "name" | "team_venue_id"
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
type GearItemRow = SessionDetailGearItem
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
const CAMP_SELECT_COLUMNS = "id,name,team_venue_id"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const TEAM_SELECT_COLUMNS = "id,name,organization_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country,organization_id"
const SESSION_REVIEW_SELECT_COLUMNS = "session_id,best_of_session,to_work,wind_patterns"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"
const SESSION_REGATTA_RESULTS_SELECT_COLUMNS = "session_id,result_notes"
const SESSION_ASSETS_SELECT_COLUMNS =
  "id,asset_type,bucket,storage_path,file_name,mime_type,size_bytes,thumbnail_bucket,thumbnail_storage_path,thumbnail_mime_type,thumbnail_size_bytes,created_at"
const GEAR_ITEMS_SELECT_COLUMNS = "id,name,gear_type,status,condition,serial_number,barcode"
const SESSION_GEAR_USAGE_SELECT_COLUMNS = "gear_item_id"
const TEAM_SETUP_ITEMS_SELECT_COLUMNS =
  "id,key,label,input_kind,metric_group,is_fixed,position,is_active"
const TEAM_SETUP_ITEM_OPTIONS_SELECT_COLUMNS =
  "id,team_setup_item_id,value,label,position,is_active"
const SESSION_SETUP_ITEM_VALUES_SELECT_COLUMNS = "id,team_setup_item_id,text_value"
const SESSION_SETUP_ITEM_SELECTED_OPTIONS_SELECT_COLUMNS =
  "session_setup_item_value_id,team_setup_item_option_id,allocation_percent"
const TEAM_STANDARD_MOVES_SELECT_COLUMNS = "id,name,description,is_active"
const SESSION_STANDARD_MOVES_SELECT_COLUMNS = "session_id,team_standard_move_id"
const TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS = "id,name,description,is_active"
const SESSION_WIND_PATTERNS_SELECT_COLUMNS = "session_id,team_venue_wind_pattern_id"
const SESSION_DETAIL_ASSET_PAGE_SIZE = 24
const SESSION_ASSET_SIGNED_URL_SECONDS = 5 * 60

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

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
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .eq("id", input.sessionId)
    .maybeSingle()

  if (sessionError) {
    throwShellTimingError(
      "session_query_error",
      `Could not load session detail: ${sessionError.message}`,
    )
  }

  if (!sessionRow) {
    logShellTiming("success", "session_not_found")
    return null
  }

  const session: SessionDetailSession = sessionRow as SessionRow

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("id", session.camp_id)
    .maybeSingle()

  if (campError) {
    throwShellTimingError(
      "camp_query_error",
      `Could not load camp for session detail: ${campError.message}`,
    )
  }

  if (!campRow) {
    logShellTiming("success", "camp_not_found")
    return null
  }

  const camp: SessionDetailCamp = campRow as CampRow

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", camp.team_venue_id)
    .eq("team_id", input.activeTeamId)
    .maybeSingle()

  if (teamVenueError) {
    throwShellTimingError(
      "team_venue_query_error",
      `Could not load team venue for session detail: ${teamVenueError.message}`,
    )
  }

  if (!teamVenueRow) {
    logShellTiming("success", "team_venue_not_found")
    return null
  }

  const teamVenue: TeamVenueRow = teamVenueRow

  const [
    { data: teamRow, error: teamError },
    { data: venueRow, error: venueError },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select(TEAM_SELECT_COLUMNS)
      .eq("id", teamVenue.team_id)
      .eq("organization_id", input.activeOrganizationId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .eq("id", teamVenue.venue_id)
      .eq("organization_id", input.activeOrganizationId)
      .maybeSingle(),
  ])

  if (teamError) {
    throwShellTimingError(
      "team_query_error",
      `Could not load team for session detail: ${teamError.message}`,
    )
  }

  if (venueError) {
    throwShellTimingError(
      "venue_query_error",
      `Could not load venue for session detail: ${venueError.message}`,
    )
  }

  if (!teamRow || !venueRow) {
    logShellTiming("success", "team_or_venue_not_found")
    return null
  }

  const team: SessionDetailTeam = teamRow as TeamRow
  const venue: SessionDetailVenue = venueRow as VenueRow

  const shellData = {
    team,
    venue,
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
    { data: teamStandardMovesData, error: teamStandardMovesError },
    { data: sessionStandardMovesData, error: sessionStandardMovesError },
    { data: teamVenueWindPatternsData, error: teamVenueWindPatternsError },
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
      .from("team_standard_moves")
      .select(TEAM_STANDARD_MOVES_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("name", { ascending: true }),
    supabase
      .from("session_standard_moves")
      .select(SESSION_STANDARD_MOVES_SELECT_COLUMNS)
      .eq("session_id", input.sessionId),
    supabase
      .from("team_venue_wind_patterns")
      .select(TEAM_VENUE_WIND_PATTERNS_SELECT_COLUMNS)
      .eq("team_venue_id", input.teamVenueId)
      .order("name", { ascending: true }),
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

  if (teamStandardMovesError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "team_standard_moves_query_error",
      `Could not load team standard moves for session detail: ${teamStandardMovesError.message}`,
    )
  }

  if (sessionStandardMovesError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_standard_moves_query_error",
      `Could not load session standard move links for session detail: ${sessionStandardMovesError.message}`,
    )
  }

  if (teamVenueWindPatternsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "team_venue_wind_patterns_query_error",
      `Could not load venue wind patterns for session detail: ${teamVenueWindPatternsError.message}`,
    )
  }

  if (sessionWindPatternsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_wind_patterns_query_error",
      `Could not load session wind pattern links for session detail: ${sessionWindPatternsError.message}`,
    )
  }

  const teamStandardMoves = (teamStandardMovesData ?? []) as TeamStandardMoveRow[]
  const sessionStandardMoves = (sessionStandardMovesData ?? []) as SessionStandardMoveRow[]
  const teamVenueWindPatterns =
    (teamVenueWindPatternsData ?? []) as TeamVenueWindPatternRow[]
  const sessionWindPatterns = (sessionWindPatternsData ?? []) as SessionWindPatternRow[]
  const standardMoveById = new Map(
    teamStandardMoves.map((standardMove) => [standardMove.id, standardMove]),
  )
  const linkedStandardMoveIds = [
    ...new Set(sessionStandardMoves.map((row) => row.team_standard_move_id)),
  ].filter((standardMoveId) => standardMoveById.has(standardMoveId))
  const linkedStandardMoveNames = linkedStandardMoveIds
    .map((standardMoveId) => standardMoveById.get(standardMoveId)?.name ?? null)
    .filter((standardMoveName): standardMoveName is string => standardMoveName !== null)
    .sort((left, right) => left.localeCompare(right))
  const windPatternById = new Map(
    teamVenueWindPatterns.map((windPattern) => [windPattern.id, windPattern]),
  )
  const linkedWindPatternIds = [
    ...new Set(sessionWindPatterns.map((row) => row.team_venue_wind_pattern_id)),
  ].filter((windPatternId) => windPatternById.has(windPatternId))
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
    availableStandardMoves: teamStandardMoves.map((standardMove) => ({
      id: standardMove.id,
      name: standardMove.name,
      description: standardMove.description,
      isActive: standardMove.is_active,
    })),
    linkedStandardMoveIds,
    availableWindPatterns: teamVenueWindPatterns.map((windPattern) => ({
      id: windPattern.id,
      name: windPattern.name,
      description: windPattern.description,
      isActive: windPattern.is_active,
    })),
    linkedWindPatternIds,
  }

  logTabTiming("success", "loaded", undefined, {
    standardMoveCount: teamStandardMoves.length,
    windPatternCount: teamVenueWindPatterns.length,
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
  const { count: assetTotalCount, data: assetRows, error: assetsError } = await supabase
    .from("session_assets")
    .select(SESSION_ASSETS_SELECT_COLUMNS, { count: "exact" })
    .eq("session_id", input.sessionId)
    .eq("asset_type", "photo")
    .order("created_at", { ascending: false })
    .range(assetOffset, assetOffset + SESSION_DETAIL_ASSET_PAGE_SIZE - 1)

  if (assetsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "assets_query_error",
      `Could not load image assets for session detail: ${assetsError.message}`,
    )
  }

  const assets: SessionAssetRow[] = (assetRows ?? []) as SessionAssetRow[]
  const images = await attachImageAssetUrls({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    assets,
    supabase,
  })

  logTabTiming("success", "loaded", undefined, {
    assetCount: images.length,
    assetOffset,
    assetTotalCount: assetTotalCount ?? images.length,
    signedUrlCount: images.filter((asset) => Boolean(asset.signedUrl)).length,
    thumbnailUrlCount: images.filter((asset) => Boolean(asset.thumbnailSignedUrl)).length,
  })
  return {
    images,
    assetLimit: SESSION_DETAIL_ASSET_PAGE_SIZE,
    assetOffset,
    assetTotalCount: assetTotalCount ?? images.length,
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
  const { count: assetTotalCount, data: assetRows, error: assetsError } = await supabase
    .from("session_assets")
    .select(SESSION_ASSETS_SELECT_COLUMNS, { count: "exact" })
    .eq("session_id", input.sessionId)
    .neq("asset_type", "photo")
    .order("created_at", { ascending: false })
    .range(assetOffset, assetOffset + SESSION_DETAIL_ASSET_PAGE_SIZE - 1)

  if (assetsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "assets_query_error",
      `Could not load analytics assets for session detail: ${assetsError.message}`,
    )
  }

  const assets: SessionAssetRow[] = (assetRows ?? []) as SessionAssetRow[]
  const analyticsFiles = attachAssetContentUrls({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    assets,
  })

  logTabTiming("success", "loaded", undefined, {
    assetCount: analyticsFiles.length,
    assetOffset,
    assetTotalCount: assetTotalCount ?? analyticsFiles.length,
    signedUrlCount: 0,
  })
  return {
    analyticsFiles,
    assetLimit: SESSION_DETAIL_ASSET_PAGE_SIZE,
    assetOffset,
    assetTotalCount: assetTotalCount ?? analyticsFiles.length,
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
  const [
    { data: gearItemsData, error: gearItemsError },
    { data: sessionGearUsageData, error: sessionGearUsageError },
  ] = await Promise.all([
    supabase
      .from("gear_items")
      .select(GEAR_ITEMS_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("name", { ascending: true }),
    supabase
      .from("session_gear_usage")
      .select(SESSION_GEAR_USAGE_SELECT_COLUMNS)
      .eq("session_id", input.sessionId),
  ])

  if (gearItemsError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "gear_items_query_error",
      `Could not load gear items for session detail: ${gearItemsError.message}`,
    )
  }

  if (sessionGearUsageError) {
    throwSessionDetailScopedTimingError(
      logTabTiming,
      "session_gear_usage_query_error",
      `Could not load session gear usage for session detail: ${sessionGearUsageError.message}`,
    )
  }

  const gearItems: GearItemRow[] = (gearItemsData ?? []) as GearItemRow[]
  const sessionGearUsageRows: SessionGearUsageRow[] =
    (sessionGearUsageData ?? []) as SessionGearUsageRow[]
  const gearItemIds = new Set(gearItems.map((item) => item.id))
  const linkedGearItemIds = [
    ...new Set(sessionGearUsageRows.map((row) => row.gear_item_id)),
  ].filter((gearItemId) => gearItemIds.has(gearItemId))

  logTabTiming("success", "loaded", undefined, {
    gearItemCount: gearItems.length,
    linkedGearItemCount: linkedGearItemIds.length,
  })

  return {
    gearItems,
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
  const { data: teamSetupItemsData, error: teamSetupItemsError } = await supabase
    .from("team_setup_items")
    .select(TEAM_SETUP_ITEMS_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("position", { ascending: true })

  if (teamSetupItemsError) {
    throwSessionDetailScopedTimingError(
      logSetupTiming,
      "team_setup_items_query_error",
      `Could not load team setup items for session detail: ${teamSetupItemsError.message}`,
    )
  }

  const teamSetupItems = (teamSetupItemsData ?? []) as TeamSetupItemRow[]
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

  return { setupDialogItems }
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
