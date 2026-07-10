"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { TeamVenuesResultsSkeleton } from "@/components/shared/page-skeletons"
import { Button } from "@/components/ui/button"
import type {
  TeamVenuesChromeData,
  TeamVenuesResultsData,
} from "@/features/team-venues/data"
import {
  buildTeamVenuesListApiUrl,
  buildTeamVenuesListCacheMetadataFromChrome,
  TEAM_VENUES_LIST_CACHE_ROUTE,
} from "@/features/team-venues/team-venues-list-cache"
import { TeamVenuesTable } from "@/features/team-venues/team-venues-table"
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  SCOPED_ROUTE_LIST_STALE_MS,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamVenuesListSlicePayload = {
  cache: ApiSliceCacheMetadata
  data: TeamVenuesResultsData
}

type TeamVenuesResultsClientProps = {
  canManageVenueRows: boolean
  chromeData: TeamVenuesChromeData
  currentYear: number
  initialResultsData: TeamVenuesResultsData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: NavigationScope
}

type TeamVenuesListApiErrorPayload = {
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

function isTeamVenuesResultsData(value: unknown): value is TeamVenuesResultsData {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    Array.isArray(record.linkedVenues) &&
    record.linkedVenues.every((venue) => {
      if (typeof venue !== "object" || venue === null) {
        return false
      }

      const venueRecord = venue as Record<string, unknown>
      return (
        typeof venueRecord.id === "string" &&
        (typeof venueRecord.campCountCurrentYear === "number" ||
          venueRecord.campCountCurrentYear === null) &&
        (typeof venueRecord.totalCampCount === "number" ||
          venueRecord.totalCampCount === null)
      )
    }) &&
    typeof record.totalCount === "number" &&
    typeof record.currentPage === "number" &&
    typeof record.pageCount === "number" &&
    typeof record.hasPreviousPage === "boolean" &&
    typeof record.hasNextPage === "boolean" &&
    (record.metricsStatus === "fresh" || record.metricsStatus === "pending")
  )
}

function isTeamVenuesListSlicePayload(
  value: unknown,
): value is TeamVenuesListSlicePayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.cache === "object" &&
    record.cache !== null &&
    isTeamVenuesResultsData(record.data)
  )
}

async function resolveTeamVenuesListApiError(response: Response): Promise<Error> {
  let payload: TeamVenuesListApiErrorPayload | null = null

  try {
    payload = (await response.json()) as TeamVenuesListApiErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null
  const detail = typeof payload?.detail === "string" ? payload.detail : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return new Error("Your session expired. Sign in again, then retry venues.")
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return new Error("Venues need an active team scope. Select the team and retry.")
  }

  if (response.status === 400) {
    return new Error("This venues request is invalid. Refresh the page and try again.")
  }

  return new Error(detail ?? "Could not refresh venues. Retry this panel.")
}

export function TeamVenuesResultsClient({
  canManageVenueRows,
  chromeData,
  currentYear,
  initialResultsData,
  noTeamSelected,
  requestedLoadMoreMode,
  requestedPage,
  scope,
}: TeamVenuesResultsClientProps) {
  const cacheScope = React.useMemo(() => resolveCacheScope(scope), [scope])
  const cache = React.useMemo(
    () =>
      buildTeamVenuesListCacheMetadataFromChrome({
        chromeData,
        currentYear,
        loadMore: requestedLoadMoreMode,
        page: requestedPage,
        scope: cacheScope,
      }),
    [cacheScope, chromeData, currentYear, requestedLoadMoreMode, requestedPage],
  )
  const initialPayload = React.useMemo<TeamVenuesListSlicePayload>(
    () => ({
      cache,
      data: initialResultsData,
    }),
    [cache, initialResultsData],
  )
  const fetchFreshData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<TeamVenuesListSlicePayload> => {
      const response = await fetch(
        buildTeamVenuesListApiUrl({
          scope,
          currentYear,
          selectedStatusFilter: chromeData.selectedStatusFilter,
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
        throw await resolveTeamVenuesListApiError(response)
      }

      const payload = (await response.json()) as unknown

      if (!isTeamVenuesListSlicePayload(payload)) {
        throw new Error("The venues payload did not match the expected shape.")
      }

      return payload
    },
    [chromeData.selectedStatusFilter, currentYear, requestedLoadMoreMode, requestedPage, scope],
  )
  const validateFreshPayload = React.useCallback(
    (payload: TeamVenuesListSlicePayload) => {
      return (
        payload.cache.key === cache.key &&
        payload.cache.scopeKey === cache.scopeKey &&
        payload.cache.route === TEAM_VENUES_LIST_CACHE_ROUTE &&
        payload.cache.entityId === null &&
        payload.cache.tab === null &&
        String(payload.cache.year) === String(cache.year) &&
        payload.cache.filters === cache.filters &&
        String(payload.cache.page) === String(cache.page) &&
        isTeamVenuesResultsData(payload.data)
      )
    },
    [cache],
  )
  const routeData = useStaleRouteData<TeamVenuesListSlicePayload>({
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
          <p className="text-sm font-medium">Venue results unavailable.</p>
          <p className="text-sm text-muted-foreground">
            {routeData.error?.message ?? "Could not refresh venues."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
          Retry results
        </Button>
      </div>
    )
  }

  if (!payload) {
    return <TeamVenuesResultsSkeleton />
  }

  return (
    <div className="relative">
      {showInlineError ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
        >
          <span>{routeData.error?.message ?? "Could not refresh venues."}</span>
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
        <TeamVenuesTable
          linkedVenues={payload.data.linkedVenues}
          noTeamSelected={noTeamSelected}
          canManageVenueRows={canManageVenueRows}
          selectedStatusFilter={chromeData.selectedStatusFilter}
          scope={scope}
          currentYear={currentYear}
          currentPage={payload.data.currentPage}
          pageCount={payload.data.pageCount}
          hasPreviousPage={payload.data.hasPreviousPage}
          hasNextPage={payload.data.hasNextPage}
          loadMoreMode={requestedLoadMoreMode}
          hideChrome
        />
      </div>

      {routeData.isRevalidating ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="sr-only">Refreshing venues</span>
        </div>
      ) : null}
    </div>
  )
}
