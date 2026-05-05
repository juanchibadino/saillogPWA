import "server-only"

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

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "photo_url" | "is_active"
>

export type CrewListItem = {
  membershipId: string
  profileId: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  teamId: string
  teamName: string
  role: Database["public"]["Enums"]["team_role_type"]
}

export type CrewTeamOption = {
  id: string
  name: string
}

export type UsersPageData = {
  crews: CrewListItem[]
  teamOptions: CrewTeamOption[]
  selectedTeamId?: string
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
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

export async function getUsersPageData(input: {
  activeOrganizationId: string
  requestedTeamId?: string
}): Promise<UsersPageData> {
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

  const targetTeamIds =
    selectedTeamId !== undefined
      ? [selectedTeamId]
      : teamOptions.map((team) => team.id)

  if (targetTeamIds.length === 0) {
    return {
      crews: [],
      teamOptions,
      selectedTeamId,
    }
  }

  const { data: membershipData, error: membershipError } = await adminSupabase
    .from("team_memberships")
    .select("id,team_id,profile_id,role,is_active")
    .eq("is_active", true)
    .in("team_id", targetTeamIds)

  if (membershipError) {
    throw new Error(`Could not load team memberships: ${membershipError.message}`)
  }

  const membershipRows: TeamMembershipRow[] = membershipData ?? []

  if (membershipRows.length === 0) {
    return {
      crews: [],
      teamOptions,
      selectedTeamId,
    }
  }

  const profileIds = uniqueIds(membershipRows.map((row) => row.profile_id))
  const { data: profileData, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id,first_name,last_name,email,photo_url,is_active")
    .in("id", profileIds)

  if (profileError) {
    throw new Error(`Could not load member profiles: ${profileError.message}`)
  }

  const profileRows: ProfileRow[] = profileData ?? []
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const teamNameById = new Map(teamOptions.map((team) => [team.id, team.name]))

  const crews = membershipRows
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)
      const teamName = teamNameById.get(membership.team_id)

      if (!profile || !profile.is_active || !teamName) {
        return null
      }

      return {
        membershipId: membership.id,
        profileId: profile.id,
        firstName: (profile.first_name ?? "").trim(),
        lastName: (profile.last_name ?? "").trim(),
        fullName: buildProfileDisplayName(profile),
        avatarUrl: profile.photo_url,
        teamId: membership.team_id,
        teamName,
        role: membership.role,
      }
    })
    .filter((crew): crew is CrewListItem => crew !== null)
    .sort((left, right) => {
      const teamDiff = left.teamName.localeCompare(right.teamName)
      if (teamDiff !== 0) {
        return teamDiff
      }

      return left.fullName.localeCompare(right.fullName)
    })

  return {
    crews,
    teamOptions,
    selectedTeamId,
  }
}
