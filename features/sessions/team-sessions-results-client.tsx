"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { TeamSessionsResultsSkeleton } from "@/components/shared/page-skeletons"
import { Button } from "@/components/ui/button"
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  SCOPED_ROUTE_LIST_STALE_MS,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type {
  TeamSessionsChromeData,
  TeamSessionsResultsData,
} from "@/features/sessions/data"
import {
  buildTeamSessionsListApiUrl,
  buildTeamSessionsListCacheMetadataFromChrome,
  TEAM_SESSIONS_LIST_CACHE_ROUTE,
} from "@/features/sessions/team-sessions-list-cache"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamSessionsListSlicePayload = {
  cache: ApiSliceCacheMetadata
  data: TeamSessionsResultsData
}

type TeamSessionsResultsClientProps = {
  canManageSessions: boolean
  chromeData: TeamSessionsChromeData
  initialResultsData: TeamSessionsResultsData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: NavigationScope
}

type TeamSessionsListApiErrorPayload = {
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

function isTeamSessionsResultsData(value: unknown): value is TeamSessionsResultsData {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    Array.isArray(record.sessions) &&
    typeof record.currentPage === "number" &&
    typeof record.pageCount === "number" &&
    typeof record.hasPreviousPage === "boolean" &&
    typeof record.hasNextPage === "boolean"
  )
}

function isTeamSessionsListSlicePayload(
  value: unknown,
): value is TeamSessionsListSlicePayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.cache === "object" &&
    record.cache !== null &&
    isTeamSessionsResultsData(record.data)
  )
}

async function resolveTeamSessionsListApiError(response: Response): Promise<Error> {
  let payload: TeamSessionsListApiErrorPayload | null = null

  try {
    payload = (await response.json()) as TeamSessionsListApiErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null
  const detail = typeof payload?.detail === "string" ? payload.detail : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return new Error("Your session expired. Sign in again, then retry sessions.")
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return new Error("Sessions need an active team scope. Select the team and retry.")
  }

  if (response.status === 400) {
    return new Error("This sessions request is invalid. Refresh the page and try again.")
  }

  return new Error(detail ?? "Could not refresh sessions. Retry this panel.")
}

export function TeamSessionsResultsClient({
  canManageSessions,
  chromeData,
  initialResultsData,
  noTeamSelected,
  requestedLoadMoreMode,
  requestedPage,
  scope,
}: TeamSessionsResultsClientProps) {
  const cacheScope = React.useMemo(() => resolveCacheScope(scope), [scope])
  const cache = React.useMemo(
    () =>
      buildTeamSessionsListCacheMetadataFromChrome({
        chromeData,
        loadMore: requestedLoadMoreMode,
        page: requestedPage,
        scope: cacheScope,
      }),
    [cacheScope, chromeData, requestedLoadMoreMode, requestedPage],
  )
  const initialPayload = React.useMemo<TeamSessionsListSlicePayload>(
    () => ({
      cache,
      data: initialResultsData,
    }),
    [cache, initialResultsData],
  )
  const fetchFreshData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<TeamSessionsListSlicePayload> => {
      const response = await fetch(
        buildTeamSessionsListApiUrl({
          scope,
          selectedVenueId: chromeData.selectedVenueId,
          selectedCampId: chromeData.selectedCampId,
          selectedHighlight: chromeData.selectedHighlight,
          page: requestedPage,
          loadMore: requestedLoadMoreMode,
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
        throw await resolveTeamSessionsListApiError(response)
      }

      const payload = (await response.json()) as unknown

      if (!isTeamSessionsListSlicePayload(payload)) {
        throw new Error("The sessions payload did not match the expected shape.")
      }

      return payload
    },
    [chromeData, requestedLoadMoreMode, requestedPage, scope],
  )
  const validateFreshPayload = React.useCallback(
    (payload: TeamSessionsListSlicePayload) => {
      return (
        payload.cache.key === cache.key &&
        payload.cache.scopeKey === cache.scopeKey &&
        payload.cache.route === TEAM_SESSIONS_LIST_CACHE_ROUTE &&
        payload.cache.entityId === null &&
        payload.cache.tab === null &&
        payload.cache.year === null &&
        String(payload.cache.page) === String(cache.page) &&
        isTeamSessionsResultsData(payload.data)
      )
    },
    [cache],
  )
  const routeData = useStaleRouteData<TeamSessionsListSlicePayload>({
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
          <p className="text-sm font-medium">Session results unavailable.</p>
          <p className="text-sm text-muted-foreground">
            {routeData.error?.message ?? "Could not refresh sessions."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
          Retry results
        </Button>
      </div>
    )
  }

  if (!payload) {
    return <TeamSessionsResultsSkeleton />
  }

  return (
    <div className="relative">
      {showInlineError ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
        >
          <span>{routeData.error?.message ?? "Could not refresh sessions."}</span>
          <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
            Retry
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "transition-opacity",
          routeData.isRevalidating && "opacity-75",
        )}
      >
        <TeamSessionsTable
          sessions={payload.data.sessions}
          campOptions={chromeData.campOptions}
          canManageSessions={canManageSessions}
          noTeamSelected={noTeamSelected}
          scope={scope}
          selectedVenueId={chromeData.selectedVenueId}
          selectedCampId={chromeData.selectedCampId}
          selectedHighlight={chromeData.selectedHighlight}
          currentPage={payload.data.currentPage}
          pageCount={payload.data.pageCount}
          hasPreviousPage={payload.data.hasPreviousPage}
          hasNextPage={payload.data.hasNextPage}
          hideChrome
          hideCreateFab
        />
      </div>

      {routeData.isRevalidating ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="sr-only">Refreshing sessions</span>
        </div>
      ) : null}
    </div>
  )
}
