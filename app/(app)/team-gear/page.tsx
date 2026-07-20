import { Suspense } from "react"

import { TeamGearResultsSkeleton } from "@/components/shared/page-skeletons"
import { GearFeedback } from "@/features/gear/gear-feedback"
import { TeamGearTable } from "@/features/gear/gear-table"
import { TeamGearResultsRetry } from "@/features/gear/team-gear-results-retry"
import { TeamGearRouteShell } from "@/features/gear/team-gear-route-shell"
import {
  getTeamGearChromeData,
  getTeamGearResultsData,
  type TeamGearChromeData,
  type TeamGearResultsData,
} from "@/features/gear/data"
import { resolveTeamGearListRequest } from "@/features/gear/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamGearSearchParams = Promise<Record<string, string | string[] | undefined>>
type ResolvedTeamGearScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Gear item created successfully."
  }

  if (status === "updated") {
    return "Gear item updated successfully."
  }

  if (status === "retired") {
    return "Gear item marked as retired/spare."
  }

  if (status === "tws_multipliers_updated") {
    return "Gear TWS multipliers updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted gear data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage gear for this team."
  }

  if (error === "create_failed") {
    return "Could not create gear item. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update gear item. Confirm your permissions and try again."
  }

  return null
}

function getEmptyTeamGearResults(input: {
  requestedLoadMoreMode: boolean
  requestedPage: number
}): TeamGearResultsData {
  return {
    gearItems: [],
    twsOptions: [],
    currentPage: input.requestedPage,
    pageCount: 1,
    hasPreviousPage: input.requestedLoadMoreMode ? false : input.requestedPage > 1,
    hasNextPage: false,
    loadMoreMode: input.requestedLoadMoreMode,
  }
}

async function TeamGearResultsContent(input: {
  activeTeamId: string | null
  canManageGear: boolean
  chromeData: TeamGearChromeData
  noTeamSelected: boolean
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamGearScope
}) {
  let resultsData: TeamGearResultsData

  try {
    resultsData = input.activeTeamId
      ? await getTeamGearResultsData({
          activeTeamId: input.activeTeamId,
          chromeData: input.chromeData,
          page: input.requestedPage,
          accumulatePages: input.requestedLoadMoreMode,
        })
      : getEmptyTeamGearResults({
          requestedLoadMoreMode: input.requestedLoadMoreMode,
          requestedPage: input.requestedPage,
        })
  } catch {
    return <TeamGearResultsRetry />
  }

  return (
    <TeamGearTable
      gearItems={resultsData.gearItems}
      twsOptions={resultsData.twsOptions}
      canManageGear={input.canManageGear}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
      selectedType={input.chromeData.selectedType}
      selectedStatusFilter={input.chromeData.selectedStatus}
      selectedCondition={input.chromeData.selectedCondition}
      selectedAlert={input.chromeData.selectedAlertState}
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
      loadMoreMode={resultsData.loadMoreMode}
      hideChrome
    />
  )
}

export default async function TeamGearPage({
  searchParams,
}: {
  searchParams: TeamGearSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedAlert,
    requestedCondition,
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter,
    requestedType,
  } = resolveTeamGearListRequest({
    typeParam: getSingleSearchParamValue(resolvedSearchParams.type),
    statusFilterParam: getSingleSearchParamValue(resolvedSearchParams.statusFilter),
    conditionParam: getSingleSearchParamValue(resolvedSearchParams.condition),
    alertParam: getSingleSearchParamValue(resolvedSearchParams.alert),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as {
    requestedAlert?: string
    requestedCondition?: string
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedStatusFilter?: string
    requestedType?: string
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
        <h2 className="text-lg font-semibold text-amber-900">Team gear unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageGear =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  const chromeData = getTeamGearChromeData({
    selectedType: requestedType,
    selectedStatus: requestedStatusFilter,
    selectedCondition: requestedCondition,
    selectedAlertState: requestedAlert,
  })

  return (
    <div className="space-y-6">
      <GearFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageGear ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view gear in this scope, but only super admins, organization admins,
            team admins, coaches, and crew can create or edit gear items.
          </p>
        </section>
      ) : null}

      <TeamGearRouteShell
        canManageGear={canManageGear}
        chromeData={chromeData}
        currentPage={requestedPage}
        loadMoreMode={requestedLoadMoreMode}
        noTeamSelected={noTeamSelected}
        scope={scope}
      >
        <Suspense fallback={<TeamGearResultsSkeleton />}>
          <TeamGearResultsContent
            activeTeamId={activeTeamId}
            canManageGear={canManageGear}
            chromeData={chromeData}
            noTeamSelected={noTeamSelected}
            requestedLoadMoreMode={requestedLoadMoreMode}
            requestedPage={requestedPage}
            scope={scope}
          />
        </Suspense>
      </TeamGearRouteShell>
    </div>
  )
}
