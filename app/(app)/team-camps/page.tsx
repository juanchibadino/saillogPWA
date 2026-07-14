import { Suspense } from "react"

import {
  TeamCampsPageSkeleton,
  TeamCampsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { RouteCacheInvalidationOnSuccess } from "@/features/shared/route-cache-invalidation-on-success"
import { FreeTierQuotaDialog } from "@/features/billing/free-tier-quota-dialog"
import { CampsFeedback } from "@/features/camps/camps-feedback"
import { TeamCampsResultsClient } from "@/features/camps/team-camps-results-client"
import {
  logTeamCampsListTiming,
  startTeamCampsListTiming,
} from "@/features/camps/list-timing"
import { resolveTeamCampsListRequest } from "@/features/camps/list-route-state.mjs"
import { TeamCampsRouteShell } from "@/features/camps/team-camps-route-shell"
import {
  getTeamCampsChromeData,
  getTeamCampsResultsData,
  type TeamCampStatusFilter,
  type TeamCampTypeFilter,
  type TeamCampsChromeData,
} from "@/features/camps/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canDeleteCamps, canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamCampsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamCampsScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamCampsChromeDataPromise = Promise<TeamCampsChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Camp created successfully."
  }

  if (status === "updated") {
    return "Camp updated successfully."
  }

  if (status === "deleted") {
    return "Camp deleted successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted camp data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage camps for this team."
  }

  if (error === "create_failed") {
    return "Could not create camp. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update camp. Confirm your permissions and try again."
  }

  if (error === "delete_failed") {
    return "Could not delete camp. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return null
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue creating camps."
  }

  return null
}

function getEmptyTeamCampsChromeData(input: {
  requestedCampStatus?: TeamCampStatusFilter
  requestedCampType?: TeamCampTypeFilter
  requestedVenueId?: string
}): TeamCampsChromeData {
  return {
    teamVenueOptions: [],
    venueFilterOptions: [],
    selectedVenueId: input.requestedVenueId,
    selectedCampType: input.requestedCampType,
    selectedCampStatus: input.requestedCampStatus,
  }
}

async function TeamCampsShellSlot(input: {
  activeTeamId: string | null
  canDeleteCampRows: boolean
  canManageCamps: boolean
  chromeDataPromise: TeamCampsChromeDataPromise
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamCampsScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamCampsRouteShell
      canManageCamps={input.canManageCamps}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamCampsResultsSkeleton />}>
        <TeamCampsResultsContent
          activeTeamId={input.activeTeamId}
          canDeleteCampRows={input.canDeleteCampRows}
          canManageCamps={input.canManageCamps}
          chromeData={chromeData}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamCampsRouteShell>
  )
}

async function TeamCampsResultsContent(input: {
  activeTeamId: string | null
  canDeleteCampRows: boolean
  canManageCamps: boolean
  chromeData: TeamCampsChromeData
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamCampsScope
}) {
  const noTeamSelected = input.activeTeamId === null
  const resultsData = input.activeTeamId
    ? await getTeamCampsResultsData({
        activeTeamId: input.activeTeamId,
        chromeData: input.chromeData,
        includeSessionCounts: false,
        page: input.requestedPage,
        accumulatePages: input.requestedLoadMoreMode,
      })
    : {
        camps: [],
        currentPage: input.requestedPage,
        pageCount: 1,
        hasPreviousPage: input.requestedPage > 1,
        hasNextPage: false,
        sessionCountsStatus: "fresh" as const,
      }

  return (
    <TeamCampsResultsClient
      initialResultsData={resultsData}
      chromeData={input.chromeData}
      canManageCamps={input.canManageCamps}
      canDeleteCampRows={input.canDeleteCampRows}
      noTeamSelected={noTeamSelected}
      scope={input.scope}
      requestedLoadMoreMode={input.requestedLoadMoreMode}
      requestedPage={input.requestedPage}
    />
  )
}

export default async function TeamCampsPage({
  searchParams,
}: {
  searchParams: TeamCampsSearchParams
}) {
  const scopeStartedAt = startTeamCampsListTiming()
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const cacheCampId = getSingleSearchParamValue(resolvedSearchParams.cacheCamp)
  const cacheTeamVenueId = getSingleSearchParamValue(resolvedSearchParams.cacheTeamVenue)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const {
    requestedCampStatus,
    requestedCampType,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamCampsListRequest({
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    typeParam: getSingleSearchParamValue(resolvedSearchParams.type),
    campStatusParam: getSingleSearchParamValue(resolvedSearchParams.campStatus),
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })
  logTeamCampsListTiming({
    phase: "scope",
    startedAt: scopeStartedAt,
    activeTeamId: navigation.scope?.activeTeamId ?? null,
    status: "success",
    metadata: {
      hasScope: Boolean(navigation.scope),
      hasTeamScope: Boolean(navigation.scope?.activeTeamId),
    },
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team camps unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageCamps =
    activeTeamId !== null &&
    canManageTeamStructure({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const canDeleteCampRows =
    activeTeamId !== null &&
    canDeleteCamps({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const chromeDataPromise: TeamCampsChromeDataPromise = activeTeamId
    ? getTeamCampsChromeData({
        activeTeamId,
        selectedVenueId: requestedVenueId,
        selectedCampType: requestedCampType,
        selectedCampStatus: requestedCampStatus,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : Promise.resolve(
        getEmptyTeamCampsChromeData({
          requestedVenueId,
          requestedCampType,
          requestedCampStatus,
        }),
      )

  return (
    <div className="space-y-6">
      <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      <FreeTierQuotaDialog
        organizationId={scope.activeOrgId}
        teamId={scope.activeTeamId}
      />
      {activeTeamId ? (
        <RouteCacheInvalidationOnSuccess
          mutation="camp"
          scope={scope}
          campId={cacheCampId}
          teamVenueId={cacheTeamVenueId ?? requestedVenueId}
        />
      ) : null}

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Team selection required
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      <Suspense fallback={<TeamCampsPageSkeleton />}>
        <TeamCampsShellSlot
          activeTeamId={activeTeamId}
          canDeleteCampRows={canDeleteCampRows}
          canManageCamps={canManageCamps}
          chromeDataPromise={chromeDataPromise}
          noTeamSelected={noTeamSelected}
          requestedLoadMoreMode={requestedLoadMoreMode}
          requestedPage={requestedPage}
          scope={scope}
        />
      </Suspense>
    </div>
  )
}
