import "server-only"

import { buildTeamCalendarTimeline } from "@/features/calendar/timeline-core.mjs"
import { normalizeCalendarSelectedId } from "@/features/calendar/list-route-state.mjs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "photo_url" | "is_active"
>
type TeamMembershipRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "profile_id" | "role" | "is_active" | "joined_at" | "created_at"
>
type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id" | "created_at"
>
type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country"
>
type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  | "id"
  | "team_venue_id"
  | "name"
  | "camp_type"
  | "start_date"
  | "end_date"
  | "notes"
  | "is_active"
  | "created_at"
>
type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"]
type CalendarPresenceRow = Database["public"]["Tables"]["calendar_presence"]["Row"]

export type TeamCalendarTimeFilter = "future" | "all"
export type TeamCalendarSourceType = "camp" | "event"
export type TeamCalendarEventType =
  | "camp"
  | Database["public"]["Enums"]["calendar_event_type"]

export type TeamCalendarEventFilter = {
  sourceType: TeamCalendarSourceType
  sourceId: string
  value: string
}

export type TeamCalendarMemberOption = {
  id: string
  name: string
  initials: string
  role: Database["public"]["Enums"]["team_role_type"]
  roleLabel: string
  avatarUrl: string | null
}

export type TeamCalendarEventOption = {
  sourceType: TeamCalendarSourceType
  sourceId: string
  value: string
  label: string
  eventType: TeamCalendarEventType
  dateRangeLabel: string
}

export type TeamCalendarTimelineMember = {
  id: string
  name: string
  initials: string
  roleLabel: string
  avatarUrl: string | null
}

export type TeamCalendarTimelineDayItem = {
  type: "day"
  timelineId: string
  date: string
  sourceType: TeamCalendarSourceType
  sourceId: string
  sourceValue: string
  title: string
  eventType: TeamCalendarEventType
  startDate: string
  endDate: string
  venueName: string | null
  notes: string | null
  isFirstDay: boolean
  isLastDay: boolean
  presentMembers: TeamCalendarTimelineMember[]
  presenceCount: number
  targetProfileId: string | null
  isTargetPresent: boolean
}

export type TeamCalendarTimelineGapItem = {
  type: "gap"
  timelineId: string
  startDate: string
  endDate: string
}

export type TeamCalendarTimelineItem =
  | TeamCalendarTimelineDayItem
  | TeamCalendarTimelineGapItem

export type TeamCalendarChromeData = {
  eventFilterOptions: TeamCalendarEventOption[]
  selectedEventFilter?: TeamCalendarEventFilter
  selectedMemberId?: string
  selectedTimeFilter: TeamCalendarTimeFilter
  targetMember: TeamCalendarMemberOption | null
  teamMembers: TeamCalendarMemberOption[]
}

export type TeamCalendarResultsData = {
  items: TeamCalendarTimelineItem[]
  today: string
}

type TeamCalendarSource = {
  id: string
  sourceType: TeamCalendarSourceType
  title: string
  eventType: TeamCalendarEventType
  startDate: string
  endDate: string
  venueName: string | null
  notes: string | null
}

type PresenceBySourceDate = Record<string, Record<string, string[]>>

const TEAM_MEMBER_ROLE_SORT_ORDER: Record<
  Database["public"]["Enums"]["team_role_type"],
  number
> = {
  team_admin: 0,
  coach: 1,
  crew: 2,
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function getTodayDateKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatTeamRoleLabel(role: Database["public"]["Enums"]["team_role_type"]): string {
  if (role === "team_admin") {
    return "Team admin"
  }

  if (role === "coach") {
    return "Coach"
  }

  return "Crew"
}

function buildProfileDisplayName(profile: ProfileRow): string {
  const fullName = [profile.first_name, profile.last_name]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(" ")

  if (fullName.length > 0) {
    return fullName
  }

  return profile.email ?? "Team member"
}

function buildInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "TM"
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date)
}

function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDateLabel(startDate)
  }

  return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`
}

function getSourceValue(sourceType: TeamCalendarSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`
}

function toEventFilter(value: string | null | undefined): TeamCalendarEventFilter | undefined {
  if (!value) {
    return undefined
  }

  const [sourceType, sourceId] = value.split(":")

  if ((sourceType !== "camp" && sourceType !== "event") || !sourceId) {
    return undefined
  }

  return {
    sourceType,
    sourceId,
    value,
  }
}

async function getTeamMembers(activeTeamId: string): Promise<TeamCalendarMemberOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data: membershipData, error: membershipError } = await supabase
    .from("team_memberships")
    .select("profile_id,role,is_active,joined_at,created_at")
    .eq("team_id", activeTeamId)
    .eq("is_active", true)

  if (membershipError) {
    throw new Error(`Could not load calendar team members: ${membershipError.message}`)
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
    throw new Error(`Could not load calendar profiles: ${profileError.message}`)
  }

  const profileRows: ProfileRow[] = profileData ?? []
  const profileById = new Map(profileRows.map((row) => [row.id, row]))

  return membershipRows
    .map((membership) => {
      const profile = profileById.get(membership.profile_id)

      if (!profile || !profile.is_active) {
        return null
      }

      const name = buildProfileDisplayName(profile)

      return {
        id: profile.id,
        name,
        initials: buildInitials(name),
        role: membership.role,
        roleLabel: formatTeamRoleLabel(membership.role),
        avatarUrl: profile.photo_url,
      }
    })
    .filter((row): row is TeamCalendarMemberOption => row !== null)
    .sort((left, right) => {
      const roleDiff =
        TEAM_MEMBER_ROLE_SORT_ORDER[left.role] - TEAM_MEMBER_ROLE_SORT_ORDER[right.role]

      if (roleDiff !== 0) {
        return roleDiff
      }

      return left.name.localeCompare(right.name)
    })
}

async function getTeamCalendarSources(activeTeamId: string): Promise<TeamCalendarSource[]> {
  const supabase = await createServerSupabaseClient()
  const { data: teamVenueData, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id,created_at")
    .eq("team_id", activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load calendar team venues: ${teamVenueError.message}`)
  }

  const teamVenueRows: TeamVenueRow[] = teamVenueData ?? []
  const teamVenueIds = teamVenueRows.map((row) => row.id)
  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))
  let venueRows: VenueRow[] = []
  let campRows: CampRow[] = []

  if (venueIds.length > 0) {
    const { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select("id,name,city,country")
      .in("id", venueIds)

    if (venueError) {
      throw new Error(`Could not load calendar venues: ${venueError.message}`)
    }

    venueRows = venueData ?? []
  }

  if (teamVenueIds.length > 0) {
    const { data: campData, error: campError } = await supabase
      .from("camps")
      .select("id,team_venue_id,name,camp_type,start_date,end_date,notes,is_active,created_at")
      .in("team_venue_id", teamVenueIds)
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: true })

    if (campError) {
      throw new Error(`Could not load calendar camps: ${campError.message}`)
    }

    campRows = campData ?? []
  }

  const { data: eventData, error: eventError } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("team_id", activeTeamId)
    .eq("is_active", true)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (eventError) {
    throw new Error(`Could not load custom calendar events: ${eventError.message}`)
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))
  const teamVenueById = new Map(teamVenueRows.map((row) => [row.id, row]))
  const campSources = campRows.reduce<TeamCalendarSource[]>((sources, camp) => {
    const teamVenue = teamVenueById.get(camp.team_venue_id)
    const venue = teamVenue ? venueById.get(teamVenue.venue_id) : null

    if (!teamVenue) {
      return sources
    }

    sources.push({
      id: camp.id,
      sourceType: "camp" as const,
      title: camp.name,
      eventType: "camp" as const,
      startDate: camp.start_date,
      endDate: camp.end_date,
      venueName: venue ? venue.name : null,
      notes: camp.notes,
    })

    return sources
  }, [])

  const eventRows: CalendarEventRow[] = eventData ?? []
  const customEventSources: TeamCalendarSource[] = eventRows.map((event) => ({
    id: event.id,
    sourceType: "event",
    title: event.title,
    eventType: event.event_type,
    startDate: event.start_date,
    endDate: event.end_date,
    venueName: null,
    notes: event.notes,
  }))

  return [...campSources, ...customEventSources]
}

function buildEventOptions(sources: TeamCalendarSource[]): TeamCalendarEventOption[] {
  return sources
    .map((source) => ({
      sourceType: source.sourceType,
      sourceId: source.id,
      value: getSourceValue(source.sourceType, source.id),
      label: source.title,
      eventType: source.eventType,
      dateRangeLabel: formatDateRangeLabel(source.startDate, source.endDate),
    }))
    .sort((left, right) => {
      const labelDiff = left.label.localeCompare(right.label)
      return labelDiff !== 0 ? labelDiff : left.value.localeCompare(right.value)
    })
}

async function getCalendarPresenceBySourceDate(
  sources: TeamCalendarSource[],
): Promise<PresenceBySourceDate> {
  const supabase = await createServerSupabaseClient()
  const campIds = sources
    .filter((source) => source.sourceType === "camp")
    .map((source) => source.id)
  const eventIds = sources
    .filter((source) => source.sourceType === "event")
    .map((source) => source.id)
  const rows: CalendarPresenceRow[] = []

  if (campIds.length > 0) {
    const { data, error } = await supabase
      .from("calendar_presence")
      .select("*")
      .eq("source_type", "camp")
      .in("camp_id", campIds)

    if (error) {
      throw new Error(`Could not load camp presence: ${error.message}`)
    }

    rows.push(...(data ?? []))
  }

  if (eventIds.length > 0) {
    const { data, error } = await supabase
      .from("calendar_presence")
      .select("*")
      .eq("source_type", "event")
      .in("calendar_event_id", eventIds)

    if (error) {
      throw new Error(`Could not load event presence: ${error.message}`)
    }

    rows.push(...(data ?? []))
  }

  const presenceBySourceDate: PresenceBySourceDate = {}

  for (const row of rows) {
    const sourceId = row.source_type === "camp" ? row.camp_id : row.calendar_event_id

    if (!sourceId) {
      continue
    }

    const sourceValue = getSourceValue(row.source_type, sourceId)
    presenceBySourceDate[sourceValue] ??= {}
    presenceBySourceDate[sourceValue][row.presence_date] ??= []
    presenceBySourceDate[sourceValue][row.presence_date].push(row.profile_id)
  }

  return presenceBySourceDate
}

function getSelectedEventFilter(input: {
  requestedEventFilterValue?: string
  options: TeamCalendarEventOption[]
}): TeamCalendarEventFilter | undefined {
  const eventFilter = toEventFilter(input.requestedEventFilterValue)

  if (!eventFilter) {
    return undefined
  }

  const allowedValues = new Set(input.options.map((option) => option.value))
  return allowedValues.has(eventFilter.value) ? eventFilter : undefined
}

function mapTimelineDayItem(input: {
  coreItem: Record<string, unknown>
  memberById: Map<string, TeamCalendarMemberOption>
}): TeamCalendarTimelineDayItem {
  const presentProfileIds = Array.isArray(input.coreItem.presentProfileIds)
    ? input.coreItem.presentProfileIds.filter(
        (value): value is string => typeof value === "string",
      )
    : []
  const presentMembers = presentProfileIds
    .map((profileId) => input.memberById.get(profileId) ?? null)
    .filter((member): member is TeamCalendarMemberOption => member !== null)
    .map((member) => ({
      id: member.id,
      name: member.name,
      initials: member.initials,
      roleLabel: member.roleLabel,
      avatarUrl: member.avatarUrl,
    }))

  return {
    type: "day",
    timelineId: String(input.coreItem.timelineId),
    date: String(input.coreItem.date),
    sourceType: input.coreItem.sourceType === "event" ? "event" : "camp",
    sourceId: String(input.coreItem.sourceId),
    sourceValue: String(input.coreItem.sourceValue),
    title: String(input.coreItem.title),
    eventType:
      input.coreItem.eventType === "meeting" ||
      input.coreItem.eventType === "travel" ||
      input.coreItem.eventType === "logistics" ||
      input.coreItem.eventType === "other"
        ? input.coreItem.eventType
        : "camp",
    startDate: String(input.coreItem.startDate),
    endDate: String(input.coreItem.endDate),
    venueName:
      typeof input.coreItem.venueName === "string" ? input.coreItem.venueName : null,
    notes: typeof input.coreItem.notes === "string" ? input.coreItem.notes : null,
    isFirstDay: input.coreItem.isFirstDay === true,
    isLastDay: input.coreItem.isLastDay === true,
    presentMembers,
    presenceCount: presentMembers.length,
    targetProfileId:
      typeof input.coreItem.targetProfileId === "string"
        ? input.coreItem.targetProfileId
        : null,
    isTargetPresent: input.coreItem.isTargetPresent === true,
  }
}

function mapTimelineItems(input: {
  coreItems: unknown[]
  memberById: Map<string, TeamCalendarMemberOption>
}): TeamCalendarTimelineItem[] {
  return input.coreItems
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null
      }

      const record = item as Record<string, unknown>

      if (record.type === "gap") {
        return {
          type: "gap" as const,
          timelineId: String(record.timelineId),
          startDate: String(record.startDate),
          endDate: String(record.endDate),
        }
      }

      return mapTimelineDayItem({
        coreItem: record,
        memberById: input.memberById,
      })
    })
    .filter((item): item is TeamCalendarTimelineItem => item !== null)
}

export async function getTeamCalendarChromeData(input: {
  activeTeamId: string
  currentProfileId: string | null
  requestedEventFilterValue?: string
  requestedMemberId?: string
  requestedTimeFilter: TeamCalendarTimeFilter
}): Promise<TeamCalendarChromeData> {
  const [teamMembers, sources] = await Promise.all([
    getTeamMembers(input.activeTeamId),
    getTeamCalendarSources(input.activeTeamId),
  ])
  const eventFilterOptions = buildEventOptions(sources)
  const selectedEventFilter = getSelectedEventFilter({
    requestedEventFilterValue: input.requestedEventFilterValue,
    options: eventFilterOptions,
  })
  const selectedMemberId = normalizeCalendarSelectedId({
    selectedId: input.requestedMemberId,
    allowedIds: new Set(teamMembers.map((member) => member.id)),
  })
  const targetMemberId = selectedMemberId ?? input.currentProfileId ?? undefined
  const targetMember =
    targetMemberId ? teamMembers.find((member) => member.id === targetMemberId) ?? null : null

  return {
    eventFilterOptions,
    selectedEventFilter,
    selectedMemberId,
    selectedTimeFilter: input.requestedTimeFilter,
    targetMember,
    teamMembers,
  }
}

export function getEmptyTeamCalendarChromeData(input: {
  requestedEventFilterValue?: string
  requestedMemberId?: string
  requestedTimeFilter: TeamCalendarTimeFilter
}): TeamCalendarChromeData {
  return {
    eventFilterOptions: [],
    selectedEventFilter: toEventFilter(input.requestedEventFilterValue),
    selectedMemberId: input.requestedMemberId,
    selectedTimeFilter: input.requestedTimeFilter,
    targetMember: null,
    teamMembers: [],
  }
}

export async function getTeamCalendarResultsData(input: {
  activeTeamId: string
  chromeData: TeamCalendarChromeData
}): Promise<TeamCalendarResultsData> {
  const today = getTodayDateKey()
  const sources = await getTeamCalendarSources(input.activeTeamId)
  const visibleSources = input.chromeData.selectedEventFilter
    ? sources.filter(
        (source) =>
          getSourceValue(source.sourceType, source.id) ===
          input.chromeData.selectedEventFilter?.value,
      )
    : sources
  const presenceBySourceDate = await getCalendarPresenceBySourceDate(visibleSources)
  const memberById = new Map(
    input.chromeData.teamMembers.map((member) => [member.id, member]),
  )
  const coreItems = buildTeamCalendarTimeline({
    sources: visibleSources,
    today,
    timeFilter: input.chromeData.selectedTimeFilter,
    selectedEventFilter: input.chromeData.selectedEventFilter,
    targetProfileId: input.chromeData.targetMember?.id ?? null,
    presenceBySourceDate,
  }) as unknown[]

  return {
    items: mapTimelineItems({
      coreItems,
      memberById,
    }),
    today,
  }
}
