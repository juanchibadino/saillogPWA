import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccessContext } from "@/lib/auth/access";

type SignInSearchParams = Promise<
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
  if (status === "check-email") {
    return "Check your email for the sign-in link.";
  }

  return null;
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "missing_email") {
    return "Enter a valid email address.";
  }

  if (error === "otp_failed") {
    return "We could not send the sign-in link. Try again.";
  }

  if (error === "callback_failed") {
    return "The sign-in link could not be verified. Request a new one.";
  }

  return null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SignInSearchParams;
}) {
  const context = await getCurrentAccessContext();

  if (context.user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const status = getSingleSearchParamValue(resolvedSearchParams.status);
  const error = getSingleSearchParamValue(resolvedSearchParams.error);
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sailog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-slate-600">
            Use your team email to receive a one-time sign-in link.
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

        <form action="/auth/otp" method="post" className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@team.com"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Send magic link
          </button>
        </form>

        <p className="text-xs text-slate-500">
          Your access is granted by organization and team memberships. If this is
          your first login, ask an admin to assign your membership.
        </p>

        <Link href="/" className="text-xs text-slate-500 underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
