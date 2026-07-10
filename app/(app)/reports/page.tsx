import { Suspense } from "react"

import {
  OrganizationReportsPageSkeleton,
  OrganizationReportsResultsSkeleton,
} from "@/components/shared/page-skeletons"
import {
  getCurrentUtcYear,
  getOrganizationReportsChromeData,
  getOrganizationReportsResultsData,
  type OrganizationReportsChromeData,
} from "@/features/reports/data"
import { ReportsTable } from "@/features/reports/reports-table"
import { OrganizationReportsRouteShell } from "@/features/reports/reports-route-shell"
import { resolveReportsListRequest } from "@/features/reports/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard"
import {
  getSingleSearchParamValue,
} from "@/lib/navigation/scope"

type ReportsSearchParams = Promise<Record<string, string | string[] | undefined>>
type ResolvedReportsScope = NonNullable<
  Awaited<ReturnType<typeof requireOrganizationRouteAccess>>["scope"]
>
type OrganizationReportsChromeDataPromise = Promise<OrganizationReportsChromeData>

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

async function OrganizationReportsShellSlot(input: {
  chromeDataPromise: OrganizationReportsChromeDataPromise
  currentYear: number
  requestedLoadMoreMode: boolean
  requestedPage: number
  requestedYear: number
  scope: ResolvedReportsScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <OrganizationReportsRouteShell
      chromeData={chromeData}
      currentYear={input.currentYear}
      requestedYear={input.requestedYear}
      scope={input.scope}
    >
      <Suspense fallback={<OrganizationReportsResultsSkeleton />}>
        <OrganizationReportsResultsContent
          activeOrganizationId={input.scope.activeOrgId}
          chromeData={chromeData}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          requestedYear={input.requestedYear}
        />
      </Suspense>
    </OrganizationReportsRouteShell>
  )
}

async function OrganizationReportsResultsContent(input: {
  activeOrganizationId: string
  chromeData: OrganizationReportsChromeData
  requestedLoadMoreMode: boolean
  requestedPage: number
  requestedYear: number
}) {
  const resultsData = await getOrganizationReportsResultsData({
    activeOrganizationId: input.activeOrganizationId,
    year: input.requestedYear,
    selectedTeamId: input.chromeData.selectedTeamId,
    selectedVenueId: input.chromeData.selectedVenueId,
    page: input.requestedPage,
    accumulatePages: input.requestedLoadMoreMode,
  })

  return (
    <ReportsTable
      reports={resultsData.reports}
      mode="organization"
      emptyMessage="No reports found for this filter."
      currentPage={resultsData.currentPage}
      pageCount={resultsData.pageCount}
      hasPreviousPage={resultsData.hasPreviousPage}
      hasNextPage={resultsData.hasNextPage}
    />
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: ReportsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const currentYear = getCurrentUtcYear()

  const requestedYear = parseRequestedYear(
    getSingleSearchParamValue(resolvedSearchParams.year),
  )
  const requestedTeamId = getSingleSearchParamValue(resolvedSearchParams.team)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const {
    requestedLoadMoreMode,
    requestedPage,
  } = resolveReportsListRequest({
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
  })

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

  const chromeDataPromise = getOrganizationReportsChromeData({
    activeOrganizationId: scope.activeOrgId,
    selectedTeamId: requestedTeamId ?? undefined,
    selectedVenueId: requestedVenueId ?? undefined,
  })

  return (
    <Suspense fallback={<OrganizationReportsPageSkeleton />}>
      <OrganizationReportsShellSlot
        chromeDataPromise={chromeDataPromise}
        currentYear={currentYear}
        requestedLoadMoreMode={requestedLoadMoreMode}
        requestedPage={requestedPage}
        requestedYear={requestedYear}
        scope={scope}
      />
    </Suspense>
  )
}
