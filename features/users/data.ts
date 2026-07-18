import "server-only"

import {
  resolveUsersPagination,
  shouldShowTeamMembershipInUsersList,
} from "@/features/users/list-route-state.mjs"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"

type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name"
>

type TeamMembershipRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "id" | "team_id" | "profile_id" | "role" | "is_active"
>

type OrganizationMembershipRow = Pick<
  Database["public"]["Tables"]["organization_memberships"]["Row"],
  "id" | "organization_id" | "profile_id" | "role"
>

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "photo_url"
  | "is_active"
  | "first_seen_at"
>

type TeamRole = Database["public"]["Enums"]["team_role_type"]
type OrganizationRole = Database["public"]["Enums"]["organization_role_type"]

export type CrewLinkedTeam = {
  id: string
  name: string
  role: TeamRole
}

export type TeamCrewListItem = {
  membershipKind: "team"
  membershipId: string
  profileId: string
  firstName: string
  lastName: string
  email: string
  fullName: string
  avatarUrl: string | null
  firstSeenAt: string | null
  teamId: string
  teamName: string
  linkedTeams: CrewLinkedTeam[]
  role: TeamRole
}

export type OrganizationCrewListItem = {
  membershipKind: "organization"
  membershipId: string
  profileId: string
  firstName: string
  lastName: string
  email: string
  fullName: string
  avatarUrl: string | null
  firstSeenAt: string | null
  teamId: null
  teamName: string
  linkedTeams: CrewLinkedTeam[]
  role: OrganizationRole
}

export type CrewListItem = TeamCrewListItem | OrganizationCrewListItem

export type CrewTeamOption = {
  id: string
  name: string
}

export type UsersPageData = {
  crews: CrewListItem[]
  teamOptions: CrewTeamOption[]
  selectedTeamId?: string
}

export type UsersChromeData = {
  teamOptions: CrewTeamOption[]
  selectedTeamId?: string
}

export type UsersResultsData = {
  crews: CrewListItem[]
  totalCount: number
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export const USERS_PAGE_SIZE = 25

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function buildProfileDisplayName(profile: ProfileRow): string {
  const firstName = (profile.first_name ?? "").trim()
  const lastName = (profile.last_name ?? "").trim()
  const fullName = `${firstName} ${lastName}`.trim()

  if (fullName.length > 0) {
    return fullName
  }

  const email = (profile.email ?? "").trim()
  if (email.length > 0) {
    return email
  }

  return "Unnamed member"
}

function buildLinkedTeamsByProfileId(input: {
  membershipRows: TeamMembershipRow[]
  teamNameById: Map<string, string>
}): Map<string, CrewLinkedTeam[]> {
  const linkedTeamsByProfileId = new Map<string, CrewLinkedTeam[]>()
  const linkedTeamIdsByProfileId = new Map<string, Set<string>>()

  for (const membership of input.membershipRows) {
    const teamName = input.teamNameById.get(membership.team_id)

    if (!teamName) {
      continue
    }

    const existingTeamIds =
      linkedTeamIdsByProfileId.get(membership.profile_id) ?? new Set<string>()

    if (existingTeamIds.has(membership.team_id)) {
      continue
    }

    existingTeamIds.add(membership.team_id)
    linkedTeamIdsByProfileId.set(membership.profile_id, existingTeamIds)

    const linkedTeams = linkedTeamsByProfileId.get(membership.profile_id) ?? []
    linkedTeams.push({
      id: membership.team_id,
      name: teamName,
      role: membership.role,
    })
    linkedTeams.sort((left, right) => left.name.localeCompare(right.name))
    linkedTeamsByProfileId.set(membership.profile_id, linkedTeams)
  }

  return linkedTeamsByProfileId
}

export async function getUsersPageData(input: {
  activeOrganizationId: string
  requestedTeamId?: string
}): Promise<UsersPageData> {
  const chromeData = await getUsersChromeData(input)
  const resultsData = await getUsersResultsData({
    activeOrganizationId: input.activeOrganizationId,
    page: 1,
    teamOptions: chromeData.teamOptions,
    selectedTeamId: chromeData.selectedTeamId,
  })

  return {
    crews: resultsData.crews,
    teamOptions: chromeData.teamOptions,
    selectedTeamId: chromeData.selectedTeamId,
  }
}

export async function getUsersChromeData(input: {
  activeOrganizationId: string
  requestedTeamId?: string
}): Promise<UsersChromeData> {
  const adminSupabase = createAdminSupabaseClient()

  const { data: teamsData, error: teamsError } = await adminSupabase
    .from("teams")
    .select("id,name")
    .eq("organization_id", input.activeOrganizationId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (teamsError) {
    throw new Error(`Could not load teams for users page: ${teamsError.message}`)
  }

  const teamRows: TeamRow[] = teamsData ?? []
  const teamOptions: CrewTeamOption[] = teamRows.map((team) => ({
    id: team.id,
    name: team.name,
  }))

  const selectedTeamId = teamOptions.some((team) => team.id === input.requestedTeamId)
    ? input.requestedTeamId
    : undefined

  return {
    teamOptions,
    selectedTeamId,
  }
}

export async function getUsersResultsData(input: {
  accumulatePages?: boolean
  activeOrganizationId: string
  page: number
  selectedTeamId?: string
  teamOptions: CrewTeamOption[]
}): Promise<UsersResultsData> {
  const adminSupabase = createAdminSupabaseClient()
  const targetTeamIds =
    input.selectedTeamId !== undefined
      ? [input.selectedTeamId]
      : input.teamOptions.map((team) => team.id)

  const [teamMembershipResult, organizationMembershipResult] = await Promise.all([
    targetTeamIds.length > 0
      ? adminSupabase
          .from("team_memberships")
          .select("id,team_id,profile_id,role,is_active")
          .eq("is_active", true)
          .in("team_id", targetTeamIds)
          .order("team_id", { ascending: true })
          .order("profile_id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    input.selectedTeamId === undefined
      ? adminSupabase
          .from("organization_memberships")
          .select("id,organization_id,profile_id,role")
          .eq("organization_id", input.activeOrganizationId)
          .eq("role", "organization_admin")
      : Promise.resolve({ data: [], error: null }),
  ])

  if (teamMembershipResult.error) {
    throw new Error(
      `Could not load team memberships: ${teamMembershipResult.error.message}`,
    )
  }

  if (organizationMembershipResult.error) {
    throw new Error(
      `Could not load organization memberships: ${organizationMembershipResult.error.message}`,
    )
  }

  const membershipRows: TeamMembershipRow[] = teamMembershipResult.data ?? []
  const organizationMembershipRows: OrganizationMembershipRow[] =
    organizationMembershipResult.data ?? []
  const organizationProfileIds = uniqueIds(
    organizationMembershipRows.map((row) => row.profile_id),
  )
  const profileIds = uniqueIds([
    ...membershipRows.map((row) => row.profile_id),
    ...organizationMembershipRows.map((row) => row.profile_id),
  ])

  if (profileIds.length === 0) {
    return {
      crews: [],
      totalCount: 0,
      currentPage: 1,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    }
  }

  const { data: profileData, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id,first_name,last_name,email,photo_url,is_active,first_seen_at")
    .in("id", profileIds)

  if (profileError) {
    throw new Error(`Could not load member profiles: ${profileError.message}`)
  }

  const profileRows: ProfileRow[] = profileData ?? []
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const teamNameById = new Map(input.teamOptions.map((team) => [team.id, team.name]))
  const linkedTeamsByProfileId = buildLinkedTeamsByProfileId({
    membershipRows,
    teamNameById,
  })

  const teamCrews = membershipRows
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)
      const teamName = teamNameById.get(membership.team_id)

      if (
        !profile ||
        !profile.is_active ||
        !teamName ||
        !shouldShowTeamMembershipInUsersList({
          organizationProfileIds,
          profileId: profile.id,
          selectedTeamId: input.selectedTeamId,
        })
      ) {
        return null
      }

      return {
        membershipKind: "team" as const,
        membershipId: membership.id,
        profileId: profile.id,
        firstName: (profile.first_name ?? "").trim(),
        lastName: (profile.last_name ?? "").trim(),
        email: (profile.email ?? "").trim(),
        fullName: buildProfileDisplayName(profile),
        avatarUrl: profile.photo_url,
        firstSeenAt: profile.first_seen_at,
        teamId: membership.team_id,
        teamName,
        linkedTeams: linkedTeamsByProfileId.get(profile.id) ?? [],
        role: membership.role,
      }
    })
    .filter((crew): crew is TeamCrewListItem => crew !== null)

  const organizationCrews = organizationMembershipRows
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)

      if (!profile || !profile.is_active) {
        return null
      }

      return {
        membershipKind: "organization" as const,
        membershipId: membership.id,
        profileId: profile.id,
        firstName: (profile.first_name ?? "").trim(),
        lastName: (profile.last_name ?? "").trim(),
        email: (profile.email ?? "").trim(),
        fullName: buildProfileDisplayName(profile),
        avatarUrl: profile.photo_url,
        firstSeenAt: profile.first_seen_at,
        teamId: null,
        teamName: "Organization",
        linkedTeams: linkedTeamsByProfileId.get(profile.id) ?? [],
        role: membership.role,
      }
    })
    .filter((crew): crew is OrganizationCrewListItem => crew !== null)

  const crews = [...organizationCrews, ...teamCrews]
    .sort((left, right) => {
      const teamDiff = left.teamName.localeCompare(right.teamName)
      if (teamDiff !== 0) {
        return teamDiff
      }

      return left.fullName.localeCompare(right.fullName)
    })
  const totalCount = crews.length
  const requestedPage = normalizePage(input.page)
  const accumulatePages = input.accumulatePages === true
  const pagination = resolveUsersPagination({
    requestedPage,
    totalItems: totalCount,
    accumulatePages,
    pageSize: USERS_PAGE_SIZE,
  })
  const rangeStart = accumulatePages
    ? 0
    : (pagination.currentPage - 1) * USERS_PAGE_SIZE
  const rangeEnd = accumulatePages
    ? pagination.currentPage * USERS_PAGE_SIZE
    : rangeStart + USERS_PAGE_SIZE
  const visibleCrews = crews.slice(rangeStart, rangeEnd)

  return {
    crews: visibleCrews,
    totalCount,
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
  }
}
