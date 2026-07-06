import { Suspense } from "react"

import {
  TeamSessionsPageSkeleton,
  TeamSessionsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { SessionsFeedback } from "@/features/sessions/sessions-feedback"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import { TeamSessionsRouteShell } from "@/features/sessions/team-sessions-route-shell"
import {
  logTeamSessionsListTiming,
  startTeamSessionsListTiming,
} from "@/features/sessions/list-timing"
import { resolveTeamSessionsListRequest } from "@/features/sessions/list-route-state.mjs"
import {
  getTeamSessionsChromeData,
  getTeamSessionsResultsData,
  type TeamSessionsChromeData,
  type TeamSessionHighlightFilter,
} from "@/features/sessions/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamSessionsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamSessionsScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamSessionsChromeDataPromise = Promise<TeamSessionsChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Session created successfully."
  }

  if (status === "updated") {
    return "Session updated successfully."
  }

  if (status === "deleted") {
    return "Session deleted successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted session data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage sessions for this team."
  }

  if (error === "create_failed") {
    return "Could not create session. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update session. Confirm your permissions and try again."
  }

  if (error === "delete_failed") {
    return "Could not delete session. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return "Plan limit reached for sessions in this organization. Upgrade or change plan in Billing to continue."
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating sessions."
  }

  return null
}

function getEmptyTeamSessionsChromeData(input: {
  requestedCampId?: string
  requestedHighlight?: TeamSessionHighlightFilter
  requestedVenueId?: string
}): TeamSessionsChromeData {
  return {
    venueFilterOptions: [],
    campFilterOptions: [],
    campOptions: [],
    selectedVenueId: input.requestedVenueId,
    selectedCampId: input.requestedCampId,
    selectedHighlight: input.requestedHighlight,
  }
}

async function TeamSessionsShellSlot(input: {
  activeTeamId: string | null
  canManageSessions: boolean
  chromeDataPromise: TeamSessionsChromeDataPromise
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamSessionsScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamSessionsRouteShell
      canManageSessions={input.canManageSessions}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamSessionsResultsSkeleton />}>
        <TeamSessionsResultsContent
          activeTeamId={input.activeTeamId}
          canManageSessions={input.canManageSessions}
          chromeData={chromeData}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamSessionsRouteShell>
  )
}

async function TeamSessionsResultsContent(input: {
  activeTeamId: string | null
  canManageSessions: boolean
  chromeData: TeamSessionsChromeData
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamSessionsScope
}) {
  const noTeamSelected = input.activeTeamId === null
  const resultsData = input.activeTeamId
    ? await getTeamSessionsResultsData({
        activeTeamId: input.activeTeamId,
        chromeData: input.chromeData,
        page: input.requestedPage,
        accumulatePages: input.requestedLoadMoreMode,
      })
    : {
        sessions: [],
        currentPage: input.requestedPage,
        pageCount: 1,
        hasPreviousPage: input.requestedPage > 1,
        hasNextPage: false,
      }

  return (
    <TeamSessionsTable
      sessions={resultsData.sessions}
      campOptions={input.chromeData.campOptions}
      canManageSessions={input.canManageSessions}
      noTeamSelected={noTeamSelected}
      scope={input.scope}
      selectedVenueId={input.chromeData.selectedVenueId}
      selectedCampId={input.chromeData.selectedCampId}
      selectedHighlight={input.chromeData.selectedHighlight}
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
      hideChrome
      hideCreateFab
    />
  )
}

export default async function TeamSessionsPage({
  searchParams,
}: {
  searchParams: TeamSessionsSearchParams
}) {
  const scopeStartedAt = startTeamSessionsListTiming()
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const requestedCampId = getSingleSearchParamValue(resolvedSearchParams.camp)
  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamSessionsListRequest({
    highlightParam: getSingleSearchParamValue(resolvedSearchParams.highlight),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })
  logTeamSessionsListTiming({
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
        <h2 className="text-lg font-semibold text-amber-900">Team sessions unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageSessions =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const chromeDataPromise: TeamSessionsChromeDataPromise = activeTeamId
    ? getTeamSessionsChromeData({
        activeTeamId,
        selectedVenueId: requestedVenueId,
        selectedCampId: requestedCampId,
        selectedHighlight: requestedHighlight,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : Promise.resolve(
        getEmptyTeamSessionsChromeData({
          requestedVenueId,
          requestedCampId,
          requestedHighlight,
        }),
      )

  return (
    <div className="space-y-6">
      <SessionsFeedback
        mode="toast"
        statusMessage={statusMessage}
        errorMessage={errorMessage}
      />

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

      {!noTeamSelected && !canManageSessions ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view sessions in this scope, but only super admins,
            organization admins, team admins, coaches, and crew can create or
            edit sessions.
          </p>
        </section>
      ) : null}

      <Suspense fallback={<TeamSessionsPageSkeleton />}>
        <TeamSessionsShellSlot
          activeTeamId={activeTeamId}
          canManageSessions={canManageSessions}
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
