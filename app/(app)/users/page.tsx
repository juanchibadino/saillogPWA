import { Suspense } from "react"

import {
  UsersPageSkeleton,
  UsersResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { UsersFeedback } from "@/features/users/users-feedback"
import { UsersTable } from "@/features/users/users-table"
import { UsersRouteShell } from "@/features/users/users-route-shell"
import {
  getUsersChromeData,
  getUsersResultsData,
  type UsersChromeData,
} from "@/features/users/data"
import {
  resolveUsersListRequest,
  USERS_TEAM_FILTER_QUERY_KEY,
} from "@/features/users/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard"
import {
  getSingleSearchParamValue,
} from "@/lib/navigation/scope"

type UsersSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedUsersScope = NonNullable<
  Awaited<ReturnType<typeof requireOrganizationRouteAccess>>["scope"]
>
type UsersChromeDataPromise = Promise<UsersChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "invited") {
    return "Invite created successfully."
  }

  if (status === "created") {
    return "Member created successfully."
  }

  if (status === "updated") {
    return "Member updated successfully."
  }

  if (status === "unlinked") {
    return "Member unlinked from team."
  }

  if (status === "deleted") {
    return "User deleted successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted member data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage members in the active organization."
  }

  if (error === "member_exists") {
    return "This member already has the selected access."
  }

  if (error === "create_failed") {
    return "Could not create member. Confirm the email and permissions, then try again."
  }

  if (error === "invite_email_failed") {
    return "Access was created, but the invite email could not be sent."
  }

  if (error === "update_failed") {
    return "Could not update member data. Confirm your permissions and try again."
  }

  if (error === "unlink_failed") {
    return "Could not unlink member from this team. Confirm your permissions and try again."
  }

  if (error === "unlink_blocked_last_access") {
    return "Unlink would leave this user without app access. Delete the user instead if you want to remove their account."
  }

  if (error === "delete_failed") {
    return "Could not delete user. Confirm your permissions and try again."
  }

  if (error === "delete_blocked_linked_elsewhere") {
    return "This user has active access outside this organization. Remove those links before deleting the user."
  }

  return null
}

async function UsersShellSlot(input: {
  canManageUsers: boolean
  chromeDataPromise: UsersChromeDataPromise
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedUsersScope
}) {
  let chromeData: UsersChromeData

  try {
    chromeData = await input.chromeDataPromise
  } catch {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Member data unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not load member filters. Check server configuration and try again.
        </p>
      </section>
    )
  }

  return (
    <UsersRouteShell
      canManageUsers={input.canManageUsers}
      chromeData={chromeData}
      currentPage={input.requestedPage}
      loadMoreMode={input.requestedLoadMoreMode}
      scope={input.scope}
    >
      <Suspense fallback={<UsersResultsSkeleton />}>
        <UsersResultsContent
          chromeData={chromeData}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          scope={input.scope}
        />
      </Suspense>
    </UsersRouteShell>
  )
}

async function UsersResultsContent(input: {
  chromeData: UsersChromeData
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedUsersScope
}) {
  let resultsData: Awaited<ReturnType<typeof getUsersResultsData>>

  try {
    resultsData = await getUsersResultsData({
      accumulatePages: input.requestedLoadMoreMode,
      activeOrganizationId: input.scope.activeOrgId,
      page: input.requestedPage,
      selectedTeamId: input.chromeData.selectedTeamId,
      teamOptions: input.chromeData.teamOptions,
    })
  } catch {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Members unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not load member rows. Check server configuration and try again.
        </p>
      </section>
    )
  }

  return (
    <UsersTable
      canManageUsers
      crews={resultsData.crews}
      currentPage={resultsData.currentPage}
      hasNextPage={resultsData.hasNextPage}
      hasPreviousPage={resultsData.hasPreviousPage}
      loadMoreMode={input.requestedLoadMoreMode}
      pageCount={resultsData.pageCount}
      scope={input.scope}
      selectedTeamId={input.chromeData.selectedTeamId}
      teamOptions={input.chromeData.teamOptions}
    />
  )
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
  const requestedTeamId = getSingleSearchParamValue(
    resolvedSearchParams[USERS_TEAM_FILTER_QUERY_KEY],
  )
  const {
    requestedLoadMoreMode,
    requestedPage,
  } = resolveUsersListRequest({
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await requireOrganizationRouteAccess({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Members unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Member management requires an active organization context.
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
  const chromeDataPromise = canManageUsers
    ? getUsersChromeData({
        activeOrganizationId: scope.activeOrgId,
        requestedTeamId,
      })
    : null

  return (
    <div className="space-y-6">
      <UsersFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageUsers ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            Member management is restricted to super admins and organization admins.
          </p>
        </section>
      ) : null}

      {chromeDataPromise ? (
        <Suspense fallback={<UsersPageSkeleton />}>
          <UsersShellSlot
            canManageUsers={canManageUsers}
            chromeDataPromise={chromeDataPromise}
            requestedLoadMoreMode={requestedLoadMoreMode}
            requestedPage={requestedPage}
            scope={scope}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
