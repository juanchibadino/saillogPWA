import { Suspense } from "react"

import {
  TeamCampsPageSkeleton,
  TeamCampsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { CampsFeedback } from "@/features/camps/camps-feedback"
import { TeamCampsTable } from "@/features/camps/camps-table"
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
    return "Plan limit reached for camps in this organization. Upgrade or change plan in Billing to continue."
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating camps."
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
        page: input.requestedPage,
        accumulatePages: input.requestedLoadMoreMode,
      })
    : {
        camps: [],
        currentPage: input.requestedPage,
        pageCount: 1,
        hasPreviousPage: input.requestedPage > 1,
        hasNextPage: false,
      }

  return (
    <TeamCampsTable
      camps={resultsData.camps}
      teamVenueOptions={input.chromeData.teamVenueOptions}
      canManageCamps={input.canManageCamps}
      canDeleteCamps={input.canDeleteCampRows}
      noTeamSelected={noTeamSelected}
      scope={input.scope}
      selectedVenueId={input.chromeData.selectedVenueId}
      selectedCampType={input.chromeData.selectedCampType}
      selectedCampStatus={input.chromeData.selectedCampStatus}
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
      hideChrome
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

      {!noTeamSelected && !canManageCamps ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view camps in this scope, but only super admins, organization
            admins, team admins, and coaches can create or edit camps.
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
