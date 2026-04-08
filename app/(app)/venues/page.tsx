import {
  createVenueAction,
  updateVenueAction,
} from "@/features/venues/actions";
import { getVenuePageData } from "@/features/venues/data";
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
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Phase 6
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Venues
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Create and manage operational venues by organization. This is the first
          CRUD slice for the Team → TeamVenueSeason → Camp → Session chain.
        </p>
      </header>

      {statusMessage ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </p>
      ) : null}

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

      {canManageVenues && organizations.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Create venue</h2>
          <form action={createVenueAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Organization
              </span>
              <select
                name="organizationId"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                name="name"
                type="text"
                required
                maxLength={120}
                placeholder="Palma Bay"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Country</span>
              <input
                name="country"
                type="text"
                maxLength={120}
                placeholder="Spain"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">City</span>
              <input
                name="city"
                type="text"
                maxLength={120}
                placeholder="Palma"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <input
                name="venueType"
                type="text"
                maxLength={120}
                placeholder="training_base"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Create venue
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Existing venues ({venues.length})
        </h2>

        {venues.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No venues found for your organizations yet.
          </p>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <form
                key={venue.id}
                action={updateVenueAction}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                <input type="hidden" name="id" value={venue.id} />
                <input
                  type="hidden"
                  name="organizationId"
                  value={venue.organization_id}
                />

                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {venue.organizationName}
                    </p>
                    <p className="text-sm text-slate-500">Venue ID: {venue.id}</p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={venue.is_active}
                      className="size-4 rounded border-slate-300"
                    />
                    Active
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Name</span>
                    <input
                      name="name"
                      type="text"
                      required
                      maxLength={120}
                      defaultValue={venue.name}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Country
                    </span>
                    <input
                      name="country"
                      type="text"
                      maxLength={120}
                      defaultValue={venue.country ?? ""}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">City</span>
                    <input
                      name="city"
                      type="text"
                      maxLength={120}
                      defaultValue={venue.city ?? ""}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Type</span>
                    <input
                      name="venueType"
                      type="text"
                      maxLength={120}
                      defaultValue={venue.venue_type ?? ""}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Notes</span>
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={2000}
                      defaultValue={venue.notes ?? ""}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Save changes
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
