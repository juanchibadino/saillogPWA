import { getVenuePageData } from "@/features/venues/data";
import { CreateVenueDialog } from "@/features/venues/venue-form-dialogs";
import { VenuesFeedback } from "@/features/venues/venues-feedback";
import { VenuesTable } from "@/features/venues/venues-table";
import { TableFiltersToolbar } from "@/components/shared/table-filters-toolbar";
import { canManageOrganizationOperations } from "@/lib/auth/capabilities";
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope";
import { requireAuthenticatedAccessContext } from "@/lib/auth/access";

type VenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Venue created successfully.";
  }

  if (status === "updated") {
    return "Venue updated successfully.";
  }

  return null;
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "Some fields are invalid. Review the form and try again.";
  }

  if (error === "forbidden") {
    return "You do not have permission to manage venues in the active organization.";
  }

  if (error === "create_failed") {
    return "Could not create venue. Confirm your permissions and try again.";
  }

  if (error === "update_failed") {
    return "Could not update venue. Confirm your permissions and try again.";
  }

  if (error === "plan_limit_reached") {
    return "Plan limit reached for venues in this organization. Upgrade or change plan in Billing to continue.";
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Billing to continue creating venues.";
  }

  return null;
}

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: VenuesSearchParams;
}) {
  const context = await requireAuthenticatedAccessContext();
  const resolvedSearchParams = await searchParams;

  const status = getSingleSearchParamValue(resolvedSearchParams.status);
  const error = getSingleSearchParamValue(resolvedSearchParams.error);
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  });

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">No active scope</h2>
        <p className="mt-2 text-sm text-amber-800">
          Venue management requires an active organization context.
        </p>
      </section>
    );
  }

  const scope = navigation.scope;
  const activeOrganization =
    navigation.catalog.organizations.find(
      (organization) => organization.id === scope.activeOrgId,
    ) ?? null;

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
    );
  }

  const { organizations, venues } = await getVenuePageData({
    activeOrganization,
  });

  const canManageVenues = canManageOrganizationOperations(
    context,
    scope.activeOrgId,
  );

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId] ?? [];
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === scope.activeTeamId)?.name ??
    "No team selected";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
        <p className="text-sm text-muted-foreground">
          Showing organization-owned venues for <strong>{activeOrganization.name}</strong>.
          Team scope is <strong>{activeTeamLabel}</strong>. Team-specific venue links are
          handled in Team Venues.
        </p>
      </header>

      <VenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageVenues ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Venue management unavailable
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view venues in this scope, but only super admins and
            organization admins can create or edit organization venue records.
          </p>
        </section>
      ) : null}

      <VenuesTable
        venues={venues}
        toolbar={
          <TableFiltersToolbar
            scope={scope}
            fields={[]}
            embedded
            autoSubmit
            className="rounded-none border-0 bg-transparent p-0"
            action={
              canManageVenues && organizations.length > 0 ? (
                <CreateVenueDialog organizations={organizations} scope={scope} />
              ) : undefined
            }
          />
        }
        scope={scope}
      />
    </div>
  );
}
