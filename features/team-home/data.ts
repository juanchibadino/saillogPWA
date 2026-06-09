import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type TeamHomeKpi = {
  label: string
  value: string
  note: string
}

export type TeamHomeLatestSession = {
  id: string
  dateLabel: string
  type: "Training" | "Regatta"
  duration: string
  venueName: string
}

export type TeamHomeLatestVenue = {
  id: string
  name: string
  location: string
  linkedAtLabel: string
}

export type TeamHomeLatestCamp = {
  id: string
  name: string
  dateRangeLabel: string
  venueName: string
}

export type TeamHomeCurrentCamp = {
  id: string
  name: string
  dateRangeLabel: string
  venueName: string
  phase: string
}

export type TeamHomePerson = {
  id: string
  name: string
  roleLabel: string
  avatarUrl: string | null
}

export type TeamHomeMockData = {
  kpis: TeamHomeKpi[]
  latestSessions: TeamHomeLatestSession[]
  latestVenues: TeamHomeLatestVenue[]
  latestCamps: TeamHomeLatestCamp[]
  currentCamp: TeamHomeCurrentCamp | null
  coaches: TeamHomePerson[]
  crew: TeamHomePerson[]
}

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id" | "created_at"
>

type TeamVenueIdRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id"
>

type CampIdRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id"
>

type SessionNetTimeRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "net_time_minutes"
>

type TeamMembershipRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "profile_id" | "role" | "joined_at" | "created_at" | "is_active"
>

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "photo_url" | "is_active"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country"
>

export type TeamHomeLatestVenueLive = {
  teamVenueId: string
  venueId: string
  name: string
  location: string
  linkedAt: string
}

export type TeamHomeTeamMemberLive = {
  id: string
  name: string
  role: Database["public"]["Enums"]["team_role_type"]
  roleLabel: string
  avatarUrl: string | null
}

function buildVenueLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function formatHoursAndMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

function formatTotalNetTime(minutes: number): string {
  if (minutes <= 0) {
    return "00h 00m"
  }

  const totalDays = Math.floor(minutes / (24 * 60))
  const remainingMinutesAfterDays = minutes - totalDays * 24 * 60
  const hours = Math.floor(remainingMinutesAfterDays / 60)
  const restMinutes = remainingMinutesAfterDays % 60

  if (totalDays > 0) {
    return `${totalDays}d ${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
  }

  return `${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
}

function buildKpis(input: {
  campCount: number
  sessionCount: number
  sessionsWithNetTime: number
  totalNetTimeMinutes: number
  averageNetTimeMinutes: number | null
}): TeamHomeKpi[] {
  return [
    {
      label: "Total Camps",
      value: String(input.campCount),
      note: "Current team",
    },
    {
      label: "Total Sessions",
      value: String(input.sessionCount),
      note: "Current team",
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(input.averageNetTimeMinutes),
      note:
        input.sessionsWithNetTime > 0
          ? `${input.sessionsWithNetTime} sessions with net time`
          : "No net time recorded",
    },
    {
      label: "Net Time Sailed",
      value: formatTotalNetTime(input.totalNetTimeMinutes),
      note: "Sum of net time for team",
    },
  ]
}

function formatTeamRoleLabel(
  role: Database["public"]["Enums"]["team_role_type"],
): string {
  if (role === "team_admin") {
    return "Team Admin"
  }

  if (role === "coach") {
    return "Coach"
  }

  return "Crew"
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

const TEAM_MEMBER_ROLE_SORT_ORDER: Record<
  Database["public"]["Enums"]["team_role_type"],
  number
> = {
  team_admin: 0,
  coach: 1,
  crew: 2,
}

export async function getTeamHomeLatestVenues(input: {
  activeTeamId: string
  limit?: number
}): Promise<TeamHomeLatestVenueLive[]> {
  const supabase = await createServerSupabaseClient()
  const limit = input.limit ?? 5

  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id,created_at")
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (teamVenueError) {
    throw new Error(`Could not load latest team venues: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueRow[] = teamVenueData ?? []

  if (teamVenueRows.length === 0) {
    return []
  }

  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))
  const { data: venueData, error: venueError } = await supabase
    .from("venues")
    .select("id,name,city,country")
    .in("id", venueIds)

  if (venueError) {
    throw new Error(`Could not load venue metadata for team home: ${venueError.message}`)
  }

  const venueRows: VenueRow[] = venueData ?? []
  const venueById = new Map(venueRows.map((row) => [row.id, row]))

  return teamVenueRows
    .map((row) => {
      const venue = venueById.get(row.venue_id)

      if (!venue) {
        return null
      }

      return {
        teamVenueId: row.id,
        venueId: venue.id,
        name: venue.name,
        location: buildVenueLocation(venue.city, venue.country),
        linkedAt: row.created_at,
      }
    })
    .filter((row): row is TeamHomeLatestVenueLive => row !== null)
}

export async function getTeamHomeKpis(input: {
  activeTeamId: string
}): Promise<TeamHomeKpi[]> {
  const supabase = await createServerSupabaseClient()
  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load team venues for team home KPIs: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueIdRow[] = teamVenueData ?? []
  const teamVenueIds = teamVenueRows.map((row) => row.id)

  if (teamVenueIds.length === 0) {
    return buildKpis({
      campCount: 0,
      sessionCount: 0,
      sessionsWithNetTime: 0,
      totalNetTimeMinutes: 0,
      averageNetTimeMinutes: null,
    })
  }

  const { data: campData, error: campError } = await supabase
    .from("camps")
    .select("id")
    .in("team_venue_id", teamVenueIds)

  if (campError) {
    throw new Error(`Could not load camps for team home KPIs: ${campError.message}`)
  }

  const campRows: CampIdRow[] = campData ?? []
  const campIds = campRows.map((row) => row.id)

  if (campIds.length === 0) {
    return buildKpis({
      campCount: campRows.length,
      sessionCount: 0,
      sessionsWithNetTime: 0,
      totalNetTimeMinutes: 0,
      averageNetTimeMinutes: null,
    })
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("net_time_minutes")
    .in("camp_id", campIds)

  if (sessionError) {
    throw new Error(`Could not load sessions for team home KPIs: ${sessionError.message}`)
  }

  const sessionRows: SessionNetTimeRow[] = sessionData ?? []
  const sessionsWithNetTimeValues = sessionRows
    .map((row) => row.net_time_minutes)
    .filter((minutes): minutes is number => typeof minutes === "number")

  const totalNetTimeMinutes = sessionsWithNetTimeValues.reduce(
    (sum, minutes) => sum + minutes,
    0,
  )
  const averageNetTimeMinutes =
    sessionsWithNetTimeValues.length > 0
      ? Math.round(totalNetTimeMinutes / sessionsWithNetTimeValues.length)
      : null

  return buildKpis({
    campCount: campRows.length,
    sessionCount: sessionRows.length,
    sessionsWithNetTime: sessionsWithNetTimeValues.length,
    totalNetTimeMinutes,
    averageNetTimeMinutes,
  })
}

export async function getTeamHomeTeamMembers(input: {
  activeTeamId: string
}): Promise<TeamHomeTeamMemberLive[]> {
  const supabase = await createServerSupabaseClient()

  const { data: membershipData, error: membershipError } = await supabase
    .from("team_memberships")
    .select("profile_id,role,joined_at,created_at,is_active")
    .eq("team_id", input.activeTeamId)
    .eq("is_active", true)

  if (membershipError) {
    throw new Error(`Could not load team memberships for team home: ${membershipError.message}`)
  }

  const membershipRows: TeamMembershipRow[] = membershipData ?? []

  if (membershipRows.length === 0) {
    return []
  }

  const profileIds = uniqueIds(membershipRows.map((row) => row.profile_id))
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,email,photo_url,is_active")
    .in("id", profileIds)

  if (profileError) {
    throw new Error(`Could not load profiles for team home roster: ${profileError.message}`)
  }

  const profileRows: ProfileRow[] = profileData ?? []
  const profileById = new Map(profileRows.map((row) => [row.id, row]))

  return membershipRows
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)

      if (!profile || !profile.is_active) {
        return null
      }

      return {
        id: profile.id,
        name: buildProfileDisplayName(profile),
        role: membership.role,
        roleLabel: formatTeamRoleLabel(membership.role),
        avatarUrl: profile.photo_url,
      }
    })
    .filter((row): row is TeamHomeTeamMemberLive => row !== null)
    .sort((left, right) => {
      const roleDiff =
        TEAM_MEMBER_ROLE_SORT_ORDER[left.role] - TEAM_MEMBER_ROLE_SORT_ORDER[right.role]

      if (roleDiff !== 0) {
        return roleDiff
      }

      return left.name.localeCompare(right.name)
    })
}

export const teamHomeMockData: TeamHomeMockData = {
  kpis: [
    {
      label: "Total Camps",
      value: "6",
      note: "Fixed mock KPI",
    },
    {
      label: "Total Sessions",
      value: "41",
      note: "Fixed mock KPI",
    },
    {
      label: "Avg. Session",
      value: "02h 48m",
      note: "Fixed mock KPI",
    },
    {
      label: "Net Time Sailed",
      value: "4d 19h 04m",
      note: "Fixed mock KPI",
    },
  ],
  latestSessions: [
    {
      id: "session-1",
      dateLabel: "Apr 9, 2026",
      type: "Training",
      duration: "2h 35m",
      venueName: "Palma Bay",
    },
    {
      id: "session-2",
      dateLabel: "Apr 8, 2026",
      type: "Training",
      duration: "3h 02m",
      venueName: "Palma Bay",
    },
    {
      id: "session-3",
      dateLabel: "Apr 7, 2026",
      type: "Training",
      duration: "2h 48m",
      venueName: "Port d'Andratx",
    },
    {
      id: "session-4",
      dateLabel: "Apr 6, 2026",
      type: "Regatta",
      duration: "3h 20m",
      venueName: "Palma Bay",
    },
    {
      id: "session-5",
      dateLabel: "Apr 5, 2026",
      type: "Training",
      duration: "1h 55m",
      venueName: "Port d'Andratx",
    },
  ],
  latestVenues: [
    {
      id: "venue-1",
      name: "Palma Bay",
      location: "Palma, Spain",
      linkedAtLabel: "Linked Apr 2, 2026",
    },
    {
      id: "venue-2",
      name: "Port d'Andratx",
      location: "Mallorca, Spain",
      linkedAtLabel: "Linked Mar 18, 2026",
    },
    {
      id: "venue-3",
      name: "Hyeres East",
      location: "Hyeres, France",
      linkedAtLabel: "Linked Feb 25, 2026",
    },
  ],
  latestCamps: [
    {
      id: "camp-1",
      name: "Spring Build Camp",
      dateRangeLabel: "Apr 3 - Apr 11, 2026",
      venueName: "Palma Bay",
    },
    {
      id: "camp-2",
      name: "Speed Week",
      dateRangeLabel: "Mar 14 - Mar 20, 2026",
      venueName: "Port d'Andratx",
    },
    {
      id: "camp-3",
      name: "Pre-Regatta Block",
      dateRangeLabel: "Feb 21 - Feb 28, 2026",
      venueName: "Hyeres East",
    },
  ],
  currentCamp: null,
  coaches: [
    {
      id: "coach-1",
      name: "Marta Ruiz",
      roleLabel: "Head Coach",
      avatarUrl: null,
    },
    {
      id: "coach-2",
      name: "Leo Ferrer",
      roleLabel: "Performance Coach",
      avatarUrl: null,
    },
  ],
  crew: [
    {
      id: "crew-1",
      name: "Daniel Soto",
      roleLabel: "Helm",
      avatarUrl: null,
    },
    {
      id: "crew-2",
      name: "Nadia Costa",
      roleLabel: "Trimmer",
      avatarUrl: null,
    },
    {
      id: "crew-3",
      name: "Hugo Serra",
      roleLabel: "Bow",
      avatarUrl: null,
    },
    {
      id: "crew-4",
      name: "Laura Vidal",
      roleLabel: "Main",
      avatarUrl: null,
    },
  ],
}
