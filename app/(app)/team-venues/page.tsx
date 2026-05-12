import {
  type TeamVenueCreateOption,
  type TeamVenueListItem,
  type TeamVenueStatusCounts,
  type TeamVenueStatusFilter,
  getTeamVenuesPageData,
} from "@/features/team-venues/data"
import { TeamVenuesFeedback } from "@/features/team-venues/team-venues-feedback"
import {
  CreateTeamVenueDialog,
  TeamVenuesTable,
} from "@/features/team-venues/team-venues-table"
import { TeamVenuesToolbar } from "@/features/team-venues/team-venues-toolbar"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { isOrganizationAdmin } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamVenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "linked_existing") {
    return "Venue linked to team successfully."
  }

  if (status === "created_and_linked") {
    return "New venue created and linked to team successfully."
  }

  if (status === "updated") {
    return "Team venue updated successfully."
  }

  if (status === "deleted") {
    return "Team venue deleted successfully."
  }

  return null
}

function resolveTeamVenueStatusFilter(
  value: string | undefined,
): TeamVenueStatusFilter {
  if (value === "deprecated") {
    return "deprecated"
  }

  return "active"
}

function buildTeamVenueStatusHref(input: {
  statusFilter: TeamVenueStatusFilter
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("status", input.statusFilter)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  return `/team-venues?${params.toString()}`
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The selected venue or scope is invalid. Review and try again."
  }

  if (error === "forbidden") {
    return "You do not have access to this scope or the required organization admin permissions."
  }

  if (error === "already_linked") {
    return "This venue is already linked to the active team."
  }

  if (error === "create_failed") {
    return "Could not complete the venue request. Try again."
  }

  if (error === "link_failed_after_create") {
    return "Venue was created, but linking it to this team failed. You can try linking it again."
  }

  if (error === "update_failed") {
    return "Could not update the team venue. Try again."
  }

  if (error === "delete_failed") {
    return "Could not delete the team venue. Try again."
  }

  if (error === "has_linked_operations") {
    return "This team venue has linked camps or sessions and cannot be deleted."
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

  const result = getSingleSearchParamValue(resolvedSearchParams.result)
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const selectedStatusFilter = resolveTeamVenueStatusFilter(status)
  const statusMessage = getStatusMessage(result)
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
  const canManageVenueRows = isOrganizationAdmin(context, scope.activeOrgId)

  const currentYear = new Date().getUTCFullYear()

  let linkedVenues: TeamVenueListItem[] = []
  let availableVenueOptions: TeamVenueCreateOption[] = []
  let statusCounts: TeamVenueStatusCounts = {
    active: 0,
    deprecated: 0,
  }

  if (activeTeamId) {
    const pageData = await getTeamVenuesPageData({
      activeOrganizationId: scope.activeOrgId,
      activeTeamId,
      statusFilter: selectedStatusFilter,
      currentYear,
    })

    linkedVenues = pageData.linkedVenues
    availableVenueOptions = pageData.availableVenueOptions
    statusCounts = pageData.statusCounts
  }

  const createDisabled = noTeamSelected

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

      <TeamVenuesTable
        linkedVenues={linkedVenues}
        noTeamSelected={noTeamSelected}
        canManageVenueRows={canManageVenueRows}
        toolbar={
          <TeamVenuesToolbar
            selectedValue={selectedStatusFilter}
            options={[
              {
                label: "Active",
                value: "active",
                count: statusCounts.active,
                href: buildTeamVenueStatusHref({
                  statusFilter: "active",
                  scope,
                }),
              },
              {
                label: "Deprecated",
                value: "deprecated",
                count: statusCounts.deprecated,
                href: buildTeamVenueStatusHref({
                  statusFilter: "deprecated",
                  scope,
                }),
              },
            ]}
            action={
              <CreateTeamVenueDialog
                availableVenueOptions={availableVenueOptions}
                scope={scope}
                selectedStatusFilter={selectedStatusFilter}
                disabled={createDisabled}
              />
            }
          />
        }
        selectedStatusFilter={selectedStatusFilter}
        scope={scope}
        currentYear={currentYear}
      />
    </div>
  )
}
