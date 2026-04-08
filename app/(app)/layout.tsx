import Link from "next/link";

import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";

function formatDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : "Sailog User";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuthenticatedAccessContext();
  const canAccessApp = hasAppAccess(context);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sailog
            </p>
            <p className="text-sm text-slate-700">
              {formatDisplayName(
                context.profile?.first_name ?? null,
                context.profile?.last_name ?? null,
              )}{" "}
              · {context.user.email ?? "No email"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </Link>
              <Link
                href="/venues"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Venues
              </Link>
            </nav>

            <form action="/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {canAccessApp ? (
          children
        ) : (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
            <h1 className="text-xl font-semibold text-amber-900">Access pending</h1>
            <p className="mt-2 text-sm text-amber-800">
              Your account is authenticated but has no active organization or team
              membership yet.
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Ask a team admin to add your membership before continuing.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
