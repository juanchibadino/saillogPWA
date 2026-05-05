import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { isSuperAdmin } from "@/lib/auth/capabilities"
import { getSingleSearchParamValue, resolveNavigationScope } from "@/lib/navigation/scope"
import { CreateOrganizationDialog } from "@/features/organizations/organization-form-dialogs"
import { OrganizationsFeedback } from "@/features/organizations/organizations-feedback"
import { OrganizationsTable } from "@/features/organizations/organizations-table"
import { getOrganizationsPageData } from "@/features/organizations/data"

type OrganizationsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Organization created successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted organization data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "Only super admins can create organization records."
  }

  if (error === "create_failed") {
    return "Could not create organization. Confirm your permissions and try again."
  }

  return null
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: OrganizationsSearchParams
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
  const { organizations } = await getOrganizationsPageData()
  const canManageOrganizations = isSuperAdmin(context)

  const toolbar =
    navigation.scope ? (
      <TableFiltersToolbar
        scope={navigation.scope}
        fields={[]}
        embedded
        autoSubmit
        className="rounded-none border-0 bg-transparent p-0"
        action={
          <CreateOrganizationDialog
            scope={navigation.scope}
            disabled={!canManageOrganizations}
          />
        }
      />
    ) : canManageOrganizations ? (
      <CreateOrganizationDialog scope={null} disabled={false} />
    ) : undefined

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Browse organization records visible in your current access scope.
        </p>
      </header>

      <OrganizationsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageOrganizations ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view organizations in your scope, but only super admins can create
            organization records.
          </p>
        </section>
      ) : null}

      <OrganizationsTable organizations={organizations} toolbar={toolbar} />
    </div>
  )
}
