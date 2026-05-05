import { CampsFeedback } from "@/features/camps/camps-feedback"
import { CreateCampDialog } from "@/features/camps/camp-form-dialogs"
import { TeamCampsTable } from "@/features/camps/camps-table"
import {
  getTeamCampsPageData,
  type TeamCampListItem,
  type TeamCampVenueFilterOption,
  type TeamCampVenueOption,
} from "@/features/camps/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamCampsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Camp created successfully."
  }

  if (status === "updated") {
    return "Camp updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted camp data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage camps for this team."
  }

  if (error === "create_failed") {
    return "Could not create camp. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update camp. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return "Plan limit reached for camps in this organization. Upgrade or change plan in Billing to continue."
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating camps."
  }

  return null
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

export default async function TeamCampsPage({
  searchParams,
}: {
  searchParams: TeamCampsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
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
        <h2 className="text-lg font-semibold text-amber-900">Team camps unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageCamps =
    activeTeamId !== null &&
    canManageTeamStructure({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  let camps: TeamCampListItem[] = []
  let teamVenueOptions: TeamCampVenueOption[] = []
  let venueFilterOptions: TeamCampVenueFilterOption[] = []
  let selectedVenueId: string | undefined = requestedVenueId
  let currentPage = requestedPage
  let hasPreviousPage = requestedPage > 1
  let hasNextPage = false

  if (activeTeamId) {
    const pageData = await getTeamCampsPageData({
      activeTeamId,
      selectedVenueId: requestedVenueId,
      page: requestedPage,
    })

    camps = pageData.camps
    teamVenueOptions = pageData.teamVenueOptions
    venueFilterOptions = pageData.venueFilterOptions
    selectedVenueId = pageData.selectedVenueId
    currentPage = pageData.currentPage
    hasPreviousPage = pageData.hasPreviousPage
    hasNextPage = pageData.hasNextPage
  }

  const createDisabled =
    noTeamSelected || !canManageCamps || teamVenueOptions.length === 0

  return (
    <div className="space-y-6">
      <CampsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

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

      {!noTeamSelected && !canManageCamps ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view camps in this scope, but only super admins, organization
            admins, team admins, and coaches can create or edit camps.
          </p>
        </section>
      ) : null}

      <TeamCampsTable
        camps={camps}
        teamVenueOptions={teamVenueOptions}
        canManageCamps={canManageCamps}
        noTeamSelected={noTeamSelected}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[
              {
                id: "camps-venue",
                name: "venue",
                label: "Venue",
                allLabel: "Venues",
                selectedValue: selectedVenueId,
                disabled: noTeamSelected || venueFilterOptions.length === 0,
                controlClassName: "min-w-[11rem]",
                options: venueFilterOptions.map((option) => ({
                  value: option.venueId,
                  label: `${option.venueName} — ${option.venueLocation}`,
                })),
              },
            ]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
            action={
              <CreateCampDialog
                teamVenueOptions={teamVenueOptions}
                scope={scope}
                selectedVenueId={selectedVenueId}
                currentPage={currentPage}
                disabled={createDisabled}
              />
            }
          />
        }
        scope={scope}
        selectedVenueId={selectedVenueId}
        currentPage={currentPage}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
      />
    </div>
  )
}
