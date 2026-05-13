import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamVenueReportRow = Pick<
  Database["public"]["Tables"]["team_venue_reports"]["Row"],
  "id" | "team_venue_id" | "year" | "name" | "created_at"
>

type TeamVenueReportCampRow = Pick<
  Database["public"]["Tables"]["team_venue_report_camps"]["Row"],
  "report_id" | "camp_id"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "start_date" | "end_date"
>

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name"
>

const TEAM_VENUE_REPORT_SELECT_COLUMNS = "id,team_venue_id,year,name,created_at"
const TEAM_VENUE_REPORT_CAMP_SELECT_COLUMNS = "report_id,camp_id"
const CAMP_SELECT_COLUMNS = "id,team_venue_id,name,start_date,end_date"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const TEAM_SELECT_COLUMNS = "id,name"
const VENUE_SELECT_COLUMNS = "id,name"

export type ReportListItem = {
  id: string
  teamVenueId: string
  year: number
  name: string
  teamName: string | null
  venueName: string | null
  campCount: number
  campNames: string[]
  createdAt: string
}

export type ReportCampOption = {
  campId: string
  name: string
  startDate: string
  endDate: string
}

export type TeamReportVenueOption = {
  teamVenueId: string
  venueName: string
}

export type OrganizationReportTeamOption = {
  teamId: string
  teamName: string
}

export type OrganizationReportVenueOption = {
  teamVenueId: string
  venueName: string
  teamId: string
  teamName: string
}

export type TeamVenueReportsTabData = {
  reports: ReportListItem[]
  campOptions: ReportCampOption[]
}

export type TeamReportCreateCampOption = ReportCampOption & {
  teamVenueId: string
  year: number
}

export type TeamReportsPageData = {
  reports: ReportListItem[]
  venueOptions: TeamReportVenueOption[]
  createCampOptions: TeamReportCreateCampOption[]
}

export type OrganizationReportsPageData = {
  reports: ReportListItem[]
  teamOptions: OrganizationReportTeamOption[]
  selectedTeamId: string | null
  venueOptions: OrganizationReportVenueOption[]
  selectedVenueId: string | null
}

function parseYearFromDate(value: string): number {
  return Number.parseInt(value.slice(0, 4), 10)
}

function buildYearDateRange(year: number): { start: string; endExclusive: string } {
  return {
    start: `${year}-01-01`,
    endExclusive: `${year + 1}-01-01`,
  }
}

async function loadReportCampNamesMap(input: {
  reportRows: TeamVenueReportRow[]
}): Promise<Map<string, string[]>> {
  const reportIds = input.reportRows.map((row) => row.id)
  const supabase = await createServerSupabaseClient()

  if (reportIds.length === 0) {
    return new Map()
  }

  const { data: reportCampRows, error: reportCampsError } = await supabase
    .from("team_venue_report_camps")
    .select(TEAM_VENUE_REPORT_CAMP_SELECT_COLUMNS)
    .in("report_id", reportIds)

  if (reportCampsError) {
    throw new Error(`Could not load report camps: ${reportCampsError.message}`)
  }

  const links: TeamVenueReportCampRow[] = reportCampRows ?? []
  const campIds = [...new Set(links.map((row) => row.camp_id))]

  if (campIds.length === 0) {
    return new Map(reportIds.map((reportId) => [reportId, []]))
  }

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("id", campIds)

  if (campsError) {
    throw new Error(`Could not load camps for reports: ${campsError.message}`)
  }

  const camps: CampRow[] = campRows ?? []
  const campById = new Map(camps.map((camp) => [camp.id, camp]))

  const campRowsByReportId = new Map<string, CampRow[]>()

  for (const link of links) {
    const camp = campById.get(link.camp_id)

    if (!camp) {
      continue
    }

    const rows = campRowsByReportId.get(link.report_id) ?? []
    rows.push(camp)
    campRowsByReportId.set(link.report_id, rows)
  }

  const map = new Map<string, string[]>()

  for (const reportId of reportIds) {
    const names = (campRowsByReportId.get(reportId) ?? [])
      .sort((left, right) => {
        const dateOrder = left.start_date.localeCompare(right.start_date)
        if (dateOrder !== 0) {
          return dateOrder
        }

        return left.name.localeCompare(right.name)
      })
      .map((camp) => camp.name)

    map.set(reportId, names)
  }

  return map
}

async function loadReportListItems(input: {
  reportRows: TeamVenueReportRow[]
  teamVenueById: Map<string, TeamVenueRow>
  teamNameById: Map<string, string>
  venueNameById: Map<string, string>
}): Promise<ReportListItem[]> {
  const campNamesByReportId = await loadReportCampNamesMap({
    reportRows: input.reportRows,
  })

  return input.reportRows.map((report) => {
    const teamVenue = input.teamVenueById.get(report.team_venue_id)
    const campNames = campNamesByReportId.get(report.id) ?? []

    return {
      id: report.id,
      teamVenueId: report.team_venue_id,
      year: report.year,
      name: report.name,
      teamName: teamVenue ? (input.teamNameById.get(teamVenue.team_id) ?? null) : null,
      venueName: teamVenue ? (input.venueNameById.get(teamVenue.venue_id) ?? null) : null,
      campCount: campNames.length,
      campNames,
      createdAt: report.created_at,
    }
  })
}

async function loadCampOptions(input: {
  teamVenueId: string
  year: number
}): Promise<ReportCampOption[]> {
  const supabase = await createServerSupabaseClient()
  const range = buildYearDateRange(input.year)

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("team_venue_id", input.teamVenueId)
    .gte("start_date", range.start)
    .lt("start_date", range.endExclusive)
    .order("start_date", { ascending: true })
    .order("name", { ascending: true })

  if (campsError) {
    throw new Error(`Could not load report camp options: ${campsError.message}`)
  }

  const camps: CampRow[] = campRows ?? []

  return camps.map((camp) => ({
    campId: camp.id,
    name: camp.name,
    startDate: camp.start_date,
    endDate: camp.end_date,
  }))
}

export async function getTeamVenueReportsTabData(input: {
  teamVenueId: string
  year: number
}): Promise<TeamVenueReportsTabData> {
  const supabase = await createServerSupabaseClient()

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", input.teamVenueId)
    .maybeSingle()

  if (teamVenueError) {
    throw new Error(`Could not load team venue for reports: ${teamVenueError.message}`)
  }

  if (!teamVenueRow) {
    return {
      reports: [],
      campOptions: [],
    }
  }

  const { data: reportRows, error: reportsError } = await supabase
    .from("team_venue_reports")
    .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
    .eq("team_venue_id", input.teamVenueId)
    .eq("year", input.year)
    .order("created_at", { ascending: false })

  if (reportsError) {
    throw new Error(`Could not load team venue reports: ${reportsError.message}`)
  }

  const [teamRowsResult, venueRowsResult, campOptions] = await Promise.all([
    supabase
      .from("teams")
      .select(TEAM_SELECT_COLUMNS)
      .eq("id", teamVenueRow.team_id)
      .then((result) => {
        if (result.error) {
          throw new Error(`Could not load team for reports: ${result.error.message}`)
        }

        return result.data ?? []
      }),
    supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .eq("id", teamVenueRow.venue_id)
      .then((result) => {
        if (result.error) {
          throw new Error(`Could not load venue for reports: ${result.error.message}`)
        }

        return result.data ?? []
      }),
    loadCampOptions({
      teamVenueId: input.teamVenueId,
      year: input.year,
    }),
  ])

  const teamRows = teamRowsResult as TeamRow[]
  const venueRows = venueRowsResult as VenueRow[]
  const reports = (reportRows ?? []) as TeamVenueReportRow[]

  return {
    reports: await loadReportListItems({
      reportRows: reports,
      teamVenueById: new Map([[teamVenueRow.id, teamVenueRow as TeamVenueRow]]),
      teamNameById: new Map(teamRows.map((team) => [team.id, team.name])),
      venueNameById: new Map(venueRows.map((venue) => [venue.id, venue.name])),
    }),
    campOptions,
  }
}

export async function getTeamReportsPageData(input: {
  activeTeamId: string
}): Promise<TeamReportsPageData> {
  const supabase = await createServerSupabaseClient()

  const { data: teamVenueRows, error: teamVenuesError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenuesError) {
    throw new Error(`Could not load team venues for reports: ${teamVenuesError.message}`)
  }

  const teamVenues: TeamVenueRow[] = (teamVenueRows ?? []) as TeamVenueRow[]

  if (teamVenues.length === 0) {
    return {
      reports: [],
      venueOptions: [],
      createCampOptions: [],
    }
  }

  const venueIds = [...new Set(teamVenues.map((row) => row.venue_id))]

  const [{ data: venueRows, error: venuesError }, { data: teamRow, error: teamError }] =
    await Promise.all([
      supabase
        .from("venues")
        .select(VENUE_SELECT_COLUMNS)
        .in("id", venueIds),
      supabase
        .from("teams")
        .select(TEAM_SELECT_COLUMNS)
        .eq("id", input.activeTeamId)
        .maybeSingle(),
    ])

  if (venuesError) {
    throw new Error(`Could not load venues for team reports: ${venuesError.message}`)
  }

  if (teamError) {
    throw new Error(`Could not load team for reports: ${teamError.message}`)
  }

  const venues: VenueRow[] = (venueRows ?? []) as VenueRow[]
  const venueNameById = new Map(venues.map((venue) => [venue.id, venue.name]))
  const teamVenueById = new Map(teamVenues.map((row) => [row.id, row]))

  const venueOptions: TeamReportVenueOption[] = teamVenues
    .map((teamVenue) => ({
      teamVenueId: teamVenue.id,
      venueName: venueNameById.get(teamVenue.venue_id) ?? "Unknown venue",
    }))
    .sort((left, right) => left.venueName.localeCompare(right.venueName))

  const reportsQuery = supabase
    .from("team_venue_reports")
    .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
    .in("team_venue_id", teamVenues.map((row) => row.id))
    .order("created_at", { ascending: false })

  const { data: reportRows, error: reportsError } = await reportsQuery

  if (reportsError) {
    throw new Error(`Could not load team reports: ${reportsError.message}`)
  }

  const { data: createCampRows, error: createCampsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .in("team_venue_id", teamVenues.map((row) => row.id))
    .order("start_date", { ascending: true })
    .order("name", { ascending: true })

  if (createCampsError) {
    throw new Error(`Could not load camps for report creation: ${createCampsError.message}`)
  }

  const reports = (reportRows ?? []) as TeamVenueReportRow[]
  const createCampOptions: TeamReportCreateCampOption[] = ((createCampRows ?? []) as CampRow[])
    .map((camp) => ({
      campId: camp.id,
      teamVenueId: camp.team_venue_id,
      year: parseYearFromDate(camp.start_date),
      name: camp.name,
      startDate: camp.start_date,
      endDate: camp.end_date,
    }))
    .sort((left, right) => {
      const yearOrder = right.year - left.year

      if (yearOrder !== 0) {
        return yearOrder
      }

      const dateOrder = left.startDate.localeCompare(right.startDate)

      if (dateOrder !== 0) {
        return dateOrder
      }

      return left.name.localeCompare(right.name)
    })

  return {
    reports: await loadReportListItems({
      reportRows: reports,
      teamVenueById,
      teamNameById: new Map<string, string>(
        teamRow ? [[input.activeTeamId, teamRow.name]] : [],
      ),
      venueNameById,
    }),
    venueOptions,
    createCampOptions,
  }
}

export async function getOrganizationReportsPageData(input: {
  activeOrganizationId: string
  year: number
  selectedTeamId?: string
  selectedVenueId?: string
}): Promise<OrganizationReportsPageData> {
  const supabase = await createServerSupabaseClient()

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id,name,organization_id")
    .eq("organization_id", input.activeOrganizationId)

  if (teamsError) {
    throw new Error(`Could not load teams for organization reports: ${teamsError.message}`)
  }

  const teams: TeamRow[] = (teamRows ?? []) as TeamRow[]

  if (teams.length === 0) {
    return {
      reports: [],
      teamOptions: [],
      selectedTeamId: null,
      venueOptions: [],
      selectedVenueId: null,
    }
  }

  const teamOptions: OrganizationReportTeamOption[] = teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
    }))
    .sort((left, right) => left.teamName.localeCompare(right.teamName))

  const selectedTeamId =
    input.selectedTeamId && teamOptions.some((option) => option.teamId === input.selectedTeamId)
      ? input.selectedTeamId
      : null

  let teamVenuesQuery = supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .in("team_id", teams.map((team) => team.id))

  if (selectedTeamId) {
    teamVenuesQuery = teamVenuesQuery.eq("team_id", selectedTeamId)
  }

  const { data: teamVenueRows, error: teamVenuesError } = await teamVenuesQuery

  if (teamVenuesError) {
    throw new Error(
      `Could not load team venues for organization reports: ${teamVenuesError.message}`,
    )
  }

  const teamVenues: TeamVenueRow[] = (teamVenueRows ?? []) as TeamVenueRow[]

  if (teamVenues.length === 0) {
    return {
      reports: [],
      teamOptions,
      selectedTeamId,
      venueOptions: [],
      selectedVenueId: null,
    }
  }

  const venueIds = [...new Set(teamVenues.map((row) => row.venue_id))]
  const { data: venueRows, error: venuesError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .in("id", venueIds)

  if (venuesError) {
    throw new Error(
      `Could not load venues for organization reports: ${venuesError.message}`,
    )
  }

  const venues: VenueRow[] = (venueRows ?? []) as VenueRow[]
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
  const venueNameById = new Map(venues.map((venue) => [venue.id, venue.name]))

  const venueOptions: OrganizationReportVenueOption[] = teamVenues
    .map((teamVenue) => ({
      teamVenueId: teamVenue.id,
      venueName: venueNameById.get(teamVenue.venue_id) ?? "Unknown venue",
      teamId: teamVenue.team_id,
      teamName: teamNameById.get(teamVenue.team_id) ?? "Unknown team",
    }))
    .sort((left, right) => {
      const teamOrder = left.teamName.localeCompare(right.teamName)

      if (teamOrder !== 0) {
        return teamOrder
      }

      return left.venueName.localeCompare(right.venueName)
    })

  const selectedVenueId =
    input.selectedVenueId && venueOptions.some((option) => option.teamVenueId === input.selectedVenueId)
      ? input.selectedVenueId
      : null

  const filteredTeamVenueIds =
    selectedVenueId === null
      ? teamVenues.map((teamVenue) => teamVenue.id)
      : [selectedVenueId]

  const { data: reportRows, error: reportsError } = await supabase
    .from("team_venue_reports")
    .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
    .in("team_venue_id", filteredTeamVenueIds)
    .eq("year", input.year)
    .order("created_at", { ascending: false })

  if (reportsError) {
    throw new Error(`Could not load organization reports: ${reportsError.message}`)
  }

  return {
    reports: await loadReportListItems({
      reportRows: (reportRows ?? []) as TeamVenueReportRow[],
      teamVenueById: new Map(teamVenues.map((row) => [row.id, row])),
      teamNameById,
      venueNameById,
    }),
    teamOptions,
    selectedTeamId,
    venueOptions,
    selectedVenueId,
  }
}

export function buildDefaultReportName(input: {
  venueName: string
  year: number
  campNames: string[]
}): string {
  const campsPart = input.campNames.join(", ").trim()
  const base = `${input.venueName} ${input.year}${campsPart.length > 0 ? ` ${campsPart}` : ""}`

  return base.length <= 250 ? base : `${base.slice(0, 247)}...`
}

export function getCurrentUtcYear(): number {
  return new Date().getUTCFullYear()
}

export function formatCampDateRange(input: {
  startDate: string
  endDate: string
}): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  const start = formatter.format(new Date(`${input.startDate}T00:00:00.000Z`))
  const end = formatter.format(new Date(`${input.endDate}T00:00:00.000Z`))

  return `${start} to ${end}`
}

export function isCampYear(campStartDate: string, year: number): boolean {
  return parseYearFromDate(campStartDate) === year
}
