import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { SessionsFeedback } from "@/features/sessions/sessions-feedback"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar"
import { buildTeamSessionsHref } from "@/features/sessions/navigation"
import {
  logTeamSessionsListTiming,
  startTeamSessionsListTiming,
} from "@/features/sessions/list-timing"
import { resolveTeamSessionsListRequest } from "@/features/sessions/list-route-state.mjs"
import {
  getTeamSessionsPageData,
  type TeamSessionCampOption,
  type TeamSessionHighlightFilter,
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

  if (status === "deleted") {
    return "Session deleted successfully."
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

  if (error === "delete_failed") {
    return "Could not delete session. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return "Plan limit reached for sessions in this organization. Upgrade or change plan in Billing to continue."
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating sessions."
  }

  return null
}

export default async function TeamSessionsPage({
  searchParams,
}: {
  searchParams: TeamSessionsSearchParams
}) {
  const scopeStartedAt = startTeamSessionsListTiming()
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const requestedCampId = getSingleSearchParamValue(resolvedSearchParams.camp)
  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamSessionsListRequest({
    highlightParam: getSingleSearchParamValue(resolvedSearchParams.highlight),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })
  logTeamSessionsListTiming({
    phase: "scope",
    startedAt: scopeStartedAt,
    activeTeamId: navigation.scope?.activeTeamId ?? null,
    status: "success",
    metadata: {
      hasScope: Boolean(navigation.scope),
      hasTeamScope: Boolean(navigation.scope?.activeTeamId),
    },
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
  let selectedHighlight: TeamSessionHighlightFilter | undefined = requestedHighlight
  let currentPage = requestedPage
  let pageCount = 1
  let hasPreviousPage = requestedPage > 1
  let hasNextPage = false

  if (activeTeamId) {
    const pageData = await getTeamSessionsPageData({
      activeTeamId,
      selectedVenueId: requestedVenueId,
      selectedCampId: requestedCampId,
      selectedHighlight: requestedHighlight,
      page: requestedPage,
      accumulatePages: requestedLoadMoreMode,
    })

    sessions = pageData.sessions
    venueFilterOptions = pageData.venueFilterOptions
    campFilterOptions = pageData.campFilterOptions
    campOptions = pageData.campOptions
    selectedVenueId = pageData.selectedVenueId
    selectedCampId = pageData.selectedCampId
    selectedHighlight = pageData.selectedHighlight
    currentPage = pageData.currentPage
    pageCount = pageData.pageCount
    hasPreviousPage = pageData.hasPreviousPage
    hasNextPage = pageData.hasNextPage
  }

  const createDisabled =
    noTeamSelected || !canManageSessions || campOptions.length === 0

  return (
    <div className="space-y-6">
      <SessionsFeedback
        mode="toast"
        statusMessage={statusMessage}
        errorMessage={errorMessage}
      />

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
          <TeamSessionsToolbar
            scope={scope}
            selectedVenueId={selectedVenueId ?? ""}
            selectedCampId={selectedCampId ?? ""}
            selectedHighlight={selectedHighlight ?? ""}
            venueDisabled={noTeamSelected || venueFilterOptions.length === 0}
            campDisabled={noTeamSelected || campFilterOptions.length === 0}
            venueOptions={[
              {
                value: "",
                label: "Venues",
                href: buildTeamSessionsHref({
                  scope,
                  highlight: selectedHighlight,
                }),
              },
              ...venueFilterOptions.map((option) => ({
                value: option.venueId,
                label: `${option.venueName} — ${option.venueLocation}`,
                href: buildTeamSessionsHref({
                  scope,
                  venueId: option.venueId,
                  highlight: selectedHighlight,
                }),
              })),
            ]}
            campOptions={[
              {
                value: "",
                label: "Camps",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: selectedVenueId,
                  highlight: selectedHighlight,
                }),
              },
              ...campFilterOptions.map((option) => ({
                value: option.campId,
                label: option.label,
                href: buildTeamSessionsHref({
                  scope,
                  venueId: selectedVenueId,
                  campId: option.campId,
                  highlight: selectedHighlight,
                }),
              })),
            ]}
            highlightOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: selectedVenueId,
                  campId: selectedCampId,
                }),
              },
              {
                value: "yes",
                label: "Yes",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: selectedVenueId,
                  campId: selectedCampId,
                  highlight: "yes",
                }),
              },
              {
                value: "no",
                label: "No",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: selectedVenueId,
                  campId: selectedCampId,
                  highlight: "no",
                }),
              },
            ]}
            action={
              <CreateSessionDialog
                campOptions={campOptions}
                scope={scope}
                selectedVenueId={selectedVenueId}
                selectedCampId={selectedCampId}
                selectedHighlight={selectedHighlight}
                currentPage={currentPage}
                disabled={createDisabled}
                surface="sheet"
              />
            }
          />
        }
        scope={scope}
        selectedVenueId={selectedVenueId}
        selectedCampId={selectedCampId}
        selectedHighlight={selectedHighlight}
        currentPage={currentPage}
        pageCount={pageCount}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
      />
    </div>
  )
}
