import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import { CreateTeamDialog } from "@/features/teams/team-form-dialogs"
import { TeamsFeedback } from "@/features/teams/teams-feedback"
import { TeamsTable } from "@/features/teams/teams-table"
import { getTeamsPageData } from "@/features/teams/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { getSingleSearchParamValue, resolveNavigationScope } from "@/lib/navigation/scope"

type TeamsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Team created successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted team data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to create teams in the active organization."
  }

  if (error === "create_failed") {
    return "Could not create team. Confirm your permissions and try again."
  }

  if (error === "plan_limit_reached") {
    return "Plan limit reached for teams in this organization. Upgrade or change plan in Billing to continue."
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating teams."
  }

  return null
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: TeamsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Teams unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Team management requires an active organization context.
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

  const { teams } = await getTeamsPageData({
    activeOrganizationId: activeOrganization.id,
  })
  const canManageTeams = canManageOrganizationOperations(context, activeOrganization.id)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Showing teams for <strong>{activeOrganization.name}</strong>.
        </p>
      </header>

      <TeamsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageTeams ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view teams in this organization, but only super admins and
            organization admins can create team records here.
          </p>
        </section>
      ) : null}

      <TeamsTable
        teams={teams}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
            action={
              <CreateTeamDialog
                organizationId={activeOrganization.id}
                scope={scope}
                disabled={!canManageTeams}
              />
            }
          />
        }
      />
    </div>
  )
}
