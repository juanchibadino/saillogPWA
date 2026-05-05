import Link from "next/link"

import { getVenueDetailPageData } from "@/features/venues/detail-data"
import { VenueDetailTabsClient } from "@/features/venues/venue-detail-tabs-client"
import {
  buildTeamVenuesHref,
  buildVenueDetailHref,
  VENUE_DETAIL_TABS,
  type VenueDetailTab,
} from "@/features/venues/navigation"
import { VenuesFeedback } from "@/features/venues/venues-feedback"
import { EditVenueDialog } from "@/features/venues/venue-form-dialogs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type VenueDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

type VenueDetailParams = Promise<{ id: string }>

const DEFAULT_TAB: VenueDetailTab = "camps"

function resolveTab(value: string | undefined): VenueDetailTab {
  if (!value) {
    return DEFAULT_TAB
  }

  return VENUE_DETAIL_TABS.includes(value as VenueDetailTab)
    ? (value as VenueDetailTab)
    : DEFAULT_TAB
}

function parseRequestedYear(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return parsed
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "updated") {
    return "Venue updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "Some fields are invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage venues in the active organization."
  }

  if (error === "update_failed") {
    return "Could not update venue. Confirm your permissions and try again."
  }

  return null
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
  const selectedTab = resolveTab(getSingleSearchParamValue(resolvedSearchParams.tab))
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

  const detailData = await getVenueDetailPageData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: scope.activeTeamId,
    venueId: resolvedParams.id,
    requestedYear,
  })

  const venue = detailData.venue

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

  const canManageVenues = canManageOrganizationOperations(
    context,
    scope.activeOrgId,
  )
  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId] ?? []
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === scope.activeTeamId)?.name ??
    "No team selected"

  const venueForEdit = {
    ...venue,
    organizationName: activeOrganization.name,
  }

  const editRedirectTo = buildVenueDetailHref({
    scope,
    venueId: venue.id,
    tab: selectedTab,
    year: detailData.selectedYear,
  })

  const noTeamSelected = scope.activeTeamId === null
  const missingTeamVenueLink = !noTeamSelected && detailData.teamVenue === null

  return (
    <div>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">

          {canManageVenues ? (
            <EditVenueDialog
              venue={venueForEdit}
              organizations={[activeOrganization]}
              scope={scope}
              redirectTo={editRedirectTo}
            />
          ) : null}
        </div>
      </header>

      <VenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

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

      <VenueDetailTabsClient
        scope={scope}
        availableYears={detailData.availableYears}
        byYear={detailData.byYear}
        initialYear={detailData.selectedYear}
        initialTab={selectedTab}
      />
    </div>
  )
}
