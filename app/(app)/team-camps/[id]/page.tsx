import { CampDetailTabsClient } from "@/features/camps/camp-detail-tabs-client"
import { CampsFeedback } from "@/features/camps/camps-feedback"
import { getCampDetailPageData } from "@/features/camps/detail-data"
import { CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
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

function parseRequestedPage(value: string | undefined): number {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "goals_updated") {
    return "Camp goals updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted goals data is invalid. Review and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage goals for this camp."
  }

  if (error === "update_failed") {
    return "Could not update camp goals. Confirm your permissions and try again."
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
  const requestedPage = parseRequestedPage(
    getSingleSearchParamValue(resolvedSearchParams.page),
  )

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
        initialSessionPage={requestedPage}
        kpis={detailData.kpis}
        sessions={detailData.sessions}
        campName={camp.name}
        goals={camp.goals}
        notesCards={detailData.notesCards}
        canManageGoals={canManageGoals}
        scope={scope}
        campId={camp.id}
      />
    </div>
  )
}
