import { Suspense } from "react"

import {
  TeamVenuesPageSkeleton,
  TeamVenuesResultsSkeleton,
} from "@/components/shared/page-skeletons"
import {
  getTeamVenuesChromeData,
  getTeamVenuesResultsData,
  type TeamVenueStatusFilter,
  type TeamVenuesChromeData,
} from "@/features/team-venues/data"
import {
  logTeamVenuesListTiming,
  startTeamVenuesListTiming,
} from "@/features/team-venues/list-timing"
import { RouteCacheInvalidationOnSuccess } from "@/features/shared/route-cache-invalidation-on-success"
import { FreeTierQuotaDialog } from "@/features/billing/free-tier-quota-dialog"
import { resolveTeamVenuesListRequest } from "@/features/team-venues/list-route-state.mjs"
import { TeamVenuesFeedback } from "@/features/team-venues/team-venues-feedback"
import { TeamVenuesResultsRetry } from "@/features/team-venues/team-venues-results-retry"
import { TeamVenuesResultsClient } from "@/features/team-venues/team-venues-results-client"
import { TeamVenuesRouteShell } from "@/features/team-venues/team-venues-route-shell"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canCreateTeamVenues,
  canManageTeamVenues,
} from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamVenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamVenuesScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamVenuesChromeDataPromise = Promise<TeamVenuesChromeData>
type TeamVenuesListRequest = {
  requestedLoadMoreMode: boolean
  requestedPage: number
  requestedStatusFilter: TeamVenueStatusFilter
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "linked_existing") {
    return "Venue linked to team successfully."
  }

  if (status === "created_and_linked") {
    return "New venue created and linked to team successfully."
  }

  if (status === "updated") {
    return "Team venue updated successfully."
  }

  if (status === "deleted") {
    return "Team venue deleted successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The selected venue or scope is invalid. Review and try again."
  }

  if (error === "forbidden") {
    return "You do not have access to this scope or the required team venue permissions."
  }

  if (error === "already_linked") {
    return "This venue is already linked to the active team."
  }

  if (error === "venue_already_exists") {
    return "A venue with this name already exists in this organization. Link the existing venue instead."
  }

  if (error === "plan_limit_reached") {
    return null
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue creating venues."
  }

  if (error === "create_failed") {
    return "Could not complete the venue request. Try again."
  }

  if (error === "link_failed_after_create") {
    return "Venue was created, but linking it to this team failed. You can try linking it again."
  }

  if (error === "update_failed") {
    return "Could not update the team venue. Try again."
  }

  if (error === "delete_failed") {
    return "Could not delete the team venue. Try again."
  }

  if (error === "has_linked_operations") {
    return "This team venue has linked camps or sessions and cannot be deleted."
  }

  return null
}

function getEmptyTeamVenuesChromeData(input: {
  requestedStatusFilter: TeamVenueStatusFilter
}): TeamVenuesChromeData {
  return {
    linkedVenueOptions: [],
    availableVenueOptions: [],
    statusCounts: {
      active: 0,
      deprecated: 0,
    },
    selectedStatusFilter: input.requestedStatusFilter,
  }
}

async function TeamVenuesShellSlot(input: {
  activeTeamId: string | null
  canCreateVenueRows: boolean
  canManageVenueRows: boolean
  chromeDataPromise: TeamVenuesChromeDataPromise
  currentYear: number
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamVenuesScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamVenuesRouteShell
      chromeData={chromeData}
      canCreateVenueRows={input.canCreateVenueRows}
      currentPage={input.requestedPage}
      loadMoreMode={input.requestedLoadMoreMode}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamVenuesResultsSkeleton />}>
        <TeamVenuesResultsContent
          activeTeamId={input.activeTeamId}
          canManageVenueRows={input.canManageVenueRows}
          chromeData={chromeData}
          currentYear={input.currentYear}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamVenuesRouteShell>
  )
}

async function TeamVenuesResultsContent(input: {
  activeTeamId: string | null
  canManageVenueRows: boolean
  chromeData: TeamVenuesChromeData
  currentYear: number
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamVenuesScope
}) {
  const noTeamSelected = input.activeTeamId === null
  let resultsData: Awaited<ReturnType<typeof getTeamVenuesResultsData>>

  try {
    resultsData = input.activeTeamId
      ? await getTeamVenuesResultsData({
          activeTeamId: input.activeTeamId,
          chromeData: input.chromeData,
          currentYear: input.currentYear,
          includeMetrics: false,
          page: input.requestedPage,
          accumulatePages: input.requestedLoadMoreMode,
        })
      : {
          linkedVenues: [],
          totalCount: 0,
          currentPage: input.requestedPage,
          pageCount: 1,
          hasPreviousPage: input.requestedPage > 1,
          hasNextPage: false,
          metricsStatus: "fresh" as const,
        }
  } catch {
    return <TeamVenuesResultsRetry />
  }

  return (
    <TeamVenuesResultsClient
      initialResultsData={resultsData}
      chromeData={input.chromeData}
      noTeamSelected={noTeamSelected}
      canManageVenueRows={input.canManageVenueRows}
      scope={input.scope}
      currentYear={input.currentYear}
      requestedLoadMoreMode={input.requestedLoadMoreMode}
      requestedPage={input.requestedPage}
    />
  )
}

export default async function TeamVenuesPage({
  searchParams,
}: {
  searchParams: TeamVenuesSearchParams
}) {
  const scopeStartedAt = startTeamVenuesListTiming()
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const result = getSingleSearchParamValue(resolvedSearchParams.result)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const cacheTeamVenueId = getSingleSearchParamValue(resolvedSearchParams.cacheTeamVenue)
  const {
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter,
  } = resolveTeamVenuesListRequest({
    statusParam: getSingleSearchParamValue(resolvedSearchParams.status),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as TeamVenuesListRequest
  const statusMessage = getStatusMessage(result)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  logTeamVenuesListTiming({
    activeTeamId: navigation.scope?.activeTeamId ?? null,
    phase: "scope",
    startedAt: scopeStartedAt,
    status: "success",
    metadata: {
      hasScope: Boolean(navigation.scope),
      hasTeamScope: Boolean(navigation.scope?.activeTeamId),
    },
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team venues unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId
  const canCreateVenueRows = activeTeamId
    ? canCreateTeamVenues({
        context,
        organizationId: scope.activeOrgId,
        teamId: activeTeamId,
      })
    : false
  const canManageVenueRows = activeTeamId
    ? canManageTeamVenues({
        context,
        organizationId: scope.activeOrgId,
        teamId: activeTeamId,
      })
    : false
  const currentYear = new Date().getUTCFullYear()
  const chromeDataPromise: TeamVenuesChromeDataPromise = activeTeamId
    ? getTeamVenuesChromeData({
        activeOrganizationId: scope.activeOrgId,
        activeTeamId,
        statusFilter: requestedStatusFilter,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : Promise.resolve(
        getEmptyTeamVenuesChromeData({
          requestedStatusFilter,
        }),
      )

  return (
    <div className="space-y-6">
      <TeamVenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      <FreeTierQuotaDialog
        organizationId={scope.activeOrgId}
        teamId={scope.activeTeamId}
      />
      {activeTeamId ? (
        <RouteCacheInvalidationOnSuccess
          mutation="venue"
          scope={scope}
          searchParamName="result"
          teamVenueId={cacheTeamVenueId}
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

      <Suspense fallback={<TeamVenuesPageSkeleton />}>
        <TeamVenuesShellSlot
          activeTeamId={activeTeamId}
          canCreateVenueRows={canCreateVenueRows}
          canManageVenueRows={canManageVenueRows}
          chromeDataPromise={chromeDataPromise}
          currentYear={currentYear}
          noTeamSelected={noTeamSelected}
          requestedLoadMoreMode={requestedLoadMoreMode}
          requestedPage={requestedPage}
          scope={scope}
        />
      </Suspense>
    </div>
  )
}
