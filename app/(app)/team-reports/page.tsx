import {
  CreateTeamReportDialog,
} from "@/features/reports/report-form-dialogs"
import { ReportsTable } from "@/features/reports/reports-table"
import { FeedbackToast } from "@/components/shared/feedback-toast"
import {
  formatCampDateRange,
  getTeamReportsPageData,
} from "@/features/reports/data"
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

export default async function TeamReportsPage({
  searchParams,
}: {
  searchParams: TeamReportsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)

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

  const canManageReports = canManageTeamStructure({
    context,
    organizationId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  })

  const pageData = await getTeamReportsPageData({
    activeTeamId: scope.activeTeamId,
  })

  const redirectTo = buildTeamReportsHref({
    scope,
  })

  const dialogCampOptions = pageData.createCampOptions.map((camp) => ({
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
    <div className="space-y-6">
      <FeedbackToast statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageReports ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Report creation is limited to team admins and coaches.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Reports</h2>
          {canManageReports ? (
            <CreateTeamReportDialog
              scope={scope}
              redirectTo={redirectTo}
              venueOptions={pageData.venueOptions}
              campOptions={dialogCampOptions}
            />
          ) : null}
        </div>

        <ReportsTable
          reports={pageData.reports}
          mode="team"
          emptyMessage="No reports created yet for this team."
        />
      </section>
    </div>
  )
}
