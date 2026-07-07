import { ReportsTable } from "@/features/reports/reports-table"
import { getCurrentUtcYear, getOrganizationReportsPageData } from "@/features/reports/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard"
import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
} from "@/lib/navigation/scope"

type ReportsSearchParams = Promise<Record<string, string | string[] | undefined>>

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: ReportsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const requestedYear = parseRequestedYear(
    getSingleSearchParamValue(resolvedSearchParams.year),
  )
  const requestedTeamId = getSingleSearchParamValue(resolvedSearchParams.team)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)

  const navigation = await requireOrganizationRouteAccess({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Organization reports unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (!canManageOrganizationOperations(context, scope.activeOrgId)) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Reports restricted</h2>
        <p className="mt-2 text-sm text-amber-800">
          Organization reports are available only to organization admins and super admins.
        </p>
      </section>
    )
  }

  const pageData = await getOrganizationReportsPageData({
    activeOrganizationId: scope.activeOrgId,
    year: requestedYear,
    selectedTeamId: requestedTeamId ?? undefined,
    selectedVenueId: requestedVenueId ?? undefined,
  })

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name={NAVIGATION_SCOPE_ORG_QUERY_KEY} value={scope.activeOrgId} />

          <div className="space-y-1">
            <label htmlFor="org-reports-year" className="text-sm font-medium">
              Year
            </label>
            <input
              id="org-reports-year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={requestedYear}
              className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="org-reports-team" className="text-sm font-medium">
              Team
            </label>
            <select
              id="org-reports-team"
              name="team"
              defaultValue={pageData.selectedTeamId ?? ""}
              className="flex h-9 w-72 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">All teams</option>
              {pageData.teamOptions.map((option) => (
                <option key={option.teamId} value={option.teamId}>
                  {option.teamName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="org-reports-venue" className="text-sm font-medium">
              Venue
            </label>
            <select
              id="org-reports-venue"
              name="venue"
              defaultValue={pageData.selectedVenueId ?? ""}
              className="flex h-9 w-80 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">All venues</option>
              {pageData.venueOptions.map((option) => (
                <option key={option.teamVenueId} value={option.teamVenueId}>
                  {option.teamName} — {option.venueName}
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reports</h2>
        <ReportsTable
          reports={pageData.reports}
          mode="organization"
          emptyMessage="No reports found for this filter."
        />
      </section>
    </div>
  )
}
