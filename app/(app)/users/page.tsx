import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import { UsersFeedback } from "@/features/users/users-feedback"
import { UsersTable } from "@/features/users/users-table"
import { getUsersPageData, type UsersPageData } from "@/features/users/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type UsersSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "updated") {
    return "User updated successfully."
  }

  if (status === "deleted") {
    return "User removed successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted user data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage users in the active organization."
  }

  if (error === "update_failed") {
    return "Could not update user data. Confirm your permissions and try again."
  }

  if (error === "delete_failed") {
    return "Could not remove user from this team. Confirm your permissions and try again."
  }

  return null
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: UsersSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedTeamId = getSingleSearchParamValue(resolvedSearchParams.team)

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Users unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          User management requires an active organization context.
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

  const canManageUsers = canManageOrganizationOperations(context, scope.activeOrgId)
  let usersData: UsersPageData = { crews: [], teamOptions: [], selectedTeamId: undefined }
  let usersLoadError: string | null = null

  if (canManageUsers) {
    try {
      usersData = await getUsersPageData({
        activeOrganizationId: scope.activeOrgId,
        requestedTeamId,
      })
    } catch {
      usersLoadError = "Could not load user data. Check server configuration and try again."
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Showing team members for <strong>{activeOrganization.name}</strong>.
        </p>
      </header>

      <UsersFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageUsers ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            User management is restricted to super admins and organization admins.
          </p>
        </section>
      ) : null}

      {usersLoadError ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">User data unavailable</h2>
          <p className="mt-2 text-sm text-amber-800">{usersLoadError}</p>
        </section>
      ) : null}

      <UsersTable
        crews={usersData.crews}
        teamOptions={usersData.teamOptions}
        canManageUsers={canManageUsers}
        scope={scope}
        selectedTeamId={usersData.selectedTeamId}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[
              {
                id: "users-team",
                name: "team",
                label: "Team",
                allLabel: "Teams",
                selectedValue: usersData.selectedTeamId,
                disabled: usersData.teamOptions.length === 0,
                controlClassName: "min-w-[11rem]",
                options: usersData.teamOptions.map((team) => ({
                  value: team.id,
                  label: team.name,
                })),
              },
            ]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
          />
        }
      />
    </div>
  )
}
