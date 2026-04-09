import {
  getVenuePageData,
} from "@/features/venues/data";
import { VenuesFeedback } from "@/features/venues/venues-feedback";
import { VenuesTable } from "@/features/venues/venues-table";
import { requireAuthenticatedAccessContext } from "@/lib/auth/access";

type VenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function getSingleSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

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

  if (error === "create_failed") {
    return "Could not create venue. Confirm your permissions and try again.";
  }

  if (error === "update_failed") {
    return "Could not update venue. Confirm your permissions and try again.";
  }

  return null;
}

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: VenuesSearchParams;
}) {
  const context = await requireAuthenticatedAccessContext();
  const isSuperAdmin = context.effectiveRoles.globalRole === "super_admin";
  const resolvedSearchParams = await searchParams;
  const status = getSingleSearchParamValue(resolvedSearchParams.status);
  const error = getSingleSearchParamValue(resolvedSearchParams.error);
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  const { organizations, venues } = await getVenuePageData({
    profileId: context.user.id,
    isSuperAdmin,
  });

  const canManageVenues = isSuperAdmin || organizations.length > 0;

  return (
    <div className="space-y-6">
      <VenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageVenues ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Venue management unavailable
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            You do not have organization admin access yet. Ask an admin to add
            your `organization_memberships` entry.
          </p>
        </section>
      ) : null}

      <VenuesTable
        organizations={organizations}
        venues={venues}
        canManageVenues={canManageVenues}
      />
    </div>
  );
}
