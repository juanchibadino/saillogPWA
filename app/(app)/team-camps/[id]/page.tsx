import { Suspense } from "react"

import { CampDetailTabsClient } from "@/features/camps/camp-detail-tabs-client"
import { CampsFeedback } from "@/features/camps/camps-feedback"
import { Badge } from "@/components/ui/badge"
import { CampDetailDeferredContentSkeleton } from "@/components/shared/page-skeletons"
import {
  getCampDetailChromeData,
  getCampDetailKpisData,
  getCampDetailTabData,
} from "@/features/camps/detail-data"
import type {
  CampDetailCamp,
  CampDetailKpi,
  CampDetailTab,
  CampDetailTabPayload,
} from "@/features/camps/detail-types"
import type { TeamSessionHighlightFilter } from "@/features/sessions/data"
import { resolveCampDetailRouteRequest } from "@/features/camps/detail-route-state.mjs"
import { resolveTeamSessionsListRequest } from "@/features/sessions/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageTeamSessions,
  canManageTeamStructure,
} from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type CampDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

type CampDetailParams = Promise<{ id: string }>
type ResolvedCampDetailScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "goals_updated") {
    return "Camp goals updated successfully."
  }

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
    return "The submitted data is invalid. Review and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage this camp."
  }

  if (error === "create_failed") {
    return "Could not create session. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not save changes. Confirm your permissions and try again."
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

async function CampDetailDeferredContent(input: {
  canManageGoals: boolean
  canManageSessions: boolean
  camp: CampDetailCamp
  initialSessionHighlight?: TeamSessionHighlightFilter
  initialSessionLoadMore?: boolean
  initialSessionPage: number
  initialTabDataPromise: Promise<CampDetailTabPayload>
  kpisPromise: Promise<CampDetailKpi[]>
  scope: ResolvedCampDetailScope
  selectedTab: CampDetailTab
}) {
  const [kpis, initialTabData] = await Promise.all([
    input.kpisPromise,
    input.initialTabDataPromise,
  ])

  return (
    <CampDetailTabsClient
      initialTab={input.selectedTab}
      initialTabData={initialTabData}
      initialSessionHighlight={input.initialSessionHighlight}
      initialSessionLoadMore={input.initialSessionLoadMore}
      initialSessionPage={input.initialSessionPage}
      kpis={kpis}
      campName={input.camp.name}
      venueId={input.camp.venueId}
      venueName={input.camp.venueName}
      venueLocation={input.camp.venueLocation}
      canManageSessions={input.canManageSessions}
      canManageGoals={input.canManageGoals}
      scope={input.scope}
      campId={input.camp.id}
    />
  )
}

export default async function CampDetailPage({
  params,
  searchParams,
}: {
  params: CampDetailParams
  searchParams: CampDetailSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const pageParam = getSingleSearchParamValue(resolvedSearchParams.page)
  const {
    requestedNotesOffset,
    requestedPage,
    selectedTab: resolvedSelectedTab,
  } = resolveCampDetailRouteRequest({
    notesOffsetParam: getSingleSearchParamValue(resolvedSearchParams.notesOffset),
    pageParam,
    tabParam: getSingleSearchParamValue(resolvedSearchParams.tab),
  })
  const selectedTab = resolvedSelectedTab as CampDetailTab
  const { requestedHighlight, requestedLoadMoreMode } = resolveTeamSessionsListRequest({
    highlightParam: getSingleSearchParamValue(resolvedSearchParams.highlight),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam,
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">No active scope</h2>
        <p className="mt-2 text-sm text-amber-800">
          Camp detail requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (scope.activeTeamId === null) {
    return (
      <div className="space-y-6">
        <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Camp operations are team-scoped. Select a team from the scope picker to load
            sessions, goals, and notes.
          </p>
        </section>
      </div>
    )
  }

  const activeTeamId = scope.activeTeamId

  const detailData = await getCampDetailChromeData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId,
    campId: resolvedParams.id,
  })

  if (!detailData) {
    return (
      <div className="space-y-6">
        <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Camp unavailable</h2>
          <p className="mt-2 text-sm text-amber-800">
            This camp does not exist in the active team scope or is not accessible.
          </p>
        </section>
      </div>
    )
  }

  const camp = detailData.camp
  const canManageGoals = canManageTeamStructure({
    context,
    organizationId: scope.activeOrgId,
    teamId: activeTeamId,
  })
  const canManageSessions = canManageTeamSessions({
    context,
    organizationId: scope.activeOrgId,
    teamId: activeTeamId,
  })
  const kpisPromise = getCampDetailKpisData({
    activeTeamId,
    camp,
  })
  const initialTabDataPromise = getCampDetailTabData({
    activeTeamId,
    accumulatePages: requestedLoadMoreMode,
    camp,
    notesSessionOffset: requestedNotesOffset,
    page: requestedPage,
    selectedHighlight: requestedHighlight,
    tab: selectedTab,
    teamVenue: detailData.teamVenue,
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-2 md:gap-3">
        <h1 className="hidden text-2xl font-semibold tracking-tight md:block">
          {camp.name}
        </h1>
        <Badge variant="secondary" className="max-w-full truncate">
          {camp.venueLocation}
        </Badge>
      </header>

      <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      <Suspense fallback={<CampDetailDeferredContentSkeleton selectedTab={selectedTab} />}>
        <CampDetailDeferredContent
          canManageGoals={canManageGoals}
          canManageSessions={canManageSessions}
          camp={camp}
          initialSessionHighlight={requestedHighlight}
          initialSessionLoadMore={requestedLoadMoreMode}
          initialSessionPage={requestedPage}
          initialTabDataPromise={initialTabDataPromise}
          kpisPromise={kpisPromise}
          scope={scope}
          selectedTab={selectedTab}
        />
      </Suspense>
    </div>
  )
}
