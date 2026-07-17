import "server-only"

import { resolveTeamsPagination } from "@/features/teams/list-route-state.mjs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "organization_id" | "name" | "team_type" | "slug" | "is_active"
>

export type TeamListItem = TeamRow
export type TeamOrganizationOption = {
  id: string
  name: string
}

export type TeamsChromeData = {
  activeOrganization: TeamOrganizationOption
}

export type TeamsResultsData = {
  teams: TeamListItem[]
  totalCount: number
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

const TEAM_SELECT_COLUMNS =
  "id,organization_id,name,team_type,slug,is_active"

export const TEAMS_PAGE_SIZE = 25

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

async function countTeams(input: {
  activeOrganizationId: string
}): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { count, error } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.activeOrganizationId)

  if (error) {
    throw new Error(`Could not count teams: ${error.message}`)
  }

  return count ?? 0
}

export async function getTeamsChromeData(input: {
  activeOrganization: TeamOrganizationOption
}): Promise<TeamsChromeData> {
  return {
    activeOrganization: input.activeOrganization,
  }
}

export async function getTeamsResultsData(input: {
  accumulatePages?: boolean
  activeOrganizationId: string
  page: number
}): Promise<TeamsResultsData> {
  const supabase = await createServerSupabaseClient()
  const requestedPage = normalizePage(input.page)
  const accumulatePages = input.accumulatePages === true
  const totalCount = await countTeams({
    activeOrganizationId: input.activeOrganizationId,
  })
  const pagination = resolveTeamsPagination({
    requestedPage,
    totalItems: totalCount,
    accumulatePages,
    pageSize: TEAMS_PAGE_SIZE,
  })
  const visibleCount = accumulatePages
    ? pagination.currentPage * TEAMS_PAGE_SIZE
    : TEAMS_PAGE_SIZE
  const rangeStart = accumulatePages
    ? 0
    : (pagination.currentPage - 1) * TEAMS_PAGE_SIZE
  const rangeEnd = rangeStart + visibleCount - 1

  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select(TEAM_SELECT_COLUMNS)
    .eq("organization_id", input.activeOrganizationId)
    .order("name", { ascending: true })
    .range(rangeStart, rangeEnd)

  if (teamsError) {
    throw new Error(`Could not load teams: ${teamsError.message}`)
  }

  return {
    teams: teamsData ?? [],
    totalCount,
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
  }
}

export async function getTeamsPageData(input: {
  activeOrganizationId: string
}): Promise<{
  teams: TeamListItem[]
}> {
  const resultsData = await getTeamsResultsData({
    activeOrganizationId: input.activeOrganizationId,
    page: 1,
  })

  return {
    teams: resultsData.teams,
  }
}
