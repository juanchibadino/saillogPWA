import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import { buildApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import type { ScopedRouteCacheScope } from "@/features/shared/scoped-route-cache"
import type {
  TeamCalendarChromeData,
  TeamCalendarEventFilter,
  TeamCalendarTimeFilter,
} from "@/features/calendar/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const TEAM_CALENDAR_LIST_CACHE_ROUTE = "team-calendar:list"

export type TeamCalendarListCacheFiltersInput = {
  selectedEventFilter?: TeamCalendarEventFilter | null
  selectedMemberId?: string | null
  selectedTimeFilter: TeamCalendarTimeFilter
}

export type TeamCalendarListCacheInput = TeamCalendarListCacheFiltersInput & {
  scope: ScopedRouteCacheScope
}

export type TeamCalendarListRequestInput = TeamCalendarListCacheFiltersInput & {
  scope: NavigationScope
}

export function buildTeamCalendarListCacheFilters(
  input: TeamCalendarListCacheFiltersInput,
) {
  return {
    event: input.selectedEventFilter?.value ?? null,
    member: input.selectedMemberId ?? null,
    time: input.selectedTimeFilter,
  }
}

export function buildTeamCalendarListCacheMetadata(
  input: TeamCalendarListCacheInput,
): ApiSliceCacheMetadata {
  return buildApiSliceCacheMetadata({
    scope: input.scope,
    route: TEAM_CALENDAR_LIST_CACHE_ROUTE,
    filters: buildTeamCalendarListCacheFilters(input),
    page: 1,
  })
}

export function buildTeamCalendarListCacheMetadataFromChrome(input: {
  chromeData: TeamCalendarChromeData
  scope: ScopedRouteCacheScope
}): ApiSliceCacheMetadata {
  return buildTeamCalendarListCacheMetadata({
    scope: input.scope,
    selectedEventFilter: input.chromeData.selectedEventFilter,
    selectedMemberId: input.chromeData.selectedMemberId,
    selectedTimeFilter: input.chromeData.selectedTimeFilter,
  })
}

export function buildTeamCalendarListApiUrl(
  input: TeamCalendarListRequestInput,
): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.selectedMemberId) {
    params.set("member", input.selectedMemberId)
  }

  if (input.selectedEventFilter) {
    params.set("event", input.selectedEventFilter.value)
  }

  if (input.selectedTimeFilter === "all") {
    params.set("time", "all")
  }

  return `/api/team-calendar/list?${params.toString()}`
}
