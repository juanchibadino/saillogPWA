import { CampsFeedback } from "@/features/camps/camps-feedback"
import { CreateCampDialog } from "@/features/camps/camp-form-dialogs"
import { TeamCampsTable } from "@/features/camps/camps-table"
import { TeamVenuesToolbar } from "@/features/team-venues/team-venues-toolbar"
import {
  getTeamCampsPageData,
  type TeamCampListItem,
  type TeamCampVenueFilterOption,
  type TeamCampVenueOption,
} from "@/features/camps/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canDeleteCamps, canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
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

  if (status === "deleted") {
    return "Camp deleted successfully."
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

  if (error === "delete_failed") {
    return "Could not delete camp. Confirm your permissions and try again."
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

function buildTeamCampVenueFilterHref(input: {
  venueId?: string
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

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  return `/team-camps?${params.toString()}`
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
  const canDeleteCampRows =
    activeTeamId !== null &&
    canDeleteCamps({
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
        canDeleteCamps={canDeleteCampRows}
        noTeamSelected={noTeamSelected}
        toolbar={
          <TeamVenuesToolbar
            filterLabel="Venue"
            selectedValue={selectedVenueId ?? ""}
            disabled={noTeamSelected || venueFilterOptions.length === 0}
            options={[
              {
                value: "",
                label: "Venues",
                href: buildTeamCampVenueFilterHref({ scope }),
              },
              ...venueFilterOptions.map((option) => ({
                value: option.venueId,
                label: `${option.venueName} — ${option.venueLocation}`,
                href: buildTeamCampVenueFilterHref({
                  scope,
                  venueId: option.venueId,
                }),
              })),
            ]}
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
