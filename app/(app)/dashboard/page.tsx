import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";

export default async function DashboardPage() {
  const context = await requireAuthenticatedAccessContext();

  if (!hasAppAccess(context)) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Global role</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">
          {context.effectiveRoles.globalRole ?? "None"}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Organization memberships</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">
          {context.organizationMemberships.length}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Team memberships</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">
          {context.teamMemberships.length}
        </p>
      </section>
    </div>
  );
}
