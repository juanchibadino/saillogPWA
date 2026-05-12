import { createTeamVenueReportAction } from "@/features/reports/actions"
import { getCurrentUtcYear, getTeamReportsPageData } from "@/features/reports/data"
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

function parseRequestedYear(value: string | undefined): number {
  if (!value) {
    return getCurrentUtcYear()
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return getCurrentUtcYear()
  }

  return parsed
}

function buildTeamReportsHref(input: {
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
  year: number
  venueId?: string
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("year", String(input.year))

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.venueId) {
    params.set("venue", input.venueId)
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
    return "Invalid report input. Select a year and at least one camp."
  }

  if (error === "forbidden") {
    return "You do not have permission to create reports in this team."
  }

  if (error === "create_failed") {
    return "Could not create report. Confirm report scope and try again."
  }

  return null
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)
}

function formatCampDateRange(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  const start = formatter.format(new Date(`${startDate}T00:00:00.000Z`))
  const end = formatter.format(new Date(`${endDate}T00:00:00.000Z`))

  return `${start} to ${end}`
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
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const requestedYear = parseRequestedYear(
    getSingleSearchParamValue(resolvedSearchParams.year),
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
    selectedVenueId: requestedVenueId ?? undefined,
    year: requestedYear,
  })

  const redirectTo = buildTeamReportsHref({
    scope,
    year: requestedYear,
    venueId: pageData.selectedVenueId ?? undefined,
  })

  return (
    <div className="space-y-6">
      {statusMessage ? (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">{statusMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-xl border border-rose-300 bg-rose-50 p-4">
          <p className="text-sm text-rose-800">{errorMessage}</p>
        </section>
      ) : null}

      {!canManageReports ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Report creation is limited to team admins and coaches.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name={NAVIGATION_SCOPE_ORG_QUERY_KEY} value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name={NAVIGATION_SCOPE_TEAM_QUERY_KEY} value={scope.activeTeamId} />
          ) : null}

          <div className="space-y-1">
            <label htmlFor="team-reports-year" className="text-sm font-medium">
              Year
            </label>
            <input
              id="team-reports-year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={requestedYear}
              className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="team-reports-venue" className="text-sm font-medium">
              Venue
            </label>
            <select
              id="team-reports-venue"
              name="venue"
              defaultValue={pageData.selectedVenueId ?? ""}
              className="flex h-9 w-72 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">All venues</option>
              {pageData.venueOptions.map((option) => (
                <option key={option.teamVenueId} value={option.teamVenueId}>
                  {option.venueName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium"
          >
            Apply
          </button>
        </form>
      </section>

      {canManageReports ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Create report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one or more camps for {requestedYear}. New reports are immutable records.
          </p>

          <form action={createTeamVenueReportAction} className="mt-4 space-y-4">
            <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <input type="hidden" name="year" value={String(requestedYear)} />
            <input type="hidden" name="teamVenueId" value={pageData.selectedVenueId ?? ""} />

            <div className="space-y-2">
              <label htmlFor="team-report-name" className="text-sm font-medium">
                Report name (optional)
              </label>
              <input
                id="team-report-name"
                name="reportName"
                maxLength={200}
                placeholder="Auto: Venue + year + camps"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Camps</legend>

              {pageData.campOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No camps available for the selected year and venue.
                </p>
              ) : (
                <div className="grid gap-2">
                  {pageData.campOptions.map((camp) => (
                    <label
                      key={camp.campId}
                      className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="campIds"
                        value={camp.campId}
                        className="mt-1 size-4 rounded border-input"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{camp.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatCampDateRange(camp.startDate, camp.endDate)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={pageData.selectedVenueId === null || pageData.campOptions.length === 0}
            >
              Create report
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports for {requestedYear}.
        </p>

        {pageData.reports.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No reports found for this filter.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border">
            {pageData.reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.venueName ?? "Unknown venue"} · {report.campCount}{" "}
                    {report.campCount === 1 ? "camp" : "camps"}
                  </p>
                  <p className="text-xs text-muted-foreground">{report.campNames.join(", ")}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateTimeLabel(report.createdAt)} UTC
                  </p>
                </div>

                <a
                  href={`/api/reports/${report.id}/pdf`}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium"
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
