import { Suspense } from "react"

import {
  TeamStandardMovesPageSkeleton,
  TeamStandardMovesResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { resolveTeamStandardMovesListRequest } from "@/features/standard-moves/list-route-state.mjs"
import { StandardMovesFeedback } from "@/features/standard-moves/standard-moves-feedback"
import { StandardMovesResultsRetry } from "@/features/standard-moves/standard-moves-results-retry"
import { TeamStandardMovesTable } from "@/features/standard-moves/standard-moves-table"
import { TeamStandardMovesRouteShell } from "@/features/standard-moves/team-standard-moves-route-shell"
import {
  getTeamStandardMovesChromeData,
  getTeamStandardMovesResultsData,
  type TeamStandardMoveStatusFilter,
  type TeamStandardMovesChromeData,
} from "@/features/standard-moves/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamStandardMovesSearchParams = Promise<Record<string, string | string[] | undefined>>
type ResolvedTeamStandardMovesScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamStandardMovesChromeDataPromise = Promise<TeamStandardMovesChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Standard move created successfully."
  }

  if (status === "updated") {
    return "Standard move updated successfully."
  }

  if (status === "archived") {
    return "Standard move archived successfully."
  }

  if (status === "restored") {
    return "Standard move restored successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted standard move data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage standard moves for this team."
  }

  if (error === "create_failed") {
    return "Could not create standard move. Confirm permissions and uniqueness of the name."
  }

  if (error === "update_failed") {
    return "Could not update standard move. Confirm permissions and try again."
  }

  return null
}

function getEmptyTeamStandardMovesChromeData(input: {
  requestedStatusFilter: TeamStandardMoveStatusFilter
}): TeamStandardMovesChromeData {
  return {
    selectedStatusFilter: input.requestedStatusFilter,
    statusCounts: {
      active: 0,
      archived: 0,
    },
  }
}

async function TeamStandardMovesShellSlot(input: {
  activeTeamId: string | null
  canManageStandardMoves: boolean
  chromeDataPromise: TeamStandardMovesChromeDataPromise
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamStandardMovesScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamStandardMovesRouteShell
      canManageStandardMoves={input.canManageStandardMoves}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      loadMoreMode={input.requestedLoadMoreMode}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamStandardMovesResultsSkeleton />}>
        <TeamStandardMovesResultsContent
          activeTeamId={input.activeTeamId}
          canManageStandardMoves={input.canManageStandardMoves}
          chromeData={chromeData}
          noTeamSelected={input.noTeamSelected}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamStandardMovesRouteShell>
  )
}

async function TeamStandardMovesResultsContent(input: {
  activeTeamId: string | null
  canManageStandardMoves: boolean
  chromeData: TeamStandardMovesChromeData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamStandardMovesScope
}) {
  let resultsData: Awaited<ReturnType<typeof getTeamStandardMovesResultsData>>

  try {
    resultsData = input.activeTeamId
      ? await getTeamStandardMovesResultsData({
          activeTeamId: input.activeTeamId,
          chromeData: input.chromeData,
          page: input.requestedPage,
          accumulatePages: input.requestedLoadMoreMode,
        })
      : {
          moves: [],
          totalCount: 0,
          currentPage: input.requestedPage,
          pageCount: 1,
          hasPreviousPage: input.requestedPage > 1,
          hasNextPage: false,
        }
  } catch {
    return <StandardMovesResultsRetry />
  }

  return (
    <TeamStandardMovesTable
      moves={resultsData.moves}
      canManageStandardMoves={input.canManageStandardMoves}
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

export default async function TeamStandardMovesPage({
  searchParams,
}: {
  searchParams: TeamStandardMovesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter,
  } = resolveTeamStandardMovesListRequest({
    statusFilterParam: getSingleSearchParamValue(resolvedSearchParams.statusFilter),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as {
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedStatusFilter: TeamStandardMoveStatusFilter
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
        <h2 className="text-lg font-semibold text-amber-900">Standard moves unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageStandardMoves =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  const chromeDataPromise: TeamStandardMovesChromeDataPromise = activeTeamId
    ? getTeamStandardMovesChromeData({
        activeTeamId,
        statusFilter: requestedStatusFilter,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : Promise.resolve(
        getEmptyTeamStandardMovesChromeData({
          requestedStatusFilter,
        }),
      )

  return (
    <div className="space-y-6">
      <StandardMovesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageStandardMoves ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view standard moves in this scope, but only super admins, organization
            admins, team admins, coaches, and crew can create or edit standard moves.
          </p>
        </section>
      ) : null}

      <Suspense fallback={<TeamStandardMovesPageSkeleton />}>
        <TeamStandardMovesShellSlot
          activeTeamId={activeTeamId}
          canManageStandardMoves={canManageStandardMoves}
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
