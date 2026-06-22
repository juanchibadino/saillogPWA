import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/types/database"
import type {
  SessionDetailAsset,
  SessionDetailCamp,
  SessionDetailData,
  SessionDetailGearItem,
  SessionDetailInfo,
  SessionDetailResults,
  SessionDetailSession,
  SessionSetupDialogItem,
  SessionDetailTeam,
  SessionDetailVenue,
} from "@/features/sessions/detail-types"

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

type SessionAssetRow = SessionDetailAsset
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
  "id,asset_type,bucket,storage_path,file_name,mime_type,size_bytes,created_at"
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

export type SessionDetailShellData = Pick<
  SessionDetailData,
  "team" | "venue" | "camp" | "session"
>

export type SessionDetailDeferredData = Omit<
  SessionDetailData,
  "team" | "venue" | "camp" | "session"
>

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
  if (!input.activeTeamId) {
    return null
  }

  const supabase = await createServerSupabaseClient()
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .eq("id", input.sessionId)
    .maybeSingle()

  if (sessionError) {
    throw new Error(`Could not load session detail: ${sessionError.message}`)
  }

  if (!sessionRow) {
    return null
  }

  const session: SessionDetailSession = sessionRow as SessionRow

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("id", session.camp_id)
    .maybeSingle()

  if (campError) {
    throw new Error(`Could not load camp for session detail: ${campError.message}`)
  }

  if (!campRow) {
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
    throw new Error(`Could not load team venue for session detail: ${teamVenueError.message}`)
  }

  if (!teamVenueRow) {
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
    throw new Error(`Could not load team for session detail: ${teamError.message}`)
  }

  if (venueError) {
    throw new Error(`Could not load venue for session detail: ${venueError.message}`)
  }

  if (!teamRow || !venueRow) {
    return null
  }

  const team: SessionDetailTeam = teamRow as TeamRow
  const venue: SessionDetailVenue = venueRow as VenueRow

  return {
    team,
    venue,
    camp,
    session,
  }
}

export async function getSessionDetailDeferredData(input: {
  activeTeamId: string
  teamVenueId: string
  sessionId: string
}): Promise<SessionDetailDeferredData> {
  const supabase = await createServerSupabaseClient()

  const [
    { data: reviewRow, error: reviewError },
    { data: setupRow, error: setupError },
    { data: regattaResultRow, error: regattaResultError },
    { data: assetRows, error: assetsError },
    { data: gearItemsData, error: gearItemsError },
    { data: sessionGearUsageData, error: sessionGearUsageError },
    { data: teamSetupItemsData, error: teamSetupItemsError },
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
      .from("session_regatta_results")
      .select(SESSION_REGATTA_RESULTS_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .maybeSingle(),
    supabase
      .from("session_assets")
      .select(SESSION_ASSETS_SELECT_COLUMNS)
      .eq("session_id", input.sessionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("gear_items")
      .select(GEAR_ITEMS_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("name", { ascending: true }),
    supabase
      .from("session_gear_usage")
      .select(SESSION_GEAR_USAGE_SELECT_COLUMNS)
      .eq("session_id", input.sessionId),
    supabase
      .from("team_setup_items")
      .select(TEAM_SETUP_ITEMS_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .order("position", { ascending: true }),
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
    throw new Error(`Could not load review for session detail: ${reviewError.message}`)
  }

  if (setupError) {
    throw new Error(`Could not load setup for session detail: ${setupError.message}`)
  }

  if (regattaResultError) {
    throw new Error(`Could not load regatta result for session detail: ${regattaResultError.message}`)
  }

  if (assetsError) {
    throw new Error(`Could not load assets for session detail: ${assetsError.message}`)
  }

  if (gearItemsError) {
    throw new Error(`Could not load gear items for session detail: ${gearItemsError.message}`)
  }

  if (sessionGearUsageError) {
    throw new Error(
      `Could not load session gear usage for session detail: ${sessionGearUsageError.message}`,
    )
  }

  if (teamSetupItemsError) {
    throw new Error(
      `Could not load team setup items for session detail: ${teamSetupItemsError.message}`,
    )
  }

  if (teamStandardMovesError) {
    throw new Error(
      `Could not load team standard moves for session detail: ${teamStandardMovesError.message}`,
    )
  }

  if (sessionStandardMovesError) {
    throw new Error(
      `Could not load session standard move links for session detail: ${sessionStandardMovesError.message}`,
    )
  }

  if (teamVenueWindPatternsError) {
    throw new Error(
      `Could not load venue wind patterns for session detail: ${teamVenueWindPatternsError.message}`,
    )
  }

  if (sessionWindPatternsError) {
    throw new Error(
      `Could not load session wind pattern links for session detail: ${sessionWindPatternsError.message}`,
    )
  }

  const assets: SessionAssetRow[] = (assetRows ?? []) as SessionAssetRow[]
  const gearItems: GearItemRow[] = (gearItemsData ?? []) as GearItemRow[]
  const sessionGearUsageRows: SessionGearUsageRow[] =
    (sessionGearUsageData ?? []) as SessionGearUsageRow[]
  const teamSetupItems = (teamSetupItemsData ?? []) as TeamSetupItemRow[]
  const teamSetupItemIds = teamSetupItems.map((item) => item.id)
  const teamStandardMoves = (teamStandardMovesData ?? []) as TeamStandardMoveRow[]
  const sessionStandardMoves = (sessionStandardMovesData ?? []) as SessionStandardMoveRow[]
  const teamVenueWindPatterns =
    (teamVenueWindPatternsData ?? []) as TeamVenueWindPatternRow[]
  const sessionWindPatterns = (sessionWindPatternsData ?? []) as SessionWindPatternRow[]
  const gearItemIds = new Set(gearItems.map((item) => item.id))
  const linkedGearItemIds = [...new Set(sessionGearUsageRows.map((row) => row.gear_item_id))].filter(
    (gearItemId) => gearItemIds.has(gearItemId),
  )
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

  let teamSetupItemOptions: TeamSetupItemOptionRow[] = []
  let sessionSetupValues: SessionSetupItemValueRow[] = []
  let sessionSetupSelectedOptions: SessionSetupItemSelectedOptionRow[] = []

  if (teamSetupItemIds.length > 0) {
    const [{ data: setupOptionsData, error: setupOptionsError }, { data: setupValuesData, error: setupValuesError }] =
      await Promise.all([
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
      throw new Error(
        `Could not load team setup options for session detail: ${setupOptionsError.message}`,
      )
    }

    if (setupValuesError) {
      throw new Error(
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
        throw new Error(
          `Could not load session setup selected options: ${selectedOptionsError.message}`,
        )
      }

      sessionSetupSelectedOptions =
        (selectedOptionsData ?? []) as SessionSetupItemSelectedOptionRow[]
    }
  }

  return {
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
    results: buildResults((regattaResultRow as SessionRegattaResultRow | null) ?? null),
    setupDialogItems: buildSetupDialogItems({
      teamSetupItems,
      teamSetupItemOptions,
      sessionSetupValues,
      sessionSetupSelectedOptions,
    }),
    images: assets.filter((asset) => asset.asset_type === "photo"),
    analyticsFiles: assets.filter((asset) => asset.asset_type !== "photo"),
    gearItems,
    linkedGearItemIds,
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
    activeTeamId: shellData.team.id,
    teamVenueId: shellData.camp.team_venue_id,
    sessionId: shellData.session.id,
  })

  return {
    ...shellData,
    ...deferredData,
  }
}
