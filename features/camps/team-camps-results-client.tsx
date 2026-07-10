"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { TeamCampsResultsSkeleton } from "@/components/shared/page-skeletons"
import { Button } from "@/components/ui/button"
import type { TeamCampsChromeData, TeamCampsResultsData } from "@/features/camps/data"
import { TeamCampsTable } from "@/features/camps/camps-table"
import {
  buildTeamCampsListApiUrl,
  buildTeamCampsListCacheMetadataFromChrome,
  TEAM_CAMPS_LIST_CACHE_ROUTE,
} from "@/features/camps/team-camps-list-cache"
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  SCOPED_ROUTE_LIST_STALE_MS,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamCampsListSlicePayload = {
  cache: ApiSliceCacheMetadata
  data: TeamCampsResultsData
}

type TeamCampsResultsClientProps = {
  canDeleteCampRows: boolean
  canManageCamps: boolean
  chromeData: TeamCampsChromeData
  initialResultsData: TeamCampsResultsData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: NavigationScope
}

type TeamCampsListApiErrorPayload = {
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

function isTeamCampsResultsData(value: unknown): value is TeamCampsResultsData {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    Array.isArray(record.camps) &&
    record.camps.every((camp) => {
      if (typeof camp !== "object" || camp === null) {
        return false
      }

      const campRecord = camp as Record<string, unknown>
      return (
        typeof campRecord.id === "string" &&
        (typeof campRecord.sessionCount === "number" ||
          campRecord.sessionCount === null)
      )
    }) &&
    typeof record.currentPage === "number" &&
    typeof record.pageCount === "number" &&
    typeof record.hasPreviousPage === "boolean" &&
    typeof record.hasNextPage === "boolean" &&
    (record.sessionCountsStatus === "fresh" ||
      record.sessionCountsStatus === "pending")
  )
}

function isTeamCampsListSlicePayload(
  value: unknown,
): value is TeamCampsListSlicePayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.cache === "object" &&
    record.cache !== null &&
    isTeamCampsResultsData(record.data)
  )
}

async function resolveTeamCampsListApiError(response: Response): Promise<Error> {
  let payload: TeamCampsListApiErrorPayload | null = null

  try {
    payload = (await response.json()) as TeamCampsListApiErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null
  const detail = typeof payload?.detail === "string" ? payload.detail : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return new Error("Your session expired. Sign in again, then retry camps.")
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return new Error("Camps need an active team scope. Select the team and retry.")
  }

  if (response.status === 400) {
    return new Error("This camps request is invalid. Refresh the page and try again.")
  }

  return new Error(detail ?? "Could not refresh camps. Retry this panel.")
}

export function TeamCampsResultsClient({
  canDeleteCampRows,
  canManageCamps,
  chromeData,
  initialResultsData,
  noTeamSelected,
  requestedLoadMoreMode,
  requestedPage,
  scope,
}: TeamCampsResultsClientProps) {
  const cacheScope = React.useMemo(() => resolveCacheScope(scope), [scope])
  const cache = React.useMemo(
    () =>
      buildTeamCampsListCacheMetadataFromChrome({
        chromeData,
        loadMore: requestedLoadMoreMode,
        page: requestedPage,
        scope: cacheScope,
      }),
    [cacheScope, chromeData, requestedLoadMoreMode, requestedPage],
  )
  const initialPayload = React.useMemo<TeamCampsListSlicePayload>(
    () => ({
      cache,
      data: initialResultsData,
    }),
    [cache, initialResultsData],
  )
  const fetchFreshData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<TeamCampsListSlicePayload> => {
      const response = await fetch(
        buildTeamCampsListApiUrl({
          scope,
          selectedVenueId: chromeData.selectedVenueId,
          selectedCampType: chromeData.selectedCampType,
          selectedCampStatus: chromeData.selectedCampStatus,
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
        throw await resolveTeamCampsListApiError(response)
      }

      const payload = (await response.json()) as unknown

      if (!isTeamCampsListSlicePayload(payload)) {
        throw new Error("The camps payload did not match the expected shape.")
      }

      return payload
    },
    [chromeData, requestedLoadMoreMode, requestedPage, scope],
  )
  const validateFreshPayload = React.useCallback(
    (payload: TeamCampsListSlicePayload) => {
      return (
        payload.cache.key === cache.key &&
        payload.cache.scopeKey === cache.scopeKey &&
        payload.cache.route === TEAM_CAMPS_LIST_CACHE_ROUTE &&
        payload.cache.entityId === null &&
        payload.cache.tab === null &&
        payload.cache.year === null &&
        payload.cache.filters === cache.filters &&
        String(payload.cache.page) === String(cache.page) &&
        isTeamCampsResultsData(payload.data)
      )
    },
    [cache],
  )
  const routeData = useStaleRouteData<TeamCampsListSlicePayload>({
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
          <p className="text-sm font-medium">Camp results unavailable.</p>
          <p className="text-sm text-muted-foreground">
            {routeData.error?.message ?? "Could not refresh camps."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={routeData.retry}>
          Retry results
        </Button>
      </div>
    )
  }

  if (!payload) {
    return <TeamCampsResultsSkeleton />
  }

  return (
    <div className="relative">
      {showInlineError ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
        >
          <span>{routeData.error?.message ?? "Could not refresh camps."}</span>
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
        <TeamCampsTable
          camps={payload.data.camps}
          teamVenueOptions={chromeData.teamVenueOptions}
          canManageCamps={canManageCamps}
          canDeleteCamps={canDeleteCampRows}
          noTeamSelected={noTeamSelected}
          scope={scope}
          selectedVenueId={chromeData.selectedVenueId}
          selectedCampType={chromeData.selectedCampType}
          selectedCampStatus={chromeData.selectedCampStatus}
          currentPage={payload.data.currentPage}
          pageCount={payload.data.pageCount}
          hasPreviousPage={payload.data.hasPreviousPage}
          hasNextPage={payload.data.hasNextPage}
          hideChrome
        />
      </div>

      {routeData.isRevalidating ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="sr-only">Refreshing camps</span>
        </div>
      ) : null}
    </div>
  )
}
