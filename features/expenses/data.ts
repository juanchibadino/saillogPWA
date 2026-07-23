import "server-only"

import { Buffer } from "node:buffer"

import {
  TEAM_EXPENSES_PAGE_SIZE,
  canMutateTeamExpense,
  resolveExpenseVisibilityScope,
} from "@/features/expenses/data-core.mjs"
import {
  COMMON_EXPENSE_CURRENCIES,
  TEAM_EXPENSE_TYPE_OPTIONS,
  formatCurrencyAmount,
  formatExpenseTypeLabel,
  normalizeCurrencyCode,
  type ExpenseType,
  type ExpenseVisibilityScope,
} from "@/features/expenses/shared"
import {
  normalizeTeamExpenseCrewFilter,
  normalizeTeamExpenseSelectedId,
  normalizeTeamExpenseType,
  normalizeTeamExpenseYear,
  resolveTeamExpensesPagination,
} from "@/features/expenses/list-route-state.mjs"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export { TEAM_EXPENSES_PAGE_SIZE }

type TeamExpenseRow = Pick<
  Database["public"]["Tables"]["team_expenses"]["Row"],
  | "id"
  | "team_id"
  | "team_venue_id"
  | "camp_id"
  | "created_by_profile_id"
  | "assigned_to_profile_id"
  | "expense_date"
  | "expense_year"
  | "vendor"
  | "expense_type"
  | "description"
  | "amount_local"
  | "currency_code"
  | "organization_currency_code"
  | "exchange_rate"
  | "exchange_rate_date"
  | "exchange_rate_source"
  | "amount_organization_currency"
  | "receipt_bucket"
  | "receipt_storage_path"
  | "receipt_file_name"
  | "receipt_thumbnail_bucket"
  | "receipt_thumbnail_storage_path"
  | "created_at"
  | "updated_at"
>
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
  "id" | "team_venue_id" | "name" | "start_date" | "end_date"
>
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "email"
>
type TeamMembershipRoleRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "role"
>
type TeamMembershipMemberRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "profile_id" | "role"
>
type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name" | "organization_id" | "expenses_show_team_totals"
>
type OrganizationRow = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "id" | "name" | "avatar_url" | "default_currency_code"
>
type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

const TEAM_EXPENSE_SELECT_COLUMNS =
  "id,team_id,team_venue_id,camp_id,created_by_profile_id,assigned_to_profile_id,expense_date,expense_year,vendor,expense_type,description,amount_local,currency_code,organization_currency_code,exchange_rate,exchange_rate_date,exchange_rate_source,amount_organization_currency,receipt_bucket,receipt_storage_path,receipt_file_name,receipt_thumbnail_bucket,receipt_thumbnail_storage_path,created_at,updated_at"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country"
const CAMP_SELECT_COLUMNS = "id,team_venue_id,name,start_date,end_date"
const PROFILE_SELECT_COLUMNS = "id,first_name,last_name,email"
const TEAM_MEMBERSHIP_ROLE_SELECT_COLUMNS = "role"
const TEAM_SELECT_COLUMNS = "id,name,organization_id,expenses_show_team_totals"
const ORGANIZATION_SELECT_COLUMNS = "id,name,avatar_url,default_currency_code"

export type TeamExpenseVenueOption = {
  label: string
  teamVenueId: string
  venueId: string
  venueName: string
}

export type TeamExpenseCampOption = {
  campId: string
  label: string
  teamVenueId: string
  year: number
}

export type TeamExpenseYearOption = {
  label: string
  year: number
}

export type TeamExpenseMemberOption = {
  label: string
  profileId: string
  role: Database["public"]["Enums"]["team_role_type"]
}

export type TeamExpenseCrewFilter = "all" | "you"

export type TeamExpenseListItem = {
  amountLabel: string
  amountLocal: number
  amountOrganizationCurrency: number
  canDelete: boolean
  canEdit: boolean
  campId: string | null
  campName: string | null
  convertedAmountLabel: string
  createdAt: string
  createdByName: string
  currencyCode: string
  description: string | null
  exchangeRate: number
  exchangeRateDate: string
  exchangeRateSource: string
  expenseDate: string
  expenseType: ExpenseType
  id: string
  organizationCurrencyCode: string
  assignedMemberName: string
  assignedToProfileId: string
  ownerName: string
  receiptDownloadUrl: string | null
  receiptFileName: string | null
  receiptUrl: string | null
  teamVenueId: string
  updatedAt: string
  vendor: string
  venueName: string
}

export type TeamExpenseMetrics = {
  myTotalLabel: string
  myTotalValue: number
  teamTotalLabel: string | null
  teamTotalValue: number | null
}

export type TeamExpensesChromeData = {
  campOptions: TeamExpenseCampOption[]
  canFilterByMember: boolean
  memberOptions: TeamExpenseMemberOption[]
  organizationCurrencyCode: string
  selectedCampId?: string
  selectedCrewFilter: TeamExpenseCrewFilter
  selectedMemberId?: string
  selectedType?: ExpenseType
  selectedVenueId?: string
  selectedVisibilityScope: ExpenseVisibilityScope
  selectedYear: number
  teamExpensesScopeLocked: boolean
  teamExpensesVisible: boolean
  typeOptions: Array<{ label: string; value: ExpenseType }>
  venueOptions: TeamExpenseVenueOption[]
  yearOptions: TeamExpenseYearOption[]
}

export type TeamExpensesResultsData = {
  currentPage: number
  expenses: TeamExpenseListItem[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  loadMoreMode: boolean
  metrics: TeamExpenseMetrics
  pageCount: number
}

export type TeamExpensesReportData = {
  campLabel: string | null
  expenses: TeamExpenseListItem[]
  exportedByName: string
  exportedByRole: string
  generatedAt: string
  metrics: TeamExpenseMetrics
  organizationCurrencyCode: string
  organizationLogoUrl: string | null
  organizationName: string
  receiptReferences: TeamExpenseReportReceiptReference[]
  selectedCrewLabel: string
  selectedMemberLabel: string | null
  selectedTypeLabel: string | null
  selectedVisibilityScope: ExpenseVisibilityScope
  selectedYear: number
  teamExpensesVisible: boolean
  teamName: string
  venueLabel: string | null
}

export type TeamExpenseReportReceiptReference = {
  dataUrl: string | null
  expenseId: string
  label: string
}

export type TeamExpenseFormOptions = {
  canAssignMembers: boolean
  currencyOptions: string[]
  defaultAssignedToProfileId: string
  memberOptions: TeamExpenseMemberOption[]
  organizationCurrencyCode: string
  typeOptions: Array<{ label: string; value: ExpenseType }>
  venueOptions: TeamExpenseVenueOption[]
}

function getCurrentYear(): number {
  return new Date().getUTCFullYear()
}

function resolveSelectedCrewFilter(input: {
  defaultCrewFilter?: TeamExpenseCrewFilter
  requestedCrewFilter?: string
  requestedScope?: string
  teamExpensesVisible: boolean
}): TeamExpenseCrewFilter {
  const requestedCrewFilter = normalizeTeamExpenseCrewFilter(
    input.requestedCrewFilter,
  ) as TeamExpenseCrewFilter | undefined

  if (!input.teamExpensesVisible) {
    return "you"
  }

  if (requestedCrewFilter) {
    return requestedCrewFilter
  }

  if (input.requestedScope === "mine") {
    return "you"
  }

  return input.defaultCrewFilter ?? "all"
}

function getVisibilityScopeForCrewFilter(
  crewFilter: TeamExpenseCrewFilter,
): ExpenseVisibilityScope {
  return crewFilter === "you" ? "mine" : "team"
}

function formatCrewSelectionLabel(input: {
  currentProfileLabel: string
  currentProfileId: string
  memberOptions: TeamExpenseMemberOption[]
  selectedMemberId?: string
  selectedVisibilityScope: ExpenseVisibilityScope
}): string {
  if (
    input.selectedVisibilityScope === "mine" ||
    input.selectedMemberId === input.currentProfileId
  ) {
    return input.currentProfileLabel
  }

  if (input.selectedMemberId) {
    return (
      input.memberOptions.find((option) => option.profileId === input.selectedMemberId)
        ?.label ?? "Selected member"
    )
  }

  return "All"
}

function parseYearFromDate(value: string): number {
  return Number.parseInt(value.slice(0, 4), 10)
}

function formatCampDateRange(input: { endDate: string; startDate: string }): string {
  return `${input.startDate} to ${input.endDate}`
}

function formatProfileName(profile: ProfileRow | undefined): string {
  if (!profile) {
    return "Unknown user"
  }

  const fullName = [profile.first_name, profile.last_name]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join(" ")

  return fullName || profile.email?.trim() || "Unknown user"
}

function formatMemberRoleLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildLocationLabel(venue: VenueRow): string {
  return `${venue.city}, ${venue.country}`
}

function buildExpenseReceiptUrl(input: {
  activeOrganizationId: string
  activeTeamId: string
  download?: boolean
  expenseId: string
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrganizationId)
  params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId)

  if (input.download) {
    params.set("download", "1")
  }

  return `/api/expenses/${encodeURIComponent(input.expenseId)}/receipt?${params.toString()}`
}

function resolveReceiptImageMimeType(input: {
  blobType: string
  fileName: string | null
  storagePath: string
}): string {
  const blobType = input.blobType.trim().toLowerCase()

  if (blobType.startsWith("image/")) {
    return blobType
  }

  const source = input.storagePath.toLowerCase()
  const fileName = input.fileName?.toLowerCase() ?? ""

  if (source.endsWith(".webp") || fileName.endsWith(".webp")) {
    return "image/webp"
  }

  if (source.endsWith(".png") || fileName.endsWith(".png")) {
    return "image/png"
  }

  if (
    source.endsWith(".jpg") ||
    source.endsWith(".jpeg") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg")
  ) {
    return "image/jpeg"
  }

  return "image/webp"
}

async function loadExpenseReceiptDataUrl(input: {
  row: TeamExpenseRow
  supabase: ServerSupabaseClient
}): Promise<string | null> {
  if (!input.row.receipt_bucket || !input.row.receipt_storage_path) {
    return null
  }

  const { data, error } = await input.supabase.storage
    .from(input.row.receipt_bucket)
    .download(input.row.receipt_storage_path)

  if (error || !data) {
    return null
  }

  const arrayBuffer = await data.arrayBuffer()
  const mimeType = resolveReceiptImageMimeType({
    blobType: data.type,
    fileName: input.row.receipt_file_name,
    storagePath: input.row.receipt_storage_path,
  })

  return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`
}

async function loadExpenseReportReceiptReferences(input: {
  rows: TeamExpenseRow[]
  supabase: ServerSupabaseClient
}): Promise<TeamExpenseReportReceiptReference[]> {
  const receiptRows = input.rows.filter(
    (row) => row.receipt_bucket && row.receipt_storage_path,
  )

  return Promise.all(
    receiptRows.map(async (row, index) => ({
      dataUrl: await loadExpenseReceiptDataUrl({
        row,
        supabase: input.supabase,
      }),
      expenseId: row.id,
      label: `Receipt ${index + 1}`,
    })),
  )
}

async function loadTeamAndOrganization(input: {
  activeOrganizationId: string
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<{ organization: OrganizationRow | null; team: TeamRow | null }> {
  const [
    { data: teamRow, error: teamError },
    { data: organizationRow, error: organizationError },
  ] = await Promise.all([
    input.supabase
      .from("teams")
      .select(TEAM_SELECT_COLUMNS)
      .eq("id", input.activeTeamId)
      .eq("organization_id", input.activeOrganizationId)
      .eq("is_active", true)
      .maybeSingle(),
    input.supabase
      .from("organizations")
      .select(ORGANIZATION_SELECT_COLUMNS)
      .eq("id", input.activeOrganizationId)
      .eq("is_active", true)
      .maybeSingle(),
  ])

  if (teamError) {
    throw new Error(`Could not load team expense settings: ${teamError.message}`)
  }

  if (organizationError) {
    throw new Error(`Could not load organization expense settings: ${organizationError.message}`)
  }

  return {
    organization: organizationRow as OrganizationRow | null,
    team: teamRow as TeamRow | null,
  }
}

async function loadExpenseContext(input: {
  activeOrganizationId: string
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<{
  campById: Map<string, CampRow>
  campOptions: TeamExpenseCampOption[]
  teamVenueById: Map<string, TeamVenueRow>
  venueByTeamVenueId: Map<string, VenueRow>
  venueOptions: TeamExpenseVenueOption[]
}> {
  const { data: teamVenueRows, error: teamVenueError } = await input.supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load expense venues: ${teamVenueError.message}`)
  }

  const teamVenues = (teamVenueRows ?? []) as TeamVenueRow[]
  const teamVenueById = new Map(teamVenues.map((row) => [row.id, row]))
  const venueIds = [...new Set(teamVenues.map((row) => row.venue_id))]
  const teamVenueIds = teamVenues.map((row) => row.id)

  const [
    { data: venueRows, error: venuesError },
    { data: campRows, error: campsError },
  ] = await Promise.all([
    venueIds.length > 0
      ? input.supabase
          .from("venues")
          .select(VENUE_SELECT_COLUMNS)
          .in("id", venueIds)
          .eq("organization_id", input.activeOrganizationId)
      : Promise.resolve({ data: [], error: null }),
    teamVenueIds.length > 0
      ? input.supabase
          .from("camps")
          .select(CAMP_SELECT_COLUMNS)
          .in("team_venue_id", teamVenueIds)
          .order("start_date", { ascending: false })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (venuesError) {
    throw new Error(`Could not load expense venue names: ${venuesError.message}`)
  }

  if (campsError) {
    throw new Error(`Could not load expense camps: ${campsError.message}`)
  }

  const venues = (venueRows ?? []) as VenueRow[]
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const venueByTeamVenueId = new Map<string, VenueRow>()

  for (const teamVenue of teamVenues) {
    const venue = venueById.get(teamVenue.venue_id)

    if (venue) {
      venueByTeamVenueId.set(teamVenue.id, venue)
    }
  }

  const venueOptions: TeamExpenseVenueOption[] = teamVenues
    .map((teamVenue) => {
      const venue = venueByTeamVenueId.get(teamVenue.id)

      if (!venue) {
        return null
      }

      return {
        label: `${venue.name} - ${buildLocationLabel(venue)}`,
        teamVenueId: teamVenue.id,
        venueId: venue.id,
        venueName: venue.name,
      }
    })
    .filter((option): option is TeamExpenseVenueOption => option !== null)
    .sort((left, right) => left.venueName.localeCompare(right.venueName))

  const camps = (campRows ?? []) as CampRow[]
  const campById = new Map(camps.map((camp) => [camp.id, camp]))
  const campOptions: TeamExpenseCampOption[] = camps.map((camp) => {
    const venue = venueByTeamVenueId.get(camp.team_venue_id)

    return {
      campId: camp.id,
      label: `${camp.name} - ${venue?.name ?? "Venue"} (${formatCampDateRange({
        startDate: camp.start_date,
        endDate: camp.end_date,
      })})`,
      teamVenueId: camp.team_venue_id,
      year: parseYearFromDate(camp.start_date),
    }
  })

  return {
    campById,
    campOptions,
    teamVenueById,
    venueByTeamVenueId,
    venueOptions,
  }
}

async function loadTeamExpenseMemberOptions(input: {
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<TeamExpenseMemberOption[]> {
  const { data: membershipRows, error: membershipsError } = await input.supabase
    .from("team_memberships")
    .select("profile_id,role")
    .eq("team_id", input.activeTeamId)
    .eq("is_active", true)
    .order("role", { ascending: true })

  if (membershipsError) {
    throw new Error(`Could not load expense team members: ${membershipsError.message}`)
  }

  const memberships = (membershipRows ?? []) as TeamMembershipMemberRow[]
  const profileById = await loadProfilesById({
    profileIds: memberships.map((membership) => membership.profile_id),
    supabase: input.supabase,
  })

  return memberships
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)

      return {
        label: `${formatProfileName(profile)} - ${formatMemberRoleLabel(membership.role)}`,
        profileId: membership.profile_id,
        role: membership.role,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}

async function loadYearOptions(input: {
  activeTeamId: string
  currentProfileId: string
  selectedVisibilityScope: ExpenseVisibilityScope
  supabase: ServerSupabaseClient
}): Promise<TeamExpenseYearOption[]> {
  let query = input.supabase
    .from("team_expenses")
    .select("expense_year")
    .eq("team_id", input.activeTeamId)
    .order("expense_year", { ascending: false })

  if (input.selectedVisibilityScope === "mine") {
    query = query.eq("assigned_to_profile_id", input.currentProfileId)
  }

  const { data: expenseYearRows, error: yearsError } = await query

  if (yearsError) {
    throw new Error(`Could not load expense years: ${yearsError.message}`)
  }

  const years = [...new Set((expenseYearRows ?? []).map((row) => row.expense_year))]

  if (years.length === 0) {
    years.push(getCurrentYear())
  }

  return years.sort((left, right) => right - left).map((year) => ({
    label: String(year),
    year,
  }))
}

export async function getTeamExpensesChromeData(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  currentProfileId: string
  requestedCampId?: string
  requestedCrewFilter?: string
  requestedMemberId?: string
  requestedScope?: string
  requestedType?: string
  requestedVenueId?: string
  requestedYear?: number
}): Promise<TeamExpensesChromeData> {
  const supabase = await createServerSupabaseClient()
  const [{ organization, team }, context, memberOptions] = await Promise.all([
    loadTeamAndOrganization({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadExpenseContext({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadTeamExpenseMemberOptions({
      activeTeamId: input.activeTeamId,
      supabase,
    }),
  ])

  const teamExpensesScopeLocked = input.canManageTeamFinance
  const teamExpensesVisible = input.canManageTeamFinance || (team?.expenses_show_team_totals ?? false)
  const selectedCrewFilter = resolveSelectedCrewFilter({
    defaultCrewFilter: input.canManageTeamFinance ? "all" : "you",
    requestedCrewFilter: input.requestedCrewFilter,
    requestedScope: input.requestedScope,
    teamExpensesVisible,
  })
  const memberIds = new Set(memberOptions.map((option) => option.profileId))
  const requestedMemberId = teamExpensesVisible
    ? normalizeTeamExpenseSelectedId(input.requestedMemberId, memberIds)
    : undefined
  const selectedMemberId =
    requestedMemberId ??
    (selectedCrewFilter === "you" && memberIds.has(input.currentProfileId)
      ? input.currentProfileId
      : undefined) ??
    (!teamExpensesVisible && memberIds.has(input.currentProfileId)
      ? input.currentProfileId
      : undefined)
  const selectedVisibilityScope = resolveExpenseVisibilityScope({
    requestedScope: teamExpensesVisible
      ? "team"
      : getVisibilityScopeForCrewFilter(selectedCrewFilter),
    forceTeamScope: false,
    teamTotalsEnabled: teamExpensesVisible,
  }) as ExpenseVisibilityScope
  const yearOptions = await loadYearOptions({
    activeTeamId: input.activeTeamId,
    currentProfileId: input.currentProfileId,
    selectedVisibilityScope,
    supabase,
  })
  const requestedYear = normalizeTeamExpenseYear(
    typeof input.requestedYear === "number" ? String(input.requestedYear) : undefined,
  )
  const selectedYear =
    typeof requestedYear === "number" &&
    (yearOptions.some((option) => option.year === requestedYear) || input.requestedYear)
      ? requestedYear
      : yearOptions[0]?.year ?? getCurrentYear()
  const selectedVenueId = normalizeTeamExpenseSelectedId(
    input.requestedVenueId,
    new Set(context.venueOptions.map((option) => option.teamVenueId)),
  )
  const campOptionsForSelection = selectedVenueId
    ? context.campOptions.filter((camp) => camp.teamVenueId === selectedVenueId)
    : context.campOptions
  const selectedCampId = normalizeTeamExpenseSelectedId(
    input.requestedCampId,
    new Set(campOptionsForSelection.map((camp) => camp.campId)),
  )

  return {
    campOptions: context.campOptions,
    canFilterByMember: teamExpensesVisible,
    memberOptions,
    organizationCurrencyCode: normalizeCurrencyCode(organization?.default_currency_code),
    selectedCampId,
    selectedCrewFilter,
    selectedMemberId,
    selectedType: normalizeTeamExpenseType(input.requestedType) as ExpenseType | undefined,
    selectedVenueId,
    selectedVisibilityScope,
    selectedYear,
    teamExpensesScopeLocked,
    teamExpensesVisible,
    typeOptions: TEAM_EXPENSE_TYPE_OPTIONS,
    venueOptions: context.venueOptions,
    yearOptions,
  }
}

function applyExpenseFilters<
  T extends {
    eq: (column: string, value: string | number) => T
    neq: (column: string, value: string | number) => T
  },
>(
  query: T,
  input: {
    currentProfileId: string
    selectedCampId?: string
    selectedCrewFilter: TeamExpenseCrewFilter
    selectedMemberId?: string
    selectedType?: ExpenseType
    selectedVenueId?: string
    selectedVisibilityScope: ExpenseVisibilityScope
    selectedYear: number
  },
) {
  let nextQuery = query

  nextQuery = nextQuery.eq("expense_year", input.selectedYear)

  if (input.selectedMemberId) {
    nextQuery = nextQuery.eq("assigned_to_profile_id", input.selectedMemberId)
  } else if (input.selectedCrewFilter === "you") {
    nextQuery = nextQuery.eq("assigned_to_profile_id", input.currentProfileId)
  } else if (input.selectedVisibilityScope === "mine") {
    nextQuery = nextQuery.eq("assigned_to_profile_id", input.currentProfileId)
  }

  if (input.selectedVenueId) {
    nextQuery = nextQuery.eq("team_venue_id", input.selectedVenueId)
  }

  if (input.selectedCampId) {
    nextQuery = nextQuery.eq("camp_id", input.selectedCampId)
  }

  if (input.selectedType) {
    nextQuery = nextQuery.eq("expense_type", input.selectedType)
  }

  return nextQuery
}

async function loadProfilesById(input: {
  profileIds: string[]
  supabase: ServerSupabaseClient
}): Promise<Map<string, ProfileRow>> {
  const profileIds = [...new Set(input.profileIds)]

  if (profileIds.length === 0) {
    return new Map()
  }

  const { data: profileRows, error: profilesError } = await input.supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .in("id", profileIds)

  if (profilesError) {
    throw new Error(`Could not load expense profiles: ${profilesError.message}`)
  }

  return new Map(((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
}

function mapExpenseRows(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  canManageTeamSessions: boolean
  campById: Map<string, CampRow>
  currentProfileId: string
  profileById: Map<string, ProfileRow>
  rows: TeamExpenseRow[]
  venueByTeamVenueId: Map<string, VenueRow>
}): TeamExpenseListItem[] {
  return input.rows.map((row) => {
    const receiptUrl = row.receipt_storage_path
      ? buildExpenseReceiptUrl({
          activeOrganizationId: input.activeOrganizationId,
          activeTeamId: input.activeTeamId,
          expenseId: row.id,
        })
      : null
    const canMutate = canMutateTeamExpense({
      actorProfileId: input.currentProfileId,
      assignedToProfileId: row.assigned_to_profile_id,
      canManageTeamFinance: input.canManageTeamFinance,
      canManageTeamSessions: input.canManageTeamSessions,
    })
    const assignedMemberName = formatProfileName(input.profileById.get(row.assigned_to_profile_id))

    return {
      amountLabel: formatCurrencyAmount({
        amount: Number(row.amount_local),
        currencyCode: row.currency_code,
      }),
      amountLocal: Number(row.amount_local),
      amountOrganizationCurrency: Number(row.amount_organization_currency),
      canDelete: canMutate,
      canEdit: canMutate,
      campId: row.camp_id,
      campName: row.camp_id ? input.campById.get(row.camp_id)?.name ?? null : null,
      convertedAmountLabel: formatCurrencyAmount({
        amount: Number(row.amount_organization_currency),
        currencyCode: row.organization_currency_code,
      }),
      createdAt: row.created_at,
      createdByName: formatProfileName(input.profileById.get(row.created_by_profile_id)),
      currencyCode: row.currency_code,
      description: row.description,
      exchangeRate: Number(row.exchange_rate),
      exchangeRateDate: row.exchange_rate_date,
      exchangeRateSource: row.exchange_rate_source,
      expenseDate: row.expense_date,
      expenseType: row.expense_type,
      id: row.id,
      organizationCurrencyCode: row.organization_currency_code,
      assignedMemberName,
      assignedToProfileId: row.assigned_to_profile_id,
      ownerName: assignedMemberName,
      receiptDownloadUrl: receiptUrl
        ? buildExpenseReceiptUrl({
            activeOrganizationId: input.activeOrganizationId,
            activeTeamId: input.activeTeamId,
            download: true,
            expenseId: row.id,
          })
        : null,
      receiptFileName: row.receipt_file_name,
      receiptUrl,
      teamVenueId: row.team_venue_id,
      updatedAt: row.updated_at,
      vendor: row.vendor,
      venueName: input.venueByTeamVenueId.get(row.team_venue_id)?.name ?? "Unknown venue",
    }
  })
}

async function loadExpenseMetrics(input: {
  activeTeamId: string
  currentProfileId: string
  organizationCurrencyCode: string
  selectedCampId?: string
  selectedCrewFilter: TeamExpenseCrewFilter
  selectedMemberId?: string
  selectedType?: ExpenseType
  selectedVenueId?: string
  selectedYear: number
  supabase: ServerSupabaseClient
  teamExpensesVisible: boolean
}): Promise<TeamExpenseMetrics> {
  let myQuery = input.supabase
    .from("team_expenses")
    .select("amount_organization_currency")
    .eq("team_id", input.activeTeamId)
    .eq("expense_year", input.selectedYear)
    .eq("assigned_to_profile_id", input.currentProfileId)

  let teamQuery = input.supabase
    .from("team_expenses")
    .select("amount_organization_currency")
    .eq("team_id", input.activeTeamId)
    .eq("expense_year", input.selectedYear)

  if (input.selectedVenueId) {
    myQuery = myQuery.eq("team_venue_id", input.selectedVenueId)
    teamQuery = teamQuery.eq("team_venue_id", input.selectedVenueId)
  }

  if (input.selectedCampId) {
    myQuery = myQuery.eq("camp_id", input.selectedCampId)
    teamQuery = teamQuery.eq("camp_id", input.selectedCampId)
  }

  if (input.selectedMemberId) {
    myQuery = myQuery.eq("assigned_to_profile_id", input.selectedMemberId)
    teamQuery = teamQuery.eq("assigned_to_profile_id", input.selectedMemberId)
  } else if (input.selectedCrewFilter === "you") {
    teamQuery = teamQuery.eq("assigned_to_profile_id", input.currentProfileId)
  }

  if (input.selectedType) {
    myQuery = myQuery.eq("expense_type", input.selectedType)
    teamQuery = teamQuery.eq("expense_type", input.selectedType)
  }

  const [{ data: myRows, error: myError }, teamResult] = await Promise.all([
    myQuery,
    input.teamExpensesVisible ? teamQuery : Promise.resolve({ data: [], error: null }),
  ])

  if (myError) {
    throw new Error(`Could not load my expense total: ${myError.message}`)
  }

  if (teamResult.error) {
    throw new Error(`Could not load team expense total: ${teamResult.error.message}`)
  }

  const myTotal = (myRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount_organization_currency),
    0,
  )
  const teamTotal = input.teamExpensesVisible
    ? (teamResult.data ?? []).reduce(
        (sum, row) => sum + Number(row.amount_organization_currency),
        0,
      )
    : null

  return {
    myTotalLabel: formatCurrencyAmount({
      amount: myTotal,
      currencyCode: input.organizationCurrencyCode,
    }),
    myTotalValue: myTotal,
    teamTotalLabel:
      teamTotal === null
        ? null
        : formatCurrencyAmount({
            amount: teamTotal,
            currencyCode: input.organizationCurrencyCode,
          }),
    teamTotalValue: teamTotal,
  }
}

export async function getTeamExpensesResultsData(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  canManageTeamSessions: boolean
  chromeData: TeamExpensesChromeData
  currentProfileId: string
  page: number
  accumulatePages: boolean
}): Promise<TeamExpensesResultsData> {
  const supabase = await createServerSupabaseClient()
  const context = await loadExpenseContext({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    supabase,
  })
  const requestedPage = Math.max(1, Math.floor(input.page))
  const countQuery = applyExpenseFilters(
    supabase
      .from("team_expenses")
      .select("id", { count: "exact", head: true })
      .eq("team_id", input.activeTeamId),
    {
      currentProfileId: input.currentProfileId,
      selectedCampId: input.chromeData.selectedCampId,
      selectedCrewFilter: input.chromeData.selectedCrewFilter,
      selectedMemberId: input.chromeData.selectedMemberId,
      selectedType: input.chromeData.selectedType,
      selectedVenueId: input.chromeData.selectedVenueId,
      selectedVisibilityScope: input.chromeData.selectedVisibilityScope,
      selectedYear: input.chromeData.selectedYear,
    },
  )
  const { count, error: countError } = await countQuery

  if (countError) {
    throw new Error(`Could not count team expenses: ${countError.message}`)
  }

  const pagination = resolveTeamExpensesPagination({
    requestedPage,
    totalItems: count ?? 0,
    accumulatePages: input.accumulatePages,
    pageSize: TEAM_EXPENSES_PAGE_SIZE,
  })
  const visibleCount = input.accumulatePages
    ? pagination.currentPage * TEAM_EXPENSES_PAGE_SIZE
    : TEAM_EXPENSES_PAGE_SIZE
  const rangeStart = input.accumulatePages
    ? 0
    : (pagination.currentPage - 1) * TEAM_EXPENSES_PAGE_SIZE
  const rangeEnd = rangeStart + visibleCount - 1
  const rowsQuery = applyExpenseFilters(
    supabase
      .from("team_expenses")
      .select(TEAM_EXPENSE_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId),
    {
      currentProfileId: input.currentProfileId,
      selectedCampId: input.chromeData.selectedCampId,
      selectedCrewFilter: input.chromeData.selectedCrewFilter,
      selectedMemberId: input.chromeData.selectedMemberId,
      selectedType: input.chromeData.selectedType,
      selectedVenueId: input.chromeData.selectedVenueId,
      selectedVisibilityScope: input.chromeData.selectedVisibilityScope,
      selectedYear: input.chromeData.selectedYear,
    },
  )
  const { data: rows, error: rowsError } = await rowsQuery
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd)

  if (rowsError) {
    throw new Error(`Could not load team expenses: ${rowsError.message}`)
  }

  const expenseRows = (rows ?? []) as TeamExpenseRow[]
  const profileById = await loadProfilesById({
    profileIds: expenseRows.flatMap((row) => [
      row.created_by_profile_id,
      row.assigned_to_profile_id,
    ]),
    supabase,
  })
  const metrics = await loadExpenseMetrics({
    activeTeamId: input.activeTeamId,
    currentProfileId: input.currentProfileId,
    organizationCurrencyCode: input.chromeData.organizationCurrencyCode,
    selectedCampId: input.chromeData.selectedCampId,
    selectedCrewFilter: input.chromeData.selectedCrewFilter,
    selectedMemberId: input.chromeData.selectedMemberId,
    selectedType: input.chromeData.selectedType,
    selectedVenueId: input.chromeData.selectedVenueId,
    selectedYear: input.chromeData.selectedYear,
    supabase,
    teamExpensesVisible: input.chromeData.teamExpensesVisible,
  })

  return {
    ...pagination,
    expenses: mapExpenseRows({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      canManageTeamFinance: input.canManageTeamFinance,
      canManageTeamSessions: input.canManageTeamSessions,
      campById: context.campById,
      currentProfileId: input.currentProfileId,
      profileById,
      rows: expenseRows,
      venueByTeamVenueId: context.venueByTeamVenueId,
    }),
    loadMoreMode: input.accumulatePages,
    metrics,
  }
}

export async function getTeamExpensesReportData(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  canManageTeamSessions: boolean
  currentProfileId: string
  requestedCampId?: string
  requestedCrewFilter?: string
  requestedMemberId?: string
  requestedScope?: string
  requestedType?: string
  requestedVenueId?: string
  requestedYear?: number
}): Promise<TeamExpensesReportData> {
  const supabase = await createServerSupabaseClient()
  const [{ organization, team }, context, chromeData] = await Promise.all([
    loadTeamAndOrganization({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadExpenseContext({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    getTeamExpensesChromeData({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      canManageTeamFinance: input.canManageTeamFinance,
      currentProfileId: input.currentProfileId,
      requestedCampId: input.requestedCampId,
      requestedCrewFilter: input.requestedCrewFilter,
      requestedMemberId: input.requestedMemberId,
      requestedScope: input.requestedScope,
      requestedType: input.requestedType,
      requestedVenueId: input.requestedVenueId,
      requestedYear: input.requestedYear,
    }),
  ])

  if (input.requestedScope === "team" && !chromeData.teamExpensesVisible) {
    throw new Error("team_expense_report_scope_unavailable")
  }

  const rowsQuery = applyExpenseFilters(
    supabase
      .from("team_expenses")
      .select(TEAM_EXPENSE_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId),
    {
      currentProfileId: input.currentProfileId,
      selectedCampId: chromeData.selectedCampId,
      selectedCrewFilter: chromeData.selectedCrewFilter,
      selectedMemberId: chromeData.selectedMemberId,
      selectedType: chromeData.selectedType,
      selectedVenueId: chromeData.selectedVenueId,
      selectedVisibilityScope: chromeData.selectedVisibilityScope,
      selectedYear: chromeData.selectedYear,
    },
  )
  const { data: rows, error: rowsError } = await rowsQuery
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000)

  if (rowsError) {
    throw new Error(`Could not load expenses report rows: ${rowsError.message}`)
  }

  const expenseRows = (rows ?? []) as TeamExpenseRow[]
  const profileById = await loadProfilesById({
    profileIds: expenseRows.flatMap((row) => [
      row.created_by_profile_id,
      row.assigned_to_profile_id,
    ]),
    supabase,
  })
  const [{ data: membershipRow, error: membershipError }, exporterById] =
    await Promise.all([
      supabase
        .from("team_memberships")
        .select(TEAM_MEMBERSHIP_ROLE_SELECT_COLUMNS)
        .eq("team_id", input.activeTeamId)
        .eq("profile_id", input.currentProfileId)
        .eq("is_active", true)
        .maybeSingle(),
      loadProfilesById({
        profileIds: [input.currentProfileId],
        supabase,
      }),
    ])

  if (membershipError) {
    throw new Error(`Could not load expense report role: ${membershipError.message}`)
  }

  const metrics = await loadExpenseMetrics({
    activeTeamId: input.activeTeamId,
    currentProfileId: input.currentProfileId,
    organizationCurrencyCode: chromeData.organizationCurrencyCode,
    selectedCampId: chromeData.selectedCampId,
    selectedCrewFilter: chromeData.selectedCrewFilter,
    selectedMemberId: chromeData.selectedMemberId,
    selectedType: chromeData.selectedType,
    selectedVenueId: chromeData.selectedVenueId,
    selectedYear: chromeData.selectedYear,
    supabase,
    teamExpensesVisible: chromeData.teamExpensesVisible,
  })
  const venueOption = chromeData.selectedVenueId
    ? chromeData.venueOptions.find(
        (option) => option.teamVenueId === chromeData.selectedVenueId,
      ) ?? null
    : null
  const campOption = chromeData.selectedCampId
    ? chromeData.campOptions.find((option) => option.campId === chromeData.selectedCampId) ??
      null
    : null
  const memberOption = chromeData.selectedMemberId
    ? chromeData.memberOptions.find(
        (option) => option.profileId === chromeData.selectedMemberId,
      ) ?? null
    : null
  const expenses = mapExpenseRows({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    canManageTeamFinance: input.canManageTeamFinance,
    canManageTeamSessions: input.canManageTeamSessions,
    campById: context.campById,
    currentProfileId: input.currentProfileId,
    profileById,
    rows: expenseRows,
    venueByTeamVenueId: context.venueByTeamVenueId,
  })
  const receiptReferences = await loadExpenseReportReceiptReferences({
    rows: expenseRows,
    supabase,
  })
  const exportedByName = formatProfileName(exporterById.get(input.currentProfileId))

  return {
    campLabel: campOption?.label ?? null,
    expenses,
    exportedByName,
    exportedByRole: (membershipRow as TeamMembershipRoleRow | null)?.role ?? "team access",
    generatedAt: new Date().toISOString(),
    metrics,
    organizationCurrencyCode: chromeData.organizationCurrencyCode,
    organizationLogoUrl: organization?.avatar_url ?? null,
    organizationName: organization?.name ?? "Organization",
    receiptReferences,
    selectedCrewLabel: formatCrewSelectionLabel({
      currentProfileLabel: exportedByName,
      currentProfileId: input.currentProfileId,
      memberOptions: chromeData.memberOptions,
      selectedMemberId: chromeData.selectedMemberId,
      selectedVisibilityScope: chromeData.selectedVisibilityScope,
    }),
    selectedMemberLabel: memberOption?.label ?? null,
    selectedTypeLabel: chromeData.selectedType
      ? formatExpenseTypeLabel(chromeData.selectedType)
      : null,
    selectedVisibilityScope: chromeData.selectedVisibilityScope,
    selectedYear: chromeData.selectedYear,
    teamExpensesVisible: chromeData.teamExpensesVisible,
    teamName: team?.name ?? "Team",
    venueLabel: venueOption?.label ?? null,
  }
}

export async function getTeamExpenseFormOptions(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  currentProfileId: string
}): Promise<TeamExpenseFormOptions> {
  const supabase = await createServerSupabaseClient()
  const [{ organization }, context, memberOptions] = await Promise.all([
    loadTeamAndOrganization({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadExpenseContext({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadTeamExpenseMemberOptions({
      activeTeamId: input.activeTeamId,
      supabase,
    }),
  ])
  const organizationCurrencyCode = normalizeCurrencyCode(organization?.default_currency_code)

  return {
    canAssignMembers: input.canManageTeamFinance,
    currencyOptions: [organizationCurrencyCode, ...COMMON_EXPENSE_CURRENCIES]
      .filter((value, index, values) => values.indexOf(value) === index),
    defaultAssignedToProfileId: input.currentProfileId,
    memberOptions: input.canManageTeamFinance
      ? memberOptions
      : memberOptions.filter((option) => option.profileId === input.currentProfileId),
    organizationCurrencyCode,
    typeOptions: TEAM_EXPENSE_TYPE_OPTIONS,
    venueOptions: context.venueOptions,
  }
}

export async function getVenueExpensesTabData(input: {
  activeOrganizationId: string
  activeTeamId: string
  canManageTeamFinance: boolean
  canManageTeamSessions: boolean
  currentProfileId: string
  requestedCrewFilter?: string
  requestedMemberId?: string
  requestedType?: string
  selectedYear: number
  teamVenueId: string
}): Promise<{
  canFilterByMember: boolean
  expenses: TeamExpenseListItem[]
  formOptions: TeamExpenseFormOptions
  memberOptions: TeamExpenseMemberOption[]
  metrics: TeamExpenseMetrics
  selectedCrewFilter: TeamExpenseCrewFilter
  selectedMemberId?: string
  selectedType?: ExpenseType
  selectedVisibilityScope: ExpenseVisibilityScope
  teamExpensesVisible: boolean
  typeOptions: Array<{ label: string; value: ExpenseType }>
}> {
  const chromeData = await getTeamExpensesChromeData({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    canManageTeamFinance: input.canManageTeamFinance,
    currentProfileId: input.currentProfileId,
    requestedCrewFilter: input.requestedCrewFilter,
    requestedMemberId: input.requestedMemberId,
    requestedScope: "team",
    requestedType: input.requestedType,
    requestedVenueId: input.teamVenueId,
    requestedYear: input.selectedYear,
  })
  const [formOptions, resultsData] = await Promise.all([
    getTeamExpenseFormOptions({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      canManageTeamFinance: input.canManageTeamFinance,
      currentProfileId: input.currentProfileId,
    }),
    getTeamExpensesResultsData({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      canManageTeamFinance: input.canManageTeamFinance,
      canManageTeamSessions: input.canManageTeamSessions,
      chromeData,
      currentProfileId: input.currentProfileId,
      page: 1,
      accumulatePages: false,
    }),
  ])

  return {
    canFilterByMember: chromeData.canFilterByMember,
    expenses: resultsData.expenses,
    formOptions,
    memberOptions: chromeData.memberOptions,
    metrics: resultsData.metrics,
    selectedCrewFilter: chromeData.selectedCrewFilter,
    selectedMemberId: chromeData.selectedMemberId,
    selectedType: chromeData.selectedType,
    selectedVisibilityScope: chromeData.selectedVisibilityScope,
    teamExpensesVisible: chromeData.teamExpensesVisible,
    typeOptions: chromeData.typeOptions,
  }
}
