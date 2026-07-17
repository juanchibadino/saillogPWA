import { Suspense } from "react"

import {
  TeamsPageSkeleton,
  TeamsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { FreeTierQuotaDialog } from "@/features/billing/free-tier-quota-dialog"
import { TeamsFeedback } from "@/features/teams/teams-feedback"
import { TeamsRouteShell } from "@/features/teams/teams-route-shell"
import { TeamsTable } from "@/features/teams/teams-table"
import {
  getTeamsChromeData,
  getTeamsResultsData,
  type TeamOrganizationOption,
  type TeamsChromeData,
} from "@/features/teams/data"
import {
  resolveTeamsListRequest,
} from "@/features/teams/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard"
import { getSingleSearchParamValue } from "@/lib/navigation/scope"

type TeamsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamsScope = NonNullable<
  Awaited<ReturnType<typeof requireOrganizationRouteAccess>>["scope"]
>
type TeamsChromeDataPromise = Promise<TeamsChromeData>
type TeamsListRequest = {
  requestedLoadMoreMode: boolean
  requestedPage: number
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Team created successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted team data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to create teams in the active organization."
  }

  if (error === "create_failed") {
    return "Could not create team. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return null
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue creating teams."
  }

  return null
}

async function TeamsShellSlot(input: {
  canManageTeams: boolean
  chromeDataPromise: TeamsChromeDataPromise
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamsScope
}) {
  let chromeData: TeamsChromeData

  try {
    chromeData = await input.chromeDataPromise
  } catch {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team data unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not load team controls. Check server configuration and try again.
        </p>
      </section>
    )
  }

  return (
    <TeamsRouteShell
      canManageTeams={input.canManageTeams}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      loadMoreMode={input.requestedLoadMoreMode}
      scope={input.scope}
    >
      <Suspense fallback={<TeamsResultsSkeleton />}>
        <TeamsResultsContent
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </TeamsRouteShell>
  )
}

async function TeamsResultsContent(input: {
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamsScope
}) {
  let resultsData: Awaited<ReturnType<typeof getTeamsResultsData>>

  try {
    resultsData = await getTeamsResultsData({
      accumulatePages: input.requestedLoadMoreMode,
      activeOrganizationId: input.scope.activeOrgId,
      page: input.requestedPage,
    })
  } catch {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Teams unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not load team rows. Check server configuration and try again.
        </p>
      </section>
    )
  }

  return (
    <TeamsTable
      currentPage={resultsData.currentPage}
      hasNextPage={resultsData.hasNextPage}
      hasPreviousPage={resultsData.hasPreviousPage}
      pageCount={resultsData.pageCount}
      teams={resultsData.teams}
    />
  )
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: TeamsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamsListRequest({
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as TeamsListRequest
  const navigation = await requireOrganizationRouteAccess({
    context,
    searchParams: resolvedSearchParams,
  })
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Teams unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Team management requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const activeOrganization =
    navigation.catalog.organizations.find(
      (organization) => organization.id === scope.activeOrgId,
    ) as TeamOrganizationOption | undefined

  if (!activeOrganization) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Organization context unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not resolve the active organization from your current scope.
        </p>
      </section>
    )
  }

  const canManageTeams = canManageOrganizationOperations(context, activeOrganization.id)
  const chromeDataPromise = getTeamsChromeData({
    activeOrganization,
  })

  return (
    <div className="space-y-6">
      <TeamsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      <FreeTierQuotaDialog
        organizationId={activeOrganization.id}
        teamId={scope.activeTeamId}
      />

      {!canManageTeams ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view teams in this organization, but only super admins and
            organization admins can create team records here.
          </p>
        </section>
      ) : null}

      <Suspense fallback={<TeamsPageSkeleton />}>
        <TeamsShellSlot
          canManageTeams={canManageTeams}
          chromeDataPromise={chromeDataPromise}
          requestedLoadMoreMode={requestedLoadMoreMode}
          requestedPage={requestedPage}
          scope={scope}
        />
      </Suspense>
    </div>
  )
}
