import "server-only"

import {
  resolveTeamStandardMovesPagination,
} from "@/features/standard-moves/list-route-state.mjs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamStandardMoveRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "team_id" | "name" | "description" | "is_active" | "created_at" | "updated_at"
>

const TEAM_STANDARD_MOVE_SELECT_COLUMNS =
  "id,team_id,name,description,is_active,created_at,updated_at"
const SESSION_STANDARD_MOVE_SELECT_COLUMNS = "team_standard_move_id"

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
