"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { TeamCalendarResultsSkeleton } from "@/components/shared/page-skeletons"
import { Button } from "@/components/ui/button"
import type {
  TeamCalendarChromeData,
  TeamCalendarResultsData,
} from "@/features/calendar/data"
import { TeamCalendarTimeline } from "@/features/calendar/team-calendar-timeline"
import {
  buildTeamCalendarListApiUrl,
  buildTeamCalendarListCacheMetadataFromChrome,
  TEAM_CALENDAR_LIST_CACHE_ROUTE,
} from "@/features/calendar/team-calendar-list-cache"
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  SCOPED_ROUTE_LIST_STALE_MS,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type { NavigationScope } from "@/lib/navigation/types"

type TeamCalendarListSlicePayload = {
  cache: ApiSliceCacheMetadata
  data: TeamCalendarResultsData
}

type TeamCalendarResultsClientProps = {
  canEditTargetPresence: boolean
  canManageCustomEvents: boolean
  chromeData: TeamCalendarChromeData
  initialResultsData: TeamCalendarResultsData
  noTeamSelected: boolean
  scope: NavigationScope
}

type TeamCalendarListApiErrorPayload = {
  detail?: unknown
  error?: unknown
  retryable?: unknown
}

function resolveCacheScope(scope: NavigationScope): ScopedRouteCacheScope {
  return {
    orgId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  }
}

function isTeamCalendarResultsData(value: unknown): value is TeamCalendarResultsData {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.today === "string" &&
    Array.isArray(record.items) &&
    record.items.every((item) => {
      if (typeof item !== "object" || item === null) {
        return false
      }

      const itemRecord = item as Record<string, unknown>

      if (itemRecord.type === "gap") {
        return (
          typeof itemRecord.timelineId === "string" &&
          typeof itemRecord.startDate === "string" &&
          typeof itemRecord.endDate === "string"
        )
      }

      return (
        itemRecord.type === "day" &&
        typeof itemRecord.timelineId === "string" &&
        typeof itemRecord.date === "string" &&
        typeof itemRecord.sourceId === "string" &&
        typeof itemRecord.title === "string" &&
        Array.isArray(itemRecord.presentMembers)
      )
    })
  )
}

function isTeamCalendarListSlicePayload(
  value: unknown,
): value is TeamCalendarListSlicePayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.cache === "object" &&
    record.cache !== null &&
    isTeamCalendarResultsData(record.data)
  )
}

async function resolveTeamCalendarListApiError(
  response: Response,
): Promise<Error> {
  let payload: TeamCalendarListApiErrorPayload | null = null

  try {
    payload = (await response.json()) as TeamCalendarListApiErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null
  const detail = typeof payload?.detail === "string" ? payload.detail : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return new Error("Your session expired. Sign in again, then retry calendar.")
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return new Error("Calendar needs an active team scope. Select the team and retry.")
  }

  if (response.status === 400) {
    return new Error("This calendar request is invalid. Refresh the page and try again.")
  }

  return new Error(detail ?? "Could not refresh calendar. Retry this panel.")
}

export function TeamCalendarResultsClient({
  canEditTargetPresence,
  canManageCustomEvents,
  chromeData,
  initialResultsData,
  noTeamSelected,
  scope,
}: TeamCalendarResultsClientProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath =
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname
  const cacheScope = React.useMemo(() => resolveCacheScope(scope), [scope])
  const cache = React.useMemo(
    () =>
      buildTeamCalendarListCacheMetadataFromChrome({
        chromeData,
        scope: cacheScope,
      }),
    [cacheScope, chromeData],
  )
  const initialPayload = React.useMemo<TeamCalendarListSlicePayload>(
    () => ({
      cache,
      data: initialResultsData,
    }),
    [cache, initialResultsData],
  )
  const fetchFreshData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<TeamCalendarListSlicePayload> => {
      const response = await fetch(
        buildTeamCalendarListApiUrl({
          scope,
          selectedMemberId: chromeData.selectedMemberId,
          selectedEventFilter: chromeData.selectedEventFilter,
          selectedTimeFilter: chromeData.selectedTimeFilter,
        }),
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal,
        },
      )

      if (!response.ok) {
        throw await resolveTeamCalendarListApiError(response)
      }

      const payload = (await response.json()) as unknown

      if (!isTeamCalendarListSlicePayload(payload)) {
        throw new Error("The calendar payload did not match the expected shape.")
      }

      return payload
    },
    [chromeData, scope],
  )
  const validateFreshPayload = React.useCallback(
    (payload: TeamCalendarListSlicePayload) => {
      return (
        payload.cache.key === cache.key &&
        payload.cache.scopeKey === cache.scopeKey &&
        payload.cache.route === TEAM_CALENDAR_LIST_CACHE_ROUTE &&
        payload.cache.entityId === null &&
        payload.cache.tab === null &&
        payload.cache.year === null &&
        payload.cache.filters === cache.filters &&
        String(payload.cache.page) === String(cache.page) &&
        isTeamCalendarResultsData(payload.data)
      )
    },
    [cache],
  )
  const routeData = useStaleRouteData<TeamCalendarListSlicePayload>({
    cacheKey: cache.key,
    scope: cacheScope,
    staleMs: SCOPED_ROUTE_LIST_STALE_MS,
    initialData: initialPayload,
    enabled: !noTeamSelected && scope.activeTeamId !== null,
    fetchFreshData,
    validateFreshPayload,
  })
  const payload = routeData.data ?? initialPayload
  const showBlockingError = routeData.status === "error" && !routeData.hasData
  const showInlineError = routeData.status === "error" && routeData.hasData

  if (showBlockingError) {
    return (
      <div
        role="alert"
        className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">Calendar results unavailable.</p>
          <p className="text-sm text-muted-foreground">
            {routeData.error?.message ?? "Could not refresh calendar."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
          Retry results
        </Button>
      </div>
    )
  }

  if (!payload) {
    return <TeamCalendarResultsSkeleton />
  }

  return (
    <div className="relative">
      {showInlineError ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
        >
          <span>{routeData.error?.message ?? "Could not refresh calendar."}</span>
          <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
            Retry
          </Button>
        </div>
      ) : null}

      <div>
        <TeamCalendarTimeline
          items={payload.data.items}
          today={payload.data.today}
          chromeData={chromeData}
          canEditTargetPresence={canEditTargetPresence}
          canManageCustomEvents={canManageCustomEvents}
          noTeamSelected={noTeamSelected}
          returnPath={returnPath}
          scope={scope}
        />
      </div>
    </div>
  )
}
