import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { SessionDetailAsset } from "@/features/sessions/detail-types"
import type { Database } from "@/types/database"

export const TEAM_ASSETS_PAGE_SIZE = 24

const TEAM_ASSET_SIGNED_URL_SECONDS = 5 * 60
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country"
const CAMP_SELECT_COLUMNS = "id,team_venue_id,name,start_date,end_date"
const SESSION_SELECT_COLUMNS = "id,camp_id,session_type,session_date,dock_out_at"

export type TeamAssetTab = "images" | "files"

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

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "camp_id" | "session_type" | "session_date" | "dock_out_at"
>

type TeamAssetRpcRow =
  Database["public"]["Functions"]["get_team_asset_page"]["Returns"][number]

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

type TeamAssetContext = {
  campById: Map<string, CampRow>
  campRows: CampRow[]
  sessionRows: SessionRow[]
  teamVenueById: Map<string, TeamVenueRow>
  teamVenueRows: TeamVenueRow[]
  venueById: Map<string, VenueRow>
  venueRows: VenueRow[]
}

export type TeamAssetVenueFilterOption = {
  label: string
  location: string
  venueId: string
  venueName: string
}

export type TeamAssetYearFilterOption = {
  label: string
  year: number
}

export type TeamAssetCampFilterOption = {
  campId: string
  label: string
  venueId: string
}

export type TeamAssetSessionFilterOption = {
  campId: string
  label: string
  sessionDate: string
  sessionId: string
  venueId: string
  year: number
}

export type TeamAssetFilterOptions = {
  camps: TeamAssetCampFilterOption[]
  sessions: TeamAssetSessionFilterOption[]
  venues: TeamAssetVenueFilterOption[]
  years: TeamAssetYearFilterOption[]
}

export type TeamAssetSelectedFilters = {
  campId?: string
  sessionId?: string
  venueId?: string
  year?: number
}

export type TeamAssetsRequestedFilters = {
  campId?: string
  sessionId?: string
  venueId?: string
  year?: number
}

export type TeamAssetListItem = SessionDetailAsset & {
  campId: string
  campName: string
  sessionDate: string
  sessionId: string
  sessionType: Database["public"]["Enums"]["session_type"]
  teamVenueId: string
  venueId: string
  venueLocation: string
  venueName: string
}

export type TeamAssetsPageData = {
  assetLimit: number
  assetTotalCount: number
  assets: TeamAssetListItem[]
  canManageAssets: boolean
  currentPage: number
  filterOptions: TeamAssetFilterOptions
  hasActiveFilters: boolean
  hasNextPage: boolean
  pageCount: number
  selectedFilters: TeamAssetSelectedFilters
  tab: TeamAssetTab
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function buildLocation(input: Pick<VenueRow, "city" | "country">): string {
  return `${input.city}, ${input.country}`
}

function parseYearFromDate(value: string): number {
  return Number.parseInt(value.slice(0, 4), 10)
}

function formatSessionTypeLabel(value: SessionRow["session_type"]): string {
  return value === "regatta" ? "Regatta" : "Training"
}

function formatSessionDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function buildStorageKey(input: {
  bucket: string
  storagePath: string
}): string {
  return `${input.bucket}\n${input.storagePath}`
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

function resolvePagination(input: {
  pageSize: number
  requestedPage: number
  totalItems: number
}) {
  const pageCount = Math.max(1, Math.ceil(input.totalItems / input.pageSize))
  const currentPage = Math.min(input.requestedPage, pageCount)

  return {
    currentPage,
    hasNextPage: currentPage < pageCount,
    pageCount,
  }
}

function normalizeOptionalId<T extends string>(
  requestedId: string | undefined,
  allowedIds: Set<T>,
): T | undefined {
  if (!requestedId) {
    return undefined
  }

  return allowedIds.has(requestedId as T) ? (requestedId as T) : undefined
}

function getSessionContext(input: {
  campById: Map<string, CampRow>
  session: SessionRow
  teamVenueById: Map<string, TeamVenueRow>
  venueById: Map<string, VenueRow>
}) {
  const camp = input.campById.get(input.session.camp_id)
  const teamVenue = camp ? input.teamVenueById.get(camp.team_venue_id) : undefined
  const venue = teamVenue ? input.venueById.get(teamVenue.venue_id) : undefined

  if (!camp || !teamVenue || !venue) {
    return null
  }

  return {
    camp,
    teamVenue,
    venue,
  }
}

function buildTeamAssetFilterState(input: {
  context: TeamAssetContext
  requestedFilters: TeamAssetsRequestedFilters
}): {
  filterOptions: TeamAssetFilterOptions
  hasActiveFilters: boolean
  selectedFilters: TeamAssetSelectedFilters
} {
  const venueOptions = input.context.teamVenueRows
    .map((teamVenue) => {
      const venue = input.context.venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        label: `${venue.name} - ${buildLocation(venue)}`,
        location: buildLocation(venue),
        venueId: venue.id,
        venueName: venue.name,
      }
    })
    .filter((option): option is TeamAssetVenueFilterOption => option !== null)
    .sort((left, right) => left.venueName.localeCompare(right.venueName))

  const selectedVenueId = normalizeOptionalId(
    input.requestedFilters.venueId,
    new Set(venueOptions.map((option) => option.venueId)),
  )
  const sessionsForVenue = input.context.sessionRows.filter((session) => {
    if (!selectedVenueId) {
      return true
    }

    const context = getSessionContext({
      campById: input.context.campById,
      session,
      teamVenueById: input.context.teamVenueById,
      venueById: input.context.venueById,
    })

    return context?.venue.id === selectedVenueId
  })
  const years = [...new Set(sessionsForVenue.map((session) => parseYearFromDate(session.session_date)))]
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => right - left)
  const yearOptions = years.map((year) => ({
    label: String(year),
    year,
  }))
  const selectedYear =
    typeof input.requestedFilters.year === "number" &&
    years.includes(input.requestedFilters.year)
      ? input.requestedFilters.year
      : undefined
  const sessionsForYear = sessionsForVenue.filter(
    (session) => typeof selectedYear !== "number" || parseYearFromDate(session.session_date) === selectedYear,
  )
  const visibleCampIds = new Set(sessionsForYear.map((session) => session.camp_id))
  const campOptions = input.context.campRows
    .filter((camp) => visibleCampIds.has(camp.id))
    .map((camp) => {
      const teamVenue = input.context.teamVenueById.get(camp.team_venue_id)
      const venue = teamVenue ? input.context.venueById.get(teamVenue.venue_id) : undefined

      if (!teamVenue || !venue) {
        return null
      }

      return {
        campId: camp.id,
        label: `${camp.name} - ${venue.name}`,
        venueId: venue.id,
      }
    })
    .filter((option): option is TeamAssetCampFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label))
  const selectedCampId = normalizeOptionalId(
    input.requestedFilters.campId,
    new Set(campOptions.map((option) => option.campId)),
  )
  const sessionsForCamp = sessionsForYear.filter(
    (session) => !selectedCampId || session.camp_id === selectedCampId,
  )
  const sessionOptions = sessionsForCamp
    .map((session) => {
      const context = getSessionContext({
        campById: input.context.campById,
        session,
        teamVenueById: input.context.teamVenueById,
        venueById: input.context.venueById,
      })

      if (!context) {
        return null
      }

      const dateLabel = formatSessionDateLabel(session.session_date)
      return {
        campId: context.camp.id,
        label: `${dateLabel} - ${formatSessionTypeLabel(session.session_type)} - ${context.camp.name}`,
        sessionDate: session.session_date,
        sessionId: session.id,
        venueId: context.venue.id,
        year: parseYearFromDate(session.session_date),
      }
    })
    .filter((option): option is TeamAssetSessionFilterOption => option !== null)
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate))
  const selectedSessionId = normalizeOptionalId(
    input.requestedFilters.sessionId,
    new Set(sessionOptions.map((option) => option.sessionId)),
  )
  const selectedFilters: TeamAssetSelectedFilters = {
    campId: selectedCampId,
    sessionId: selectedSessionId,
    venueId: selectedVenueId,
    year: selectedYear,
  }

  return {
    filterOptions: {
      camps: campOptions,
      sessions: sessionOptions,
      venues: venueOptions,
      years: yearOptions,
    },
    hasActiveFilters: Boolean(
      selectedFilters.venueId ||
      typeof selectedFilters.year === "number" ||
      selectedFilters.campId ||
      selectedFilters.sessionId,
    ),
    selectedFilters,
  }
}

async function loadTeamAssetContext(input: {
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<TeamAssetContext> {
  const { data: teamVenueData, error: teamVenueError } = await input.supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load team venues for assets: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueRow[] = teamVenueData ?? []
  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))
  let venueRows: VenueRow[] = []

  if (venueIds.length > 0) {
    const { data, error: venueError } = await input.supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .in("id", venueIds)
      .order("name", { ascending: true })

    if (venueError) {
      throw new Error(`Could not load venues for assets: ${venueError.message}`)
    }

    venueRows = data ?? []
  }

  const teamVenueIds = teamVenueRows.map((row) => row.id)
  let campRows: CampRow[] = []

  if (teamVenueIds.length > 0) {
    const { data, error: campError } = await input.supabase
      .from("camps")
      .select(CAMP_SELECT_COLUMNS)
      .in("team_venue_id", teamVenueIds)
      .order("start_date", { ascending: false })

    if (campError) {
      throw new Error(`Could not load camps for assets: ${campError.message}`)
    }

    campRows = data ?? []
  }

  const campIds = campRows.map((row) => row.id)
  let sessionRows: SessionRow[] = []

  if (campIds.length > 0) {
    const { data, error: sessionError } = await input.supabase
      .from("sessions")
      .select(SESSION_SELECT_COLUMNS)
      .in("camp_id", campIds)
      .order("session_date", { ascending: false })

    if (sessionError) {
      throw new Error(`Could not load sessions for assets: ${sessionError.message}`)
    }

    sessionRows = data ?? []
  }

  return {
    campById: new Map(campRows.map((row) => [row.id, row])),
    campRows,
    sessionRows,
    teamVenueById: new Map(teamVenueRows.map((row) => [row.id, row])),
    teamVenueRows,
    venueById: new Map(venueRows.map((row) => [row.id, row])),
    venueRows,
  }
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
      .createSignedUrls(Array.from(paths), TEAM_ASSET_SIGNED_URL_SECONDS)

    if (error) {
      throw new Error(`Could not create signed team asset URLs: ${error.message}`)
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

async function attachTeamAssetUrls(input: {
  assets: TeamAssetListItem[]
  supabase: ServerSupabaseClient
  tab: TeamAssetTab
}): Promise<TeamAssetListItem[]> {
  if (input.tab !== "images") {
    return input.assets.map((asset) => ({
      ...asset,
      signedUrl: null,
      thumbnailSignedUrl: null,
    }))
  }

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
      signedUrl,
      thumbnailSignedUrl,
    }
  })
}

function mapRpcRowsToAssets(input: {
  activeOrganizationId: string
  activeTeamId: string
  rows: TeamAssetRpcRow[]
}): TeamAssetListItem[] {
  return input.rows.map((row) => ({
    id: row.asset_id,
    asset_type: row.asset_type,
    bucket: row.bucket,
    storage_path: row.storage_path,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    thumbnail_bucket: row.thumbnail_bucket,
    thumbnail_storage_path: row.thumbnail_storage_path,
    thumbnail_mime_type: row.thumbnail_mime_type,
    thumbnail_size_bytes: row.thumbnail_size_bytes,
    created_at: row.asset_created_at,
    contentUrl: buildAssetContentUrl({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      assetId: row.asset_id,
    }),
    signedUrl: null,
    thumbnailSignedUrl: null,
    campId: row.camp_id,
    campName: row.camp_name,
    sessionDate: row.session_date,
    sessionId: row.session_id,
    sessionType: row.session_type,
    teamVenueId: row.team_venue_id,
    venueId: row.venue_id,
    venueLocation: `${row.venue_city}, ${row.venue_country}`,
    venueName: row.venue_name,
  }))
}

function getAssetTypeForTab(tab: TeamAssetTab): Database["public"]["Enums"]["asset_type"] {
  return tab === "images" ? "photo" : "analytics_file"
}

export async function getTeamAssetsPageData(input: {
  activeOrganizationId: string
  activeTeamId: string
  accumulatePages?: boolean
  canManageAssets: boolean
  page: number
  requestedFilters: TeamAssetsRequestedFilters
  tab: TeamAssetTab
}): Promise<TeamAssetsPageData> {
  const requestedPage = Math.max(1, Math.floor(input.page))
  const supabase = await createServerSupabaseClient()
  const context = await loadTeamAssetContext({
    activeTeamId: input.activeTeamId,
    supabase,
  })
  const {
    filterOptions,
    hasActiveFilters,
    selectedFilters,
  } = buildTeamAssetFilterState({
    context,
    requestedFilters: input.requestedFilters,
  })
  const limit = input.accumulatePages
    ? requestedPage * TEAM_ASSETS_PAGE_SIZE
    : TEAM_ASSETS_PAGE_SIZE
  const offset = input.accumulatePages ? 0 : (requestedPage - 1) * TEAM_ASSETS_PAGE_SIZE
  const { data, error } = await supabase.rpc("get_team_asset_page", {
    p_asset_type: getAssetTypeForTab(input.tab),
    p_camp_id: selectedFilters.campId ?? null,
    p_limit: limit,
    p_offset: offset,
    p_session_id: selectedFilters.sessionId ?? null,
    p_team_id: input.activeTeamId,
    p_venue_id: selectedFilters.venueId ?? null,
    p_year: selectedFilters.year ?? null,
  })

  if (error) {
    throw new Error(`Could not load team assets: ${error.message}`)
  }

  const rows = data ?? []
  const assetTotalCount = rows[0]?.total_count ?? 0
  const pagination = resolvePagination({
    pageSize: TEAM_ASSETS_PAGE_SIZE,
    requestedPage,
    totalItems: assetTotalCount,
  })
  const mappedAssets = mapRpcRowsToAssets({
    activeOrganizationId: input.activeOrganizationId,
    activeTeamId: input.activeTeamId,
    rows,
  })
  const assets = await attachTeamAssetUrls({
    assets: mappedAssets,
    supabase,
    tab: input.tab,
  })

  return {
    assetLimit: TEAM_ASSETS_PAGE_SIZE,
    assetTotalCount,
    assets,
    canManageAssets: input.canManageAssets,
    currentPage: pagination.currentPage,
    filterOptions,
    hasActiveFilters,
    hasNextPage: pagination.hasNextPage,
    pageCount: pagination.pageCount,
    selectedFilters,
    tab: input.tab,
  }
}

export function buildTeamAssetsEmptyMessage(input: {
  hasActiveFilters: boolean
  tab: TeamAssetTab
}): string {
  if (input.hasActiveFilters) {
    return "No assets match these filters."
  }

  return input.tab === "images"
    ? "No images uploaded for this team yet."
    : "No files uploaded for this team yet."
}
