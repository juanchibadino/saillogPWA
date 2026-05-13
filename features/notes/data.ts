import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

const TEAM_NOTES_PAGE_SIZE = 12
const CONDITION_ITEM_KEYS = new Set(["tws", "twd", "sea_state", "conditions"])

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name"
>

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "camp_id" | "session_type" | "session_date" | "created_at"
>

type TeamSetupItemRow = Pick<
  Database["public"]["Tables"]["team_setup_items"]["Row"],
  "id" | "key" | "label" | "input_kind" | "position" | "is_active"
>

type TeamSetupItemOptionRow = Pick<
  Database["public"]["Tables"]["team_setup_item_options"]["Row"],
  "id" | "team_setup_item_id" | "label" | "position" | "is_active"
>

type SessionSetupItemValueRow = Pick<
  Database["public"]["Tables"]["session_setup_item_values"]["Row"],
  "id" | "session_id" | "team_setup_item_id" | "text_value"
>

type SessionSetupItemSelectedOptionRow = Pick<
  Database["public"]["Tables"]["session_setup_item_selected_options"]["Row"],
  "session_setup_item_value_id" | "team_setup_item_option_id"
>

type SessionReviewRow = Pick<
  Database["public"]["Tables"]["session_reviews"]["Row"],
  "session_id" | "best_of_session" | "to_work"
>

type SessionSetupRow = Pick<
  Database["public"]["Tables"]["session_setups"]["Row"],
  "session_id" | "free_notes"
>

const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country"
const CAMP_SELECT_COLUMNS = "id,team_venue_id,name"
const SESSION_SELECT_COLUMNS = "id,camp_id,session_type,session_date,created_at"
const TEAM_SETUP_ITEM_SELECT_COLUMNS = "id,key,label,input_kind,position,is_active"
const TEAM_SETUP_ITEM_OPTION_SELECT_COLUMNS =
  "id,team_setup_item_id,label,position,is_active"
const SESSION_SETUP_ITEM_VALUE_SELECT_COLUMNS =
  "id,session_id,team_setup_item_id,text_value"
const SESSION_SETUP_ITEM_SELECTED_OPTION_SELECT_COLUMNS =
  "session_setup_item_value_id,team_setup_item_option_id"
const SESSION_REVIEW_SELECT_COLUMNS = "session_id,best_of_session,to_work"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"

export type TeamNoteVenueFilterOption = {
  venueId: string
  venueName: string
  venueLocation: string
}

export type TeamNoteSetupMetric = {
  key: string
  label: string
  value: string
}

export type TeamNoteConditions = {
  tws: string[]
  twd: string[]
  seaState: string[]
  conditions: string[]
}

export type TeamNoteCard = {
  sessionId: string
  sessionDate: string
  sessionType: SessionRow["session_type"]
  venueId: string
  venueName: string
  campName: string
  conditions: TeamNoteConditions
  boatSetup: TeamNoteSetupMetric[]
  notes: {
    bestOfSession: string | null
    toWork: string | null
    freeNotes: string | null
  }
}

export type TeamNotesPageData = {
  cards: TeamNoteCard[]
  venueFilterOptions: TeamNoteVenueFilterOption[]
  twsFilterOptions: string[]
  conditionsFilterOptions: string[]
  selectedVenueId?: string
  selectedTwsValues: string[]
  selectedConditionsValues: string[]
  searchQuery: string
  currentPage: number
  hasNextPage: boolean
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function normalizeSearchQuery(value: string | undefined): string {
  if (!value) {
    return ""
  }

  return value.trim()
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function buildLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function normalizeSelectedId(input: {
  selectedId?: string
  allowedIds: Set<string>
}): string | undefined {
  if (!input.selectedId) {
    return undefined
  }

  if (!input.allowedIds.has(input.selectedId)) {
    return undefined
  }

  return input.selectedId
}

function normalizeSelectedValues(input: {
  values: string[]
  allowedValues: Set<string>
}): string[] {
  const uniqueValues = uniqueIds(input.values)
  return uniqueValues.filter((value) => input.allowedValues.has(value))
}

function includesAll(input: {
  expectedValues: string[]
  actualValues: string[]
}): boolean {
  if (input.expectedValues.length === 0) {
    return true
  }

  const actualSet = new Set(input.actualValues)

  for (const value of input.expectedValues) {
    if (!actualSet.has(value)) {
      return false
    }
  }

  return true
}

function buildSearchIndex(card: TeamNoteCard): string {
  const setupParts = card.boatSetup.map((entry) => `${entry.label} ${entry.value}`)

  return [
    card.venueName,
    card.campName,
    card.sessionDate,
    card.sessionType,
    card.conditions.tws.join(" "),
    card.conditions.twd.join(" "),
    card.conditions.seaState.join(" "),
    card.conditions.conditions.join(" "),
    setupParts.join(" "),
    card.notes.bestOfSession ?? "",
    card.notes.toWork ?? "",
    card.notes.freeNotes ?? "",
  ]
    .join(" ")
    .toLowerCase()
}

export async function getTeamNotesPageData(input: {
  activeTeamId: string
  selectedVenueId?: string
  selectedTwsValues: string[]
  selectedConditionsValues: string[]
  searchQuery?: string
  page: number
}): Promise<TeamNotesPageData> {
  const supabase = await createServerSupabaseClient()
  const currentPage = normalizePage(input.page)
  const searchQuery = normalizeSearchQuery(input.searchQuery)

  const { data: setupItemData, error: setupItemsError } = await supabase
    .from("team_setup_items")
    .select(TEAM_SETUP_ITEM_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .eq("is_active", true)
    .order("position", { ascending: true })

  if (setupItemsError) {
    throw new Error(`Could not load team setup items for notes: ${setupItemsError.message}`)
  }

  const setupItems: TeamSetupItemRow[] = setupItemData ?? []
  const setupItemIds = setupItems.map((item) => item.id)
  const setupItemById = new Map(setupItems.map((item) => [item.id, item]))

  let setupOptions: TeamSetupItemOptionRow[] = []

  if (setupItemIds.length > 0) {
    const { data: setupOptionData, error: setupOptionsError } = await supabase
      .from("team_setup_item_options")
      .select(TEAM_SETUP_ITEM_OPTION_SELECT_COLUMNS)
      .in("team_setup_item_id", setupItemIds)
      .eq("is_active", true)
      .order("position", { ascending: true })

    if (setupOptionsError) {
      throw new Error(
        `Could not load team setup item options for notes: ${setupOptionsError.message}`,
      )
    }

    setupOptions = setupOptionData ?? []
  }

  const optionsByItemId = new Map<string, TeamSetupItemOptionRow[]>()
  const optionById = new Map<string, TeamSetupItemOptionRow>()

  for (const option of setupOptions) {
    optionById.set(option.id, option)
    const existingOptions = optionsByItemId.get(option.team_setup_item_id) ?? []
    existingOptions.push(option)
    optionsByItemId.set(option.team_setup_item_id, existingOptions)
  }

  const twsItem = setupItems.find((item) => item.key === "tws")
  const conditionsItem = setupItems.find((item) => item.key === "conditions")

  const twsFilterOptions = (twsItem ? optionsByItemId.get(twsItem.id) ?? [] : []).map(
    (option) => option.label,
  )
  const conditionsFilterOptions = (
    conditionsItem ? optionsByItemId.get(conditionsItem.id) ?? [] : []
  ).map((option) => option.label)

  const selectedTwsValues = normalizeSelectedValues({
    values: input.selectedTwsValues,
    allowedValues: new Set(twsFilterOptions),
  })
  const selectedConditionsValues = normalizeSelectedValues({
    values: input.selectedConditionsValues,
    allowedValues: new Set(conditionsFilterOptions),
  })

  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load team venues for notes: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueRow[] = teamVenueData ?? []
  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))

  let venueRows: VenueRow[] = []

  if (venueIds.length > 0) {
    const { data, error: venueError } = await supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .in("id", venueIds)
      .order("name", { ascending: true })

    if (venueError) {
      throw new Error(`Could not load venues for notes: ${venueError.message}`)
    }

    venueRows = data ?? []
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))
  const teamVenueById = new Map(teamVenueRows.map((row) => [row.id, row]))

  const venueFilterOptions: TeamNoteVenueFilterOption[] = teamVenueRows
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        venueId: venue.id,
        venueName: venue.name,
        venueLocation: buildLocation(venue.city, venue.country),
      }
    })
    .filter((option): option is TeamNoteVenueFilterOption => option !== null)
    .sort((left, right) => left.venueName.localeCompare(right.venueName))

  const selectedVenueId = normalizeSelectedId({
    selectedId: input.selectedVenueId,
    allowedIds: new Set(venueFilterOptions.map((option) => option.venueId)),
  })

  const filteredTeamVenueRows = selectedVenueId
    ? teamVenueRows.filter((row) => row.venue_id === selectedVenueId)
    : teamVenueRows
  const filteredTeamVenueIds = filteredTeamVenueRows.map((row) => row.id)

  if (filteredTeamVenueIds.length === 0) {
    return {
      cards: [],
      venueFilterOptions,
      twsFilterOptions,
      conditionsFilterOptions,
      selectedVenueId,
      selectedTwsValues,
      selectedConditionsValues,
      searchQuery,
      currentPage,
      hasNextPage: false,
    }
  }

  const { data: campData, error: campError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("team_venue_id", filteredTeamVenueIds)

  if (campError) {
    throw new Error(`Could not load camps for notes: ${campError.message}`)
  }

  const campRows: CampRow[] = campData ?? []
  const campById = new Map(campRows.map((row) => [row.id, row]))
  const campIds = campRows.map((row) => row.id)

  if (campIds.length === 0) {
    return {
      cards: [],
      venueFilterOptions,
      twsFilterOptions,
      conditionsFilterOptions,
      selectedVenueId,
      selectedTwsValues,
      selectedConditionsValues,
      searchQuery,
      currentPage,
      hasNextPage: false,
    }
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .in("camp_id", campIds)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (sessionError) {
    throw new Error(`Could not load sessions for notes: ${sessionError.message}`)
  }

  const sessions: SessionRow[] = sessionData ?? []
  const sessionIds = sessions.map((session) => session.id)

  if (sessionIds.length === 0) {
    return {
      cards: [],
      venueFilterOptions,
      twsFilterOptions,
      conditionsFilterOptions,
      selectedVenueId,
      selectedTwsValues,
      selectedConditionsValues,
      searchQuery,
      currentPage,
      hasNextPage: false,
    }
  }

  let setupValues: SessionSetupItemValueRow[] = []
  let selectedOptions: SessionSetupItemSelectedOptionRow[] = []

  if (setupItemIds.length > 0) {
    const { data: setupValueData, error: setupValuesError } = await supabase
      .from("session_setup_item_values")
      .select(SESSION_SETUP_ITEM_VALUE_SELECT_COLUMNS)
      .in("session_id", sessionIds)
      .in("team_setup_item_id", setupItemIds)

    if (setupValuesError) {
      throw new Error(`Could not load session setup values for notes: ${setupValuesError.message}`)
    }

    setupValues = setupValueData ?? []
    const setupValueIds = setupValues.map((value) => value.id)

    if (setupValueIds.length > 0) {
      const { data: selectedOptionData, error: selectedOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .select(SESSION_SETUP_ITEM_SELECTED_OPTION_SELECT_COLUMNS)
        .in("session_setup_item_value_id", setupValueIds)

      if (selectedOptionsError) {
        throw new Error(
          `Could not load selected setup options for notes: ${selectedOptionsError.message}`,
        )
      }

      selectedOptions = selectedOptionData ?? []
    }
  }

  const [{ data: reviewData, error: reviewsError }, { data: setupData, error: setupsError }] =
    await Promise.all([
      supabase
        .from("session_reviews")
        .select(SESSION_REVIEW_SELECT_COLUMNS)
        .in("session_id", sessionIds),
      supabase
        .from("session_setups")
        .select(SESSION_SETUP_SELECT_COLUMNS)
        .in("session_id", sessionIds),
    ])

  if (reviewsError) {
    throw new Error(`Could not load session reviews for notes: ${reviewsError.message}`)
  }

  if (setupsError) {
    throw new Error(`Could not load session setups for notes: ${setupsError.message}`)
  }

  const reviewBySessionId = new Map<string, SessionReviewRow>(
    (reviewData ?? []).map((row) => [row.session_id, row]),
  )
  const sessionSetupBySessionId = new Map<string, SessionSetupRow>(
    (setupData ?? []).map((row) => [row.session_id, row]),
  )

  const selectedOptionIdsBySetupValueId = new Map<string, string[]>()

  for (const selectedOption of selectedOptions) {
    const existingOptionIds =
      selectedOptionIdsBySetupValueId.get(selectedOption.session_setup_item_value_id) ?? []
    existingOptionIds.push(selectedOption.team_setup_item_option_id)
    selectedOptionIdsBySetupValueId.set(
      selectedOption.session_setup_item_value_id,
      existingOptionIds,
    )
  }

  const setupValuesBySessionId = new Map<string, SessionSetupItemValueRow[]>()

  for (const setupValue of setupValues) {
    const existingValues = setupValuesBySessionId.get(setupValue.session_id) ?? []
    existingValues.push(setupValue)
    setupValuesBySessionId.set(setupValue.session_id, existingValues)
  }

  const filteredCards: TeamNoteCard[] = []

  for (const session of sessions) {
    const camp = campById.get(session.camp_id)

    if (!camp) {
      continue
    }

    const teamVenue = teamVenueById.get(camp.team_venue_id)

    if (!teamVenue) {
      continue
    }

    const venue = venueById.get(teamVenue.venue_id)

    if (!venue) {
      continue
    }

    const review = reviewBySessionId.get(session.id) ?? null
    const sessionSetup = sessionSetupBySessionId.get(session.id) ?? null
    const sessionSetupValues = setupValuesBySessionId.get(session.id) ?? []

    const conditions: TeamNoteConditions = {
      tws: [],
      twd: [],
      seaState: [],
      conditions: [],
    }
    const boatSetup: TeamNoteSetupMetric[] = []
    let hasSetupData = false

    for (const setupValue of sessionSetupValues) {
      const setupItem = setupItemById.get(setupValue.team_setup_item_id)

      if (!setupItem) {
        continue
      }

      const selectedIds = selectedOptionIdsBySetupValueId.get(setupValue.id) ?? []
      const selectedLabels = selectedIds
        .map((selectedId) => optionById.get(selectedId))
        .filter((option): option is TeamSetupItemOptionRow => option !== undefined)
        .sort((left, right) => left.position - right.position)
        .map((option) => option.label)

      const normalizedTextValue = normalizeText(setupValue.text_value)
      const hasValue = selectedLabels.length > 0 || normalizedTextValue !== null

      if (hasValue) {
        hasSetupData = true
      }

      if (setupItem.key === "tws") {
        conditions.tws = selectedLabels
        continue
      }

      if (setupItem.key === "twd") {
        conditions.twd = selectedLabels
        continue
      }

      if (setupItem.key === "sea_state") {
        conditions.seaState = selectedLabels
        continue
      }

      if (setupItem.key === "conditions") {
        conditions.conditions = selectedLabels
        continue
      }

      if (CONDITION_ITEM_KEYS.has(setupItem.key)) {
        continue
      }

      const setupValueLabel =
        setupItem.input_kind === "text"
          ? normalizedTextValue
          : normalizeText(selectedLabels.join(", "))

      if (!setupValueLabel) {
        continue
      }

      boatSetup.push({
        key: setupItem.key,
        label: setupItem.label,
        value: setupValueLabel,
      })
    }

    const bestOfSession = normalizeText(review?.best_of_session)
    const toWork = normalizeText(review?.to_work)
    const freeNotes = normalizeText(sessionSetup?.free_notes)
    const hasNotesData = Boolean(bestOfSession || toWork || freeNotes)

    if (!hasSetupData && !hasNotesData) {
      continue
    }

    if (
      !includesAll({
        expectedValues: selectedTwsValues,
        actualValues: conditions.tws,
      })
    ) {
      continue
    }

    if (
      !includesAll({
        expectedValues: selectedConditionsValues,
        actualValues: conditions.conditions,
      })
    ) {
      continue
    }

    const card: TeamNoteCard = {
      sessionId: session.id,
      sessionDate: session.session_date,
      sessionType: session.session_type,
      venueId: venue.id,
      venueName: venue.name,
      campName: camp.name,
      conditions,
      boatSetup,
      notes: {
        bestOfSession,
        toWork,
        freeNotes,
      },
    }

    if (searchQuery.length > 0 && !buildSearchIndex(card).includes(searchQuery.toLowerCase())) {
      continue
    }

    filteredCards.push(card)
  }

  const visibleCount = currentPage * TEAM_NOTES_PAGE_SIZE
  const hasNextPage = filteredCards.length > visibleCount
  const cards = filteredCards.slice(0, visibleCount)

  return {
    cards,
    venueFilterOptions,
    twsFilterOptions,
    conditionsFilterOptions,
    selectedVenueId,
    selectedTwsValues,
    selectedConditionsValues,
    searchQuery,
    currentPage,
    hasNextPage,
  }
}
