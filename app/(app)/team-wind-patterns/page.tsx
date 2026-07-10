import { Suspense } from "react"

import {
  TeamWindPatternsPageSkeleton,
  TeamWindPatternsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { resolveTeamWindPatternsListRequest } from "@/features/wind-patterns/list-route-state.mjs"
import { TeamWindPatternsRouteShell } from "@/features/wind-patterns/team-wind-patterns-route-shell"
import { TeamWindPatternsTable } from "@/features/wind-patterns/team-wind-patterns-table"
import { WindPatternsFeedback } from "@/features/wind-patterns/wind-patterns-feedback"
import {
  getTeamWindPatternsChromeData,
  getTeamWindPatternsResultsData,
  type TeamWindPatternStatusFilter,
  type TeamWindPatternsChromeData,
} from "@/features/wind-patterns/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamWindPatternsSearchParams = Promise<Record<string, string | string[] | undefined>>
type ResolvedTeamWindPatternsScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamWindPatternsChromeDataPromise = Promise<TeamWindPatternsChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "wind_pattern_created" || status === "created") {
    return "Wind pattern created successfully."
  }

  if (status === "wind_pattern_updated" || status === "updated") {
    return "Wind pattern updated successfully."
  }

  if (status === "wind_pattern_archived" || status === "archived") {
    return "Wind pattern archived successfully."
  }

  if (status === "wind_pattern_restored" || status === "restored") {
    return "Wind pattern restored successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted wind pattern data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage wind patterns for this team."
  }

  if (error === "wind_pattern_create_failed" || error === "create_failed") {
    return "Could not create wind pattern. Confirm permissions and uniqueness of the name."
  }

  if (error === "wind_pattern_update_failed" || error === "update_failed") {
    return "Could not update wind pattern. Confirm permissions and try again."
  }

  return null
}

function getEmptyTeamWindPatternsChromeData(input: {
  requestedStatusFilter: TeamWindPatternStatusFilter
}): TeamWindPatternsChromeData {
  return {
    selectedStatusFilter: input.requestedStatusFilter,
    statusCounts: {
      active: 0,
      archived: 0,
    },
    venueOptions: [],
  }
}

async function TeamWindPatternsShellSlot(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  canManageWindPatterns: boolean
  chromeDataPromise: TeamWindPatternsChromeDataPromise
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamWindPatternsScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamWindPatternsRouteShell
      canManageWindPatterns={input.canManageWindPatterns}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      loadMoreMode={input.requestedLoadMoreMode}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamWindPatternsResultsSkeleton />}>
        <TeamWindPatternsResultsContent
          activeTeamId={input.activeTeamId}
          canManageWindPatterns={input.canManageWindPatterns}
          chromeData={chromeData}
          noTeamSelected={input.noTeamSelected}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamWindPatternsRouteShell>
  )
}

async function TeamWindPatternsResultsContent(input: {
  activeTeamId: string | null
  canManageWindPatterns: boolean
  chromeData: TeamWindPatternsChromeData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamWindPatternsScope
}) {
  let resultsData: Awaited<ReturnType<typeof getTeamWindPatternsResultsData>>

  try {
    resultsData = input.activeTeamId
      ? await getTeamWindPatternsResultsData({
          activeTeamId: input.activeTeamId,
          chromeData: input.chromeData,
          page: input.requestedPage,
          accumulatePages: input.requestedLoadMoreMode,
        })
      : {
          patterns: [],
          totalCount: 0,
          currentPage: input.requestedPage,
          pageCount: 1,
          hasPreviousPage: input.requestedPage > 1,
          hasNextPage: false,
        }
  } catch {
    return (
      <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
        Could not load wind patterns. Refresh the page and try again.
      </section>
    )
  }

  return (
    <TeamWindPatternsTable
      patterns={resultsData.patterns}
      canManageWindPatterns={input.canManageWindPatterns}
      noTeamSelected={input.noTeamSelected}
      selectedStatusFilter={input.chromeData.selectedStatusFilter}
      scope={input.scope}
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
      loadMoreMode={input.requestedLoadMoreMode}
      hideChrome
    />
  )
}

export default async function TeamWindPatternsPage({
  searchParams,
}: {
  searchParams: TeamWindPatternsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter,
  } = resolveTeamWindPatternsListRequest({
    statusFilterParam: getSingleSearchParamValue(resolvedSearchParams.statusFilter),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as {
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedStatusFilter: TeamWindPatternStatusFilter
  }
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Wind patterns unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageWindPatterns =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  const chromeDataPromise: TeamWindPatternsChromeDataPromise = activeTeamId
    ? getTeamWindPatternsChromeData({
        activeOrganizationId: scope.activeOrgId,
        activeTeamId,
        statusFilter: requestedStatusFilter,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : Promise.resolve(
        getEmptyTeamWindPatternsChromeData({
          requestedStatusFilter,
        }),
      )

  return (
    <div className="space-y-6">
      <WindPatternsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageWindPatterns ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view wind patterns in this scope, but only super admins,
            organization admins, team admins, coaches, and crew can create or edit wind
            patterns.
          </p>
        </section>
      ) : null}

      <Suspense fallback={<TeamWindPatternsPageSkeleton />}>
        <TeamWindPatternsShellSlot
          activeOrganizationId={scope.activeOrgId}
          activeTeamId={activeTeamId}
          canManageWindPatterns={canManageWindPatterns}
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
