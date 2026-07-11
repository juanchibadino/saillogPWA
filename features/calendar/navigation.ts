import { buildTeamCalendarHref as buildTeamCalendarHrefCore } from "@/features/calendar/list-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"

export type TeamCalendarTimeFilter = "future" | "all"
export type TeamCalendarEventFilter = {
  sourceType: "camp" | "event"
  sourceId: string
  value: string
}

export type TeamCalendarHrefInput = {
  scope: NavigationScope
  memberId?: string | null
  eventFilter?: TeamCalendarEventFilter | null
  timeFilter?: TeamCalendarTimeFilter | null
  status?: string
  error?: string
}

export function buildTeamCalendarHref(input: TeamCalendarHrefInput): string {
  return buildTeamCalendarHrefCore({
    scope: input.scope,
    memberId: input.memberId ?? undefined,
    eventFilter: input.eventFilter ?? undefined,
    timeFilter: input.timeFilter ?? "future",
    status: input.status,
    error: input.error,
  }) as string
}
