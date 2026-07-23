import "server-only"

import {
  resolveTeamStandardMovesPagination,
} from "@/features/standard-moves/list-route-state.mjs"
import { buildStandardMoveCampUsage } from "@/features/standard-moves/usage-core.mjs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamStandardMoveRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "team_id" | "name" | "description" | "is_active" | "created_at" | "updated_at"
>
type TeamStandardMoveScopeRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "team_id"
>
type SessionStandardMoveUsageRow = Pick<
  Database["public"]["Tables"]["session_standard_moves"]["Row"],
  "team_standard_move_id" | "session_id"
>
type StandardMoveUsageSessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "camp_id" | "session_date"
>
type StandardMoveUsageCampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "name"
>

const TEAM_STANDARD_MOVE_SELECT_COLUMNS =
  "id,team_id,name,description,is_active,created_at,updated_at"
const TEAM_STANDARD_MOVE_SCOPE_SELECT_COLUMNS = "id,team_id"
const SESSION_STANDARD_MOVE_SELECT_COLUMNS = "team_standard_move_id"
const SESSION_STANDARD_MOVE_USAGE_SELECT_COLUMNS =
  "team_standard_move_id,session_id"
const STANDARD_MOVE_USAGE_SESSION_SELECT_COLUMNS = "id,camp_id,session_date"
const STANDARD_MOVE_USAGE_CAMP_SELECT_COLUMNS = "id,name"

export const TEAM_STANDARD_MOVES_PAGE_SIZE = 25

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type TeamStandardMoveListItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  usageCount: number
  updatedAt: string
}

export type TeamStandardMoveStatusFilter = "active" | "archived" | "all"

export type TeamStandardMoveStatusCounts = {
  active: number
  archived: number
}

export type TeamStandardMoveUsageCamp = {
  id: string
  name: string
  usageCount: number
}

export type TeamStandardMoveUsageData = {
  itemId: string
  usageCount: number
  camps: TeamStandardMoveUsageCamp[]
}

export type TeamStandardMovesChromeData = {
  selectedStatusFilter: TeamStandardMoveStatusFilter
  statusCounts: TeamStandardMoveStatusCounts
}

export type TeamStandardMovesResultsData = {
  moves: TeamStandardMoveListItem[]
  totalCount: number
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type TeamStandardMovesPageData =
  TeamStandardMovesChromeData &
  TeamStandardMovesResultsData

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function applyStatusFilter<QueryBuilder>(
  query: QueryBuilder,
  statusFilter: TeamStandardMoveStatusFilter,
): QueryBuilder {
  if (
    statusFilter === "active" &&
    typeof (query as { eq?: unknown }).eq === "function"
  ) {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      true,
    )
  }

  if (
    statusFilter === "archived" &&
    typeof (query as { eq?: unknown }).eq === "function"
  ) {
    return (query as { eq: (column: string, value: boolean) => QueryBuilder }).eq(
      "is_active",
      false,
    )
  }

  return query
}

async function countStandardMoves(input: {
  activeTeamId: string
  isActive?: boolean
  supabase: ServerSupabaseClient
}): Promise<number> {
  let query = input.supabase
    .from("team_standard_moves")
    .select("id", { count: "exact", head: true })
    .eq("team_id", input.activeTeamId)

  if (typeof input.isActive === "boolean") {
    query = query.eq("is_active", input.isActive)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Could not count team standard moves: ${error.message}`)
  }

  return count ?? 0
}

async function buildUsageCountByMoveId(input: {
  standardMoveIds: string[]
  supabase: ServerSupabaseClient
}): Promise<Map<string, number>> {
  if (input.standardMoveIds.length === 0) {
    return new Map()
  }

  const usageCountEntries = await Promise.all(
    input.standardMoveIds.map(async (standardMoveId) => {
      const { count, error } = await input.supabase
        .from("session_standard_moves")
        .select(SESSION_STANDARD_MOVE_SELECT_COLUMNS, {
          count: "exact",
          head: true,
        })
        .eq("team_standard_move_id", standardMoveId)

      if (error) {
        throw new Error(
          `Could not count session standard move usage: ${error.message}`,
        )
      }

      return [standardMoveId, count ?? 0] as const
    }),
  )

  return new Map(usageCountEntries)
}

export async function getTeamStandardMovesChromeData(input: {
  activeTeamId: string
  statusFilter: TeamStandardMoveStatusFilter
  page?: number
  accumulatePages?: boolean
}): Promise<TeamStandardMovesChromeData> {
  const supabase = await createServerSupabaseClient()
  const [activeCount, archivedCount] = await Promise.all([
    countStandardMoves({
      activeTeamId: input.activeTeamId,
      isActive: true,
      supabase,
    }),
    countStandardMoves({
      activeTeamId: input.activeTeamId,
      isActive: false,
      supabase,
    }),
  ])

  return {
    selectedStatusFilter: input.statusFilter,
    statusCounts: {
      active: activeCount,
      archived: archivedCount,
    },
  }
}

export async function getTeamStandardMovesResultsData(input: {
  activeTeamId: string
  chromeData: TeamStandardMovesChromeData
  page: number
  accumulatePages?: boolean
  statusFilter?: TeamStandardMoveStatusFilter
}): Promise<TeamStandardMovesResultsData> {
  const supabase = await createServerSupabaseClient()
  const requestedPage = normalizePage(input.page)
  const accumulatePages = input.accumulatePages === true
  const statusFilter = input.statusFilter ?? input.chromeData.selectedStatusFilter
  let countQuery = supabase
    .from("team_standard_moves")
    .select("id", { count: "exact", head: true })
    .eq("team_id", input.activeTeamId)

  countQuery = applyStatusFilter(countQuery, statusFilter)

  const { count: standardMoveCount, error: countError } = await countQuery

  if (countError) {
    throw new Error(`Could not count team standard moves: ${countError.message}`)
  }

  const pagination = resolveTeamStandardMovesPagination({
    requestedPage,
    totalItems: standardMoveCount ?? 0,
    accumulatePages,
    pageSize: TEAM_STANDARD_MOVES_PAGE_SIZE,
  })
  const { currentPage, pageCount, hasPreviousPage, hasNextPage } = pagination

  if ((standardMoveCount ?? 0) === 0) {
    return {
      moves: [],
      totalCount: 0,
      currentPage,
      pageCount,
      hasPreviousPage,
      hasNextPage,
    }
  }

  const visibleCount = accumulatePages
    ? currentPage * TEAM_STANDARD_MOVES_PAGE_SIZE
    : TEAM_STANDARD_MOVES_PAGE_SIZE
  const rangeStart = accumulatePages
    ? 0
    : (currentPage - 1) * TEAM_STANDARD_MOVES_PAGE_SIZE
  const rangeEnd = rangeStart + visibleCount - 1

  let standardMovesQuery = supabase
    .from("team_standard_moves")
    .select(TEAM_STANDARD_MOVE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("updated_at", { ascending: false })

  standardMovesQuery = applyStatusFilter(standardMovesQuery, statusFilter)

  const { data: standardMoveRows, error: standardMovesError } =
    await standardMovesQuery.range(rangeStart, rangeEnd)

  if (standardMovesError) {
    throw new Error(`Could not load team standard moves: ${standardMovesError.message}`)
  }

  const visibleStandardMoves = (standardMoveRows ?? []) as TeamStandardMoveRow[]
  const standardMoveIds = visibleStandardMoves.map((standardMove) => standardMove.id)
  const usageCountByMoveId = await buildUsageCountByMoveId({
    standardMoveIds,
    supabase,
  })

  const mappedMoves: TeamStandardMoveListItem[] = visibleStandardMoves.map((standardMove) => ({
    id: standardMove.id,
    name: standardMove.name,
    description: standardMove.description,
    isActive: standardMove.is_active,
    usageCount: usageCountByMoveId.get(standardMove.id) ?? 0,
    updatedAt: standardMove.updated_at,
  }))

  return {
    moves: mappedMoves,
    totalCount: standardMoveCount ?? 0,
    currentPage,
    pageCount,
    hasPreviousPage,
    hasNextPage,
  }
}

export async function getTeamStandardMovesPageData(input: {
  activeTeamId: string
  statusFilter?: TeamStandardMoveStatusFilter
  page?: number
  accumulatePages?: boolean
}): Promise<TeamStandardMovesPageData> {
  const statusFilter = input.statusFilter ?? "active"
  const chromeData = await getTeamStandardMovesChromeData({
    activeTeamId: input.activeTeamId,
    statusFilter,
    page: input.page,
    accumulatePages: input.accumulatePages,
  })
  const resultsData = await getTeamStandardMovesResultsData({
    activeTeamId: input.activeTeamId,
    chromeData,
    page: input.page ?? 1,
    accumulatePages: input.accumulatePages,
    statusFilter,
  })

  return {
    ...chromeData,
    ...resultsData,
  }
}

export async function getTeamStandardMoveUsageData(input: {
  activeTeamId: string
  standardMoveId: string
}): Promise<TeamStandardMoveUsageData | null> {
  const supabase = await createServerSupabaseClient()
  const { data: standardMoveRow, error: standardMoveError } = await supabase
    .from("team_standard_moves")
    .select(TEAM_STANDARD_MOVE_SCOPE_SELECT_COLUMNS)
    .eq("id", input.standardMoveId)
    .eq("team_id", input.activeTeamId)
    .maybeSingle()

  if (standardMoveError) {
    throw new Error(`Could not load team standard move: ${standardMoveError.message}`)
  }

  if (!standardMoveRow) {
    return null
  }

  const standardMove = standardMoveRow as TeamStandardMoveScopeRow
  const { data: usageRowsData, error: usageRowsError } = await supabase
    .from("session_standard_moves")
    .select(SESSION_STANDARD_MOVE_USAGE_SELECT_COLUMNS)
    .eq("team_standard_move_id", standardMove.id)

  if (usageRowsError) {
    throw new Error(
      `Could not load session standard move usage: ${usageRowsError.message}`,
    )
  }

  const usageRows = (usageRowsData ?? []) as SessionStandardMoveUsageRow[]

  if (usageRows.length === 0) {
    return buildStandardMoveCampUsage({
      standardMoveId: standardMove.id,
      usageRows: [],
      sessionRows: [],
      campRows: [],
    }) as TeamStandardMoveUsageData
  }

  const sessionIds = [...new Set(usageRows.map((usageRow) => usageRow.session_id))]
  const { data: sessionRowsData, error: sessionRowsError } = await supabase
    .from("sessions")
    .select(STANDARD_MOVE_USAGE_SESSION_SELECT_COLUMNS)
    .in("id", sessionIds)

  if (sessionRowsError) {
    throw new Error(
      `Could not load session standard move sessions: ${sessionRowsError.message}`,
    )
  }

  const sessionRows = (sessionRowsData ?? []) as StandardMoveUsageSessionRow[]
  const campIds = [...new Set(sessionRows.map((sessionRow) => sessionRow.camp_id))]
  let campRows: StandardMoveUsageCampRow[] = []

  if (campIds.length > 0) {
    const { data: campRowsData, error: campRowsError } = await supabase
      .from("camps")
      .select(STANDARD_MOVE_USAGE_CAMP_SELECT_COLUMNS)
      .in("id", campIds)

    if (campRowsError) {
      throw new Error(
        `Could not load session standard move camps: ${campRowsError.message}`,
      )
    }

    campRows = (campRowsData ?? []) as StandardMoveUsageCampRow[]
  }

  return buildStandardMoveCampUsage({
    standardMoveId: standardMove.id,
    usageRows,
    sessionRows,
    campRows,
  }) as TeamStandardMoveUsageData
}
