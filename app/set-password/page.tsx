import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentAccessContext } from "@/lib/auth/access";

type SetPasswordSearchParams = Promise<
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
  if (status === "updated") {
    return "Password updated successfully. You can now sign in with email and password.";
  }

  return null;
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "missing_password") {
    return "Enter a new password.";
  }

  if (error === "password_too_short") {
    return "Password must be at least 6 characters.";
  }

  if (error === "password_mismatch") {
    return "Passwords do not match.";
  }

  if (error === "update_failed") {
    return "Could not update password. Try again.";
  }

  return null;
}

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: SetPasswordSearchParams;
}) {
  const context = await getCurrentAccessContext();

  if (!context.user) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = await searchParams;
  const status = getSingleSearchParamValue(resolvedSearchParams.status);
  const error = getSingleSearchParamValue(resolvedSearchParams.error);
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Set password</CardTitle>
          <CardDescription>
            Set a password so this account can use email + password sign-in.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {statusMessage ? (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <form action="/auth/update-password" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="set-password-new">New password</Label>
              <Input
                id="set-password-new"
                type="password"
                name="password"
                required
                autoComplete="new-password"
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="set-password-confirm">Confirm password</Label>
              <Input
                id="set-password-confirm"
                type="password"
                name="confirmPassword"
                required
                autoComplete="new-password"
                minLength={6}
                placeholder="Repeat the password"
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ className: "w-full" })}
            >
              Save password
            </button>
          </form>

          <Link
            href="/dashboard"
            className={buttonVariants({
              variant: "link",
              size: "sm",
              className: "h-auto px-0 text-xs",
            })}
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
