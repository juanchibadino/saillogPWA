import { CampDetailTabsClient } from "@/features/camps/camp-detail-tabs-client"
import { CampsFeedback } from "@/features/camps/camps-feedback"
import { getCampDetailPageData } from "@/features/camps/detail-data"
import { CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import { getTeamSessionsPageData } from "@/features/sessions/data"
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

type CampDetailTab = (typeof CAMP_DETAIL_TABS)[number]

const DEFAULT_TAB: CampDetailTab = "sessions"

function resolveTab(value: string | undefined): CampDetailTab {
  if (!value) {
    return DEFAULT_TAB
  }

  return CAMP_DETAIL_TABS.includes(value as CampDetailTab)
    ? (value as CampDetailTab)
    : DEFAULT_TAB
}

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

function formatCampTypeLabel(value: "training" | "regatta" | "mixed"): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
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
  const selectedTab = resolveTab(getSingleSearchParamValue(resolvedSearchParams.tab))
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

  const detailData = await getCampDetailPageData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId,
    campId: resolvedParams.id,
  })

  const camp = detailData.camp

  if (!camp) {
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
  const sessionListData = await getTeamSessionsPageData({
    activeTeamId,
    selectedVenueId: camp.venueId,
    selectedCampId: camp.id,
    selectedHighlight: requestedHighlight,
    page: requestedPage,
    accumulatePages: requestedLoadMoreMode,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{camp.name}</h1>
        <p className="text-sm text-muted-foreground">
          {camp.venueName} — {camp.venueLocation} · {formatCampTypeLabel(camp.campType)} camp
        </p>
      </header>

      <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      <CampDetailTabsClient
        initialTab={selectedTab}
        kpis={detailData.kpis}
        sessions={sessionListData.sessions}
        campOptions={sessionListData.campOptions}
        sessionCurrentPage={sessionListData.currentPage}
        sessionPageCount={sessionListData.pageCount}
        hasPreviousSessionPage={sessionListData.hasPreviousPage}
        hasNextSessionPage={sessionListData.hasNextPage}
        selectedSessionHighlight={sessionListData.selectedHighlight}
        campName={camp.name}
        venueId={camp.venueId}
        venueName={camp.venueName}
        venueLocation={camp.venueLocation}
        goals={camp.goals}
        notesCards={detailData.notesCards}
        canManageSessions={canManageSessions}
        canManageGoals={canManageGoals}
        scope={scope}
        campId={camp.id}
      />
    </div>
  )
}
