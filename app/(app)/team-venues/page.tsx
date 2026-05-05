import {
  type TeamVenueCreateOption,
  type TeamVenueListItem,
  getTeamVenuesPageData,
} from "@/features/team-venues/data"
import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import { TeamVenuesFeedback } from "@/features/team-venues/team-venues-feedback"
import {
  CreateTeamVenueDialog,
  TeamVenuesTable,
} from "@/features/team-venues/team-venues-table"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamVenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Venue linked to team successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The selected venue or scope is invalid. Review and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to link venues for this team."
  }

  if (error === "already_linked") {
    return "This venue is already linked to the active team."
  }

  if (error === "create_failed") {
    return "Could not link venue to team. Confirm your permissions and try again."
  }

  return null
}

export default async function TeamVenuesPage({
  searchParams,
}: {
  searchParams: TeamVenuesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const selectedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team venues unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageTeamVenues =
    activeTeamId !== null &&
    canManageTeamStructure({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  const currentYear = new Date().getUTCFullYear()

  let linkedVenues: TeamVenueListItem[] = []
  let availableVenueOptions: TeamVenueCreateOption[] = []

  if (activeTeamId) {
    const pageData = await getTeamVenuesPageData({
      activeOrganizationId: scope.activeOrgId,
      activeTeamId,
      selectedVenueId,
      currentYear,
    })

    linkedVenues = pageData.linkedVenues
    availableVenueOptions = pageData.availableVenueOptions
  }

  const venueFilterOptions = linkedVenues.map((linkedVenue) => ({
    value: linkedVenue.venueId,
    label: `${linkedVenue.venueName} — ${linkedVenue.city}, ${linkedVenue.country}`,
  }))
  const createDisabled =
    noTeamSelected || !canManageTeamVenues || availableVenueOptions.length === 0

  return (
    <div className="space-y-6">
      <TeamVenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Team selection required
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageTeamVenues ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view team venue links, but only super admins, organization
            admins, team admins, and coaches can create new links.
          </p>
        </section>
      ) : null}

      <TeamVenuesTable
        linkedVenues={linkedVenues}
        noTeamSelected={noTeamSelected}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[
              {
                id: "team-venues-venue",
                name: "venue",
                label: "Venue",
                allLabel: "Venues",
                selectedValue: selectedVenueId ?? undefined,
                disabled: noTeamSelected || venueFilterOptions.length === 0,
                controlClassName: "min-w-[11rem]",
                options: venueFilterOptions,
              },
            ]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
            action={
              <CreateTeamVenueDialog
                availableVenueOptions={availableVenueOptions}
                scope={scope}
                selectedVenueId={selectedVenueId}
                disabled={createDisabled}
              />
            }
          />
        }
        selectedVenueId={selectedVenueId}
        scope={scope}
        currentYear={currentYear}
      />
    </div>
  )
}
