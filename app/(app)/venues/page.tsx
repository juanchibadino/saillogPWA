import { Suspense } from "react";

import { FreeTierQuotaDialog } from "@/features/billing/free-tier-quota-dialog";
import { VenuesFeedback } from "@/features/venues/venues-feedback";
import { VenuesTable } from "@/features/venues/venues-table";
import { VenuesRouteShell } from "@/features/venues/venues-route-shell";
import {
  VenuesPageSkeleton,
  VenuesResultsSkeleton,
} from "@/components/shared/page-skeletons";
import { canManageOrganizationOperations } from "@/lib/auth/capabilities";
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard";
import {
  getSingleSearchParamValue,
} from "@/lib/navigation/scope";
import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import {
  VENUE_STATUS_QUERY_KEY,
  resolveVenuesListRequest,
} from "@/features/venues/list-route-state.mjs";
import {
  getVenuesChromeData,
  getVenuesResultsData,
  type VenueOrganizationOption,
  type VenuesChromeData,
  type VenueStatusFilter,
} from "@/features/venues/data";

type VenuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
type ResolvedVenuesScope = NonNullable<
  Awaited<ReturnType<typeof requireOrganizationRouteAccess>>["scope"]
>;
type VenuesChromeDataPromise = Promise<VenuesChromeData>;
type VenuesListRequest = {
  requestedLoadMoreMode: boolean;
  requestedPage: number;
  requestedStatusFilter: VenueStatusFilter;
};

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
    return null;
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue creating venues.";
  }

  return null;
}

async function VenuesShellSlot(input: {
  activeOrganization: VenueOrganizationOption;
  canManageVenues: boolean;
  chromeDataPromise: VenuesChromeDataPromise;
  requestedLoadMoreMode: boolean;
  requestedPage: number;
  requestedStatusFilter: VenueStatusFilter;
  scope: ResolvedVenuesScope;
}) {
  const chromeData = await input.chromeDataPromise;

  return (
    <VenuesRouteShell
      canManageVenues={input.canManageVenues}
      chromeData={chromeData}
      scope={input.scope}
    >
      <Suspense fallback={<VenuesResultsSkeleton />}>
        <VenuesResultsContent
          activeOrganization={input.activeOrganization}
          activeTeamId={input.scope.activeTeamId}
          requestedLoadMoreMode={input.requestedLoadMoreMode}
          requestedPage={input.requestedPage}
          requestedStatusFilter={input.requestedStatusFilter}
          scope={input.scope}
        />
      </Suspense>
    </VenuesRouteShell>
  );
}

async function VenuesResultsContent(input: {
  activeOrganization: VenueOrganizationOption;
  activeTeamId: string | null;
  requestedLoadMoreMode: boolean;
  requestedPage: number;
  requestedStatusFilter: VenueStatusFilter;
  scope: ResolvedVenuesScope;
}) {
  const resultsData = await getVenuesResultsData({
    activeOrganization: input.activeOrganization,
    activeTeamId: input.activeTeamId,
    accumulatePages: input.requestedLoadMoreMode,
    page: input.requestedPage,
    statusFilter: input.requestedStatusFilter,
  });

  return (
    <VenuesTable
      currentPage={resultsData.currentPage}
      hasNextPage={resultsData.hasNextPage}
      hasPreviousPage={resultsData.hasPreviousPage}
      pageCount={resultsData.pageCount}
      scope={input.scope}
      venues={resultsData.venues}
    />
  );
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
  const {
    requestedLoadMoreMode,
    requestedPage,
    requestedStatusFilter,
  } = resolveVenuesListRequest({
    statusParam: getSingleSearchParamValue(
      resolvedSearchParams[VENUE_STATUS_QUERY_KEY],
    ),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as VenuesListRequest;
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  const navigation = await requireOrganizationRouteAccess({
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

  const canManageVenues = canManageOrganizationOperations(
    context,
    scope.activeOrgId,
  );
  const chromeDataPromise = getVenuesChromeData({
    activeOrganization,
    statusFilter: requestedStatusFilter,
  });

  return (
    <div className="space-y-6">

      <VenuesFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      <FreeTierQuotaDialog
        organizationId={activeOrganization.id}
        teamId={scope.activeTeamId}
      />

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

      <Suspense fallback={<VenuesPageSkeleton />}>
        <VenuesShellSlot
          activeOrganization={activeOrganization}
          canManageVenues={canManageVenues}
          chromeDataPromise={chromeDataPromise}
          requestedLoadMoreMode={requestedLoadMoreMode}
          requestedPage={requestedPage}
          requestedStatusFilter={requestedStatusFilter}
          scope={scope}
        />
      </Suspense>
    </div>
  );
}
