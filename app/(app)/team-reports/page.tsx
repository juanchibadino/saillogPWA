import { Suspense } from "react"

import {
  TeamReportsPageSkeleton,
  TeamReportsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import {
  formatCampDateRange,
  getTeamReportsChromeData,
  getTeamReportsResultsData,
  type TeamReportsChromeData,
} from "@/features/reports/data"
import { ReportsFeedback } from "@/features/reports/reports-feedback"
import { ReportsTable } from "@/features/reports/reports-table"
import { TeamReportsRouteShell } from "@/features/reports/reports-route-shell"
import { resolveReportsListRequest } from "@/features/reports/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamReportsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamReportsScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamReportsChromeDataPromise = Promise<TeamReportsChromeData>

function buildTeamReportsHref(input: {
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  return `/team-reports?${params.toString()}`
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "report_created") {
    return "Report created successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "Invalid report input. Select venue, year, and at least one camp."
  }

  if (error === "forbidden") {
    return "You do not have permission to create reports in this team."
  }

  if (error === "create_failed") {
    return "Could not create report. Confirm report scope and try again."
  }

  return null
}

async function TeamReportsShellSlot(input: {
  activeTeamId: string
  canManageReports: boolean
  chromeDataPromise: TeamReportsChromeDataPromise
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamReportsScope
}) {
  const chromeData = await input.chromeDataPromise
  const redirectTo = buildTeamReportsHref({
    scope: input.scope,
  })
  const dialogCampOptions = chromeData.createCampOptions.map((camp) => ({
    campId: camp.campId,
    teamVenueId: camp.teamVenueId,
    year: camp.year,
    name: camp.name,
    dateRangeLabel: formatCampDateRange({
      startDate: camp.startDate,
      endDate: camp.endDate,
    }),
  }))

  return (
    <TeamReportsRouteShell
      canManageReports={input.canManageReports}
      currentPage={input.requestedPage}
      dialogCampOptions={dialogCampOptions}
      redirectTo={redirectTo}
      scope={input.scope}
      venueOptions={chromeData.venueOptions}
    >
      <Suspense fallback={<TeamReportsResultsSkeleton />}>
        <TeamReportsResultsContent
          activeTeamId={input.activeTeamId}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
        />
      </Suspense>
    </TeamReportsRouteShell>
  )
}

async function TeamReportsResultsContent(input: {
  activeTeamId: string
  requestedLoadMoreMode: boolean
  requestedPage: number
}) {
  const resultsData = await getTeamReportsResultsData({
    activeTeamId: input.activeTeamId,
    page: input.requestedPage,
    accumulatePages: input.requestedLoadMoreMode,
  })

  return (
    <ReportsTable
      reports={resultsData.reports}
      mode="team"
      emptyMessage="No reports created yet for this team."
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
    />
  )
}

export default async function TeamReportsPage({
  searchParams,
}: {
  searchParams: TeamReportsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedLoadMoreMode,
    requestedPage,
  } = resolveReportsListRequest({
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
        <h2 className="text-lg font-semibold text-amber-900">Team reports unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (scope.activeTeamId === null) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
        <p className="mt-2 text-sm text-amber-800">
          Team reports are disabled until a team is selected in the scope picker.
        </p>
      </section>
    )
  }

  const activeTeamId = scope.activeTeamId
  const canManageReports = canManageTeamStructure({
    context,
    organizationId: scope.activeOrgId,
    teamId: activeTeamId,
  })
  const chromeDataPromise = getTeamReportsChromeData({
    activeTeamId,
  })

  return (
    <div className="space-y-6">
      <ReportsFeedback
        statusMessage={statusMessage}
        errorMessage={errorMessage}
      />

      <Suspense fallback={<TeamReportsPageSkeleton />}>
        <TeamReportsShellSlot
          activeTeamId={activeTeamId}
          canManageReports={canManageReports}
          chromeDataPromise={chromeDataPromise}
          requestedLoadMoreMode={requestedLoadMoreMode}
          requestedPage={requestedPage}
          scope={scope}
        />
      </Suspense>
    </div>
  )
}
