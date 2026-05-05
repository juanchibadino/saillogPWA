import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { SessionsFeedback } from "@/features/sessions/sessions-feedback"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import {
  getTeamSessionsPageData,
  type TeamSessionCampOption,
  type TeamSessionListItem,
  type TeamSessionVenueFilterOption,
} from "@/features/sessions/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamSessionsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Session created successfully."
  }

  if (status === "updated") {
    return "Session updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted session data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage sessions for this team."
  }

  if (error === "create_failed") {
    return "Could not create session. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update session. Confirm your permissions and try again."
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

export default async function TeamSessionsPage({
  searchParams,
}: {
  searchParams: TeamSessionsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const requestedCampId = getSingleSearchParamValue(resolvedSearchParams.camp)
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
        <h2 className="text-lg font-semibold text-amber-900">Team sessions unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageSessions =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  let sessions: TeamSessionListItem[] = []
  let venueFilterOptions: TeamSessionVenueFilterOption[] = []
  let campFilterOptions: TeamSessionCampOption[] = []
  let campOptions: TeamSessionCampOption[] = []
  let selectedVenueId: string | undefined = requestedVenueId
  let selectedCampId: string | undefined = requestedCampId
  let currentPage = requestedPage
  let hasPreviousPage = requestedPage > 1
  let hasNextPage = false

  if (activeTeamId) {
    const pageData = await getTeamSessionsPageData({
      activeTeamId,
      selectedVenueId: requestedVenueId,
      selectedCampId: requestedCampId,
      page: requestedPage,
    })

    sessions = pageData.sessions
    venueFilterOptions = pageData.venueFilterOptions
    campFilterOptions = pageData.campFilterOptions
    campOptions = pageData.campOptions
    selectedVenueId = pageData.selectedVenueId
    selectedCampId = pageData.selectedCampId
    currentPage = pageData.currentPage
    hasPreviousPage = pageData.hasPreviousPage
    hasNextPage = pageData.hasNextPage
  }

  const createDisabled =
    noTeamSelected || !canManageSessions || campOptions.length === 0

  return (
    <div className="space-y-6">
      <SessionsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

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

      {!noTeamSelected && !canManageSessions ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view sessions in this scope, but only super admins,
            organization admins, team admins, coaches, and crew can create or
            edit sessions.
          </p>
        </section>
      ) : null}

      <TeamSessionsTable
        sessions={sessions}
        campOptions={campOptions}
        canManageSessions={canManageSessions}
        noTeamSelected={noTeamSelected}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[
              {
                id: "sessions-venue",
                name: "venue",
                label: "Venue",
                allLabel: "Venues",
                selectedValue: selectedVenueId,
                disabled: noTeamSelected || venueFilterOptions.length === 0,
                controlClassName: "min-w-[10rem]",
                options: venueFilterOptions.map((option) => ({
                  value: option.venueId,
                  label: `${option.venueName} — ${option.venueLocation}`,
                })),
              },
              {
                id: "sessions-camp",
                name: "camp",
                label: "Camp",
                allLabel: "Camps",
                selectedValue: selectedCampId,
                disabled: noTeamSelected || campFilterOptions.length === 0,
                controlClassName: "min-w-[9rem]",
                options: campFilterOptions.map((option) => ({
                  value: option.campId,
                  label: option.label,
                })),
              },
            ]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
            action={
              <CreateSessionDialog
                campOptions={campOptions}
                scope={scope}
                selectedVenueId={selectedVenueId}
                selectedCampId={selectedCampId}
                currentPage={currentPage}
                disabled={createDisabled}
              />
            }
          />
        }
        scope={scope}
        selectedVenueId={selectedVenueId}
        selectedCampId={selectedCampId}
        currentPage={currentPage}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
      />
    </div>
  )
}
