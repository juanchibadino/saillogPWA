import Link from "next/link"
import { Suspense } from "react"

import { VenueDetailDeferredContentSkeleton } from "@/components/shared/page-skeletons"
import {
  getTeamVenueDetailChromeData,
  getTeamVenueDetailKpisData,
  getTeamVenueDetailTabData,
  getTeamVenueDetailYearContextData,
} from "@/features/venues/detail-data"
import type {
  VenueDetailKpisData,
  VenueDetailTabPayload,
  VenueDetailVenue,
} from "@/features/venues/detail-types"
import type { VenueOrganizationOption } from "@/features/venues/data"
import { VenueDetailTabsClient } from "@/features/venues/venue-detail-tabs-client"
import {
  buildTeamVenuesHref,
  buildVenueDetailHref,
  type VenueDetailTab,
} from "@/features/venues/navigation"
import { resolveVenueDetailRouteRequest } from "@/features/venues/detail-route-state.mjs"
import { RouteCacheInvalidationOnSuccess } from "@/features/shared/route-cache-invalidation-on-success"
import { VenuesFeedback } from "@/features/venues/venues-feedback"
import { EditVenueDialog } from "@/features/venues/venue-form-dialogs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canDeleteCamps,
  canManageOrganizationOperations,
  canManageTeamSessions,
  canManageTeamStructure,
} from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type VenueDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

type VenueDetailParams = Promise<{ id: string }>
type WindPatternStatusFilter = "active" | "archived" | "all"
type ResolvedVenueDetailScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>

function getStatusMessage(
  status: string | undefined,
  selectedTab: VenueDetailTab,
): string | null {
  if (selectedTab === "camps") {
    if (status === "created") {
      return "Camp created successfully."
    }

    if (status === "updated") {
      return "Camp updated successfully."
    }

    if (status === "deleted") {
      return "Camp deleted successfully."
    }
  }

  if (status === "updated") {
    return "Venue updated successfully."
  }

  if (status === "template_saved") {
    return "Assessment template saved successfully."
  }

  if (status === "run_saved") {
    return "Assessment run saved successfully."
  }

  if (status === "run_published") {
    return "Assessment run published successfully."
  }

  if (status === "run_closed") {
    return "Assessment run closed successfully."
  }

  if (status === "answers_saved") {
    return "Assessment answers saved successfully."
  }

  if (status === "report_created") {
    return "Report created successfully."
  }

  if (status === "wind_pattern_created") {
    return "Wind pattern created successfully."
  }

  if (status === "wind_pattern_updated") {
    return "Wind pattern updated successfully."
  }

  if (status === "wind_pattern_archived") {
    return "Wind pattern archived successfully."
  }

  if (status === "wind_pattern_restored") {
    return "Wind pattern restored successfully."
  }

  return null
}

function getErrorMessage(
  error: string | undefined,
  selectedTab: VenueDetailTab,
): string | null {
  if (error === "invalid_input") {
    return "Some fields are invalid. Review the form and try again."
  }

  if (selectedTab === "camps") {
    if (error === "create_failed") {
      return "Could not create camp. Confirm the selected venue and try again."
    }

    if (error === "update_failed") {
      return "Could not update camp. Confirm your permissions and try again."
    }

    if (error === "delete_failed") {
      return "Could not delete camp. Confirm your permissions and try again."
    }

    if (error === "forbidden") {
      return "You do not have permission to manage camps in the active team."
    }
  }

  if (error === "forbidden") {
    return "You do not have permission to manage venues in the active organization."
  }

  if (error === "update_failed") {
    return "Could not update venue. Confirm your permissions and try again."
  }

  if (error === "save_failed") {
    return "Could not save assessment data. Confirm your permissions and try again."
  }

  if (error === "publish_failed") {
    return "Could not publish assessment run. Confirm camps and permissions, then try again."
  }

  if (error === "close_failed") {
    return "Could not close assessment run. Confirm your permissions and try again."
  }

  if (error === "answer_failed") {
    return "Could not save assessment answers. Confirm the run is published and try again."
  }

  if (error === "create_failed") {
    return "Could not create report. Confirm the selected camps and try again."
  }

  if (error === "wind_pattern_create_failed") {
    return "Could not create wind pattern. Confirm permissions and uniqueness of the name."
  }

  if (error === "wind_pattern_update_failed") {
    return "Could not update wind pattern. Confirm permissions and try again."
  }

  return null
}

function resolveWindPatternStatusFilter(value: string | undefined): WindPatternStatusFilter {
  if (value === "archived") {
    return "archived"
  }

  if (value === "all") {
    return "all"
  }

  return "active"
}

async function VenueDetailDeferredContent(input: {
  activeOrganization: VenueOrganizationOption
  canDeleteCamps: boolean
  canManageCamps: boolean
  canManageAssessments: boolean
  canManageReports: boolean
  canManageSessions: boolean
  canManageVenues: boolean
  canManageWindPatterns: boolean
  initialTab: VenueDetailTab
  initialTabDataPromise: Promise<VenueDetailTabPayload>
  initialWindPatternStatusFilter: WindPatternStatusFilter
  kpisPromise: Promise<VenueDetailKpisData>
  scope: ResolvedVenueDetailScope
  teamVenueId: string
  venue: VenueDetailVenue
}) {
  const [kpisData, initialTabData] = await Promise.all([
    input.kpisPromise,
    input.initialTabDataPromise,
  ])
  const venueForEdit = {
    ...input.venue,
    organizationName: input.activeOrganization.name,
  }
  const editRedirectTo = buildVenueDetailHref({
    scope: input.scope,
    teamVenueId: input.teamVenueId,
    tab: input.initialTab,
    year: kpisData.selectedYear,
  })
  const detailHeaderAction = input.canManageVenues ? (
    <EditVenueDialog
      venue={venueForEdit}
      organizations={[input.activeOrganization]}
      scope={input.scope}
      teamVenueId={input.teamVenueId}
      redirectTo={editRedirectTo}
    />
  ) : null

  return (
    <VenueDetailTabsClient
      scope={input.scope}
      teamVenueId={input.teamVenueId}
      venueId={input.venue.id}
      venueLocation={`${input.venue.city}, ${input.venue.country}`}
      venueName={input.venue.name}
      availableYears={kpisData.availableYears}
      kpis={kpisData.kpis}
      initialYear={kpisData.selectedYear}
      initialTab={input.initialTab}
      initialTabData={initialTabData}
      canDeleteCamps={input.canDeleteCamps}
      canManageCamps={input.canManageCamps}
      canManageAssessments={input.canManageAssessments}
      canManageReports={input.canManageReports}
      canManageSessions={input.canManageSessions}
      canManageWindPatterns={input.canManageWindPatterns}
      initialWindPatternStatusFilter={input.initialWindPatternStatusFilter}
      action={detailHeaderAction}
    />
  )
}

export default async function VenueDetailPage({
  params,
  searchParams,
}: {
  params: VenueDetailParams
  searchParams: VenueDetailSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const cacheSessionId = getSingleSearchParamValue(resolvedSearchParams.cacheSession)
  const cacheCampId = getSingleSearchParamValue(resolvedSearchParams.cacheCamp)
  const cacheTeamVenueId =
    getSingleSearchParamValue(resolvedSearchParams.cacheTeamVenue) ?? resolvedParams.id
  const requestedCampId = getSingleSearchParamValue(resolvedSearchParams.camp)
  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
    requestedYear,
    selectedTab,
  } = resolveVenueDetailRouteRequest({
    highlightParam: getSingleSearchParamValue(resolvedSearchParams.highlight),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    tabParam: getSingleSearchParamValue(resolvedSearchParams.tab),
    yearParam: getSingleSearchParamValue(resolvedSearchParams.year),
  }) as {
    requestedHighlight?: "yes" | "no"
    requestedLoadMoreMode: boolean
    requestedPage: number
    requestedYear?: number
    selectedTab: VenueDetailTab
  }
  const requestedWindPatternStatusFilter = resolveWindPatternStatusFilter(
    getSingleSearchParamValue(resolvedSearchParams.statusFilter),
  )

  const statusMessage = getStatusMessage(status, selectedTab)
  const errorMessage = getErrorMessage(error, selectedTab)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">No active scope</h2>
        <p className="mt-2 text-sm text-amber-800">
          Venue detail requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const activeOrganization =
    navigation.catalog.organizations.find(
      (organization) => organization.id === scope.activeOrgId,
    ) ?? null

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

  const chromeData = await getTeamVenueDetailChromeData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: scope.activeTeamId,
    teamVenueId: resolvedParams.id,
  })

  const venue = chromeData.venue

  if (!venue) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Venue unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          This venue does not exist in the active organization scope or is not accessible.
        </p>
      </section>
    )
  }

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId] ?? []
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === scope.activeTeamId)?.name ??
    "No team selected"

  const noTeamSelected = scope.activeTeamId === null
  const missingTeamVenueLink = !noTeamSelected && chromeData.teamVenue === null
  const canManageVenues =
    !noTeamSelected &&
    chromeData.teamVenue !== null &&
    canManageOrganizationOperations(context, scope.activeOrgId)
  const canManageAssessments =
    !noTeamSelected && chromeData.teamVenue
      ? canManageTeamStructure({
          context,
          organizationId: scope.activeOrgId,
          teamId: chromeData.teamVenue.team_id,
        })
      : false
  const canManageCamps = canManageAssessments
  const canDeleteCampRows =
    !noTeamSelected && chromeData.teamVenue
      ? canDeleteCamps({
          context,
          organizationId: scope.activeOrgId,
          teamId: chromeData.teamVenue.team_id,
        })
      : false
  const canManageReports = canManageAssessments
  const canManageSessions =
    !noTeamSelected && chromeData.teamVenue
      ? canManageTeamSessions({
          context,
          organizationId: scope.activeOrgId,
          teamId: chromeData.teamVenue.team_id,
        })
      : false
  const canManageWindPatterns = canManageSessions
  const yearContextPromise = getTeamVenueDetailYearContextData({
    activeTeamId: scope.activeTeamId,
    requestedYear,
    teamVenue: chromeData.teamVenue,
  })
  const kpisPromise = getTeamVenueDetailKpisData({
    activeTeamId: scope.activeTeamId,
    requestedYear,
    teamVenue: chromeData.teamVenue,
    yearContextPromise,
  })
  const initialTabDataPromise = getTeamVenueDetailTabData({
    activeTeamId: scope.activeTeamId,
    accumulatePages: requestedLoadMoreMode,
    currentProfileId: context.user.id,
    requestedPage,
    requestedYear,
    selectedCampId: requestedCampId,
    selectedHighlight: requestedHighlight,
    tab: selectedTab,
    teamVenue: chromeData.teamVenue,
    venue,
    yearContextPromise,
  })

  return (
    <div>
      <VenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      {chromeData.teamVenue ? (
        <>
          <RouteCacheInvalidationOnSuccess
            mutation="venue"
            scope={scope}
            teamVenueId={cacheTeamVenueId}
            successStatuses={selectedTab === "camps" ? [] : ["updated"]}
          />
          <RouteCacheInvalidationOnSuccess
            mutation="camp"
            scope={scope}
            campId={cacheCampId}
            teamVenueId={cacheTeamVenueId}
            successStatuses={
              selectedTab === "camps" ? ["created", "updated", "deleted"] : []
            }
          />
          <RouteCacheInvalidationOnSuccess
            mutation="session"
            scope={scope}
            sessionId={cacheSessionId}
            campId={cacheCampId ?? requestedCampId}
            teamVenueId={cacheTeamVenueId}
            successStatuses={
              selectedTab === "sessions" ? ["created", "updated", "deleted"] : []
            }
          />
          <RouteCacheInvalidationOnSuccess
            mutation="venue-detail"
            scope={scope}
            teamVenueId={cacheTeamVenueId}
          />
        </>
      ) : null}

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Venue operations are team-scoped. Select a team from the scope picker to load
            camps and sessions.
          </p>
        </section>
      ) : null}

      {missingTeamVenueLink ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Venue not linked to team</h2>
          <p className="mt-2 text-sm text-amber-800">
            Link this venue to <strong>{activeTeamLabel}</strong> in Team Venues to view camps
            and sessions.
          </p>
          <Link
            href={buildTeamVenuesHref(scope, venue.id)}
            className="mt-4 inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium"
          >
            Open Team Venues
          </Link>
        </section>
      ) : null}

      <Suspense
        fallback={
          <VenueDetailDeferredContentSkeleton
            selectedTab={selectedTab}
            selectedYear={requestedYear}
          />
        }
      >
        <VenueDetailDeferredContent
          activeOrganization={activeOrganization}
          canDeleteCamps={canDeleteCampRows}
          canManageCamps={canManageCamps}
          canManageAssessments={canManageAssessments}
          canManageReports={canManageReports}
          canManageSessions={canManageSessions}
          canManageVenues={canManageVenues}
          canManageWindPatterns={canManageWindPatterns}
          initialTab={selectedTab}
          initialTabDataPromise={initialTabDataPromise}
          initialWindPatternStatusFilter={requestedWindPatternStatusFilter}
          kpisPromise={kpisPromise}
          scope={scope}
          teamVenueId={resolvedParams.id}
          venue={venue}
        />
      </Suspense>
    </div>
  )
}
