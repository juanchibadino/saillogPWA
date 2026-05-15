import { CreateStandardMoveDialog } from "@/features/standard-moves/standard-moves-form-dialogs"
import { StandardMovesFeedback } from "@/features/standard-moves/standard-moves-feedback"
import { TeamStandardMovesTable } from "@/features/standard-moves/standard-moves-table"
import { TeamStandardMovesToolbar } from "@/features/standard-moves/team-standard-moves-toolbar"
import {
  getTeamStandardMovesPageData,
  type TeamStandardMoveListItem,
} from "@/features/standard-moves/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamStandardMovesSearchParams = Promise<Record<string, string | string[] | undefined>>
type TeamStandardMoveStatusFilter = "active" | "archived" | "all"

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Standard move created successfully."
  }

  if (status === "updated") {
    return "Standard move updated successfully."
  }

  if (status === "archived") {
    return "Standard move archived successfully."
  }

  if (status === "restored") {
    return "Standard move restored successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted standard move data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage standard moves for this team."
  }

  if (error === "create_failed") {
    return "Could not create standard move. Confirm permissions and uniqueness of the name."
  }

  if (error === "update_failed") {
    return "Could not update standard move. Confirm permissions and try again."
  }

  return null
}

function resolveStatusFilter(value: string | undefined): TeamStandardMoveStatusFilter {
  if (value === "archived") {
    return "archived"
  }

  if (value === "all") {
    return "all"
  }

  return "active"
}

function buildTeamStandardMovesFiltersHref(input: {
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
  statusFilter?: TeamStandardMoveStatusFilter
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.statusFilter && input.statusFilter !== "active") {
    params.set("statusFilter", input.statusFilter)
  }

  return `/team-standard-moves?${params.toString()}`
}

function filterMovesByStatus(input: {
  moves: TeamStandardMoveListItem[]
  statusFilter: TeamStandardMoveStatusFilter
}): TeamStandardMoveListItem[] {
  if (input.statusFilter === "all") {
    return input.moves
  }

  if (input.statusFilter === "archived") {
    return input.moves.filter((move) => !move.isActive)
  }

  return input.moves.filter((move) => move.isActive)
}

export default async function TeamStandardMovesPage({
  searchParams,
}: {
  searchParams: TeamStandardMovesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedStatusFilter = resolveStatusFilter(
    getSingleSearchParamValue(resolvedSearchParams.statusFilter),
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
        <h2 className="text-lg font-semibold text-amber-900">Standard moves unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageStandardMoves =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  let moves: TeamStandardMoveListItem[] = []
  let activeCount = 0
  let archivedCount = 0

  if (activeTeamId) {
    const pageData = await getTeamStandardMovesPageData({
      activeTeamId,
    })

    moves = filterMovesByStatus({
      moves: pageData.moves,
      statusFilter: requestedStatusFilter,
    })
    activeCount = pageData.activeCount
    archivedCount = pageData.archivedCount
  }

  const createDisabled = noTeamSelected || !canManageStandardMoves

  return (
    <div className="space-y-6">
      <StandardMovesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageStandardMoves ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view standard moves in this scope, but only super admins, organization
            admins, team admins, coaches, and crew can create or edit standard moves.
          </p>
        </section>
      ) : null}

      <TeamStandardMovesTable
        moves={moves}
        canManageStandardMoves={canManageStandardMoves}
        noTeamSelected={noTeamSelected}
        selectedStatusFilter={requestedStatusFilter}
        scope={scope}
        toolbar={
          <TeamStandardMovesToolbar
            selectedValue={requestedStatusFilter}
            disabled={noTeamSelected}
            options={[
              {
                value: "active",
                label: "Active",
                href: buildTeamStandardMovesFiltersHref({
                  scope,
                  statusFilter: "active",
                }),
                count: activeCount,
              },
              {
                value: "archived",
                label: "Archived",
                href: buildTeamStandardMovesFiltersHref({
                  scope,
                  statusFilter: "archived",
                }),
                count: archivedCount,
              },
              {
                value: "all",
                label: "All",
                href: buildTeamStandardMovesFiltersHref({
                  scope,
                  statusFilter: "all",
                }),
                count: activeCount + archivedCount,
              },
            ]}
            action={
              <CreateStandardMoveDialog
                scope={scope}
                statusFilter={requestedStatusFilter}
                disabled={createDisabled}
              />
            }
          />
        }
      />
    </div>
  )
}
