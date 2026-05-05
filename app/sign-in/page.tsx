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
import { Separator } from "@/components/ui/separator";
import { getCurrentAccessContext } from "@/lib/auth/access";

type SignInSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type SignInMode = "sign-in" | "register";

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

  if (error === "missing_password") {
    return "Enter your password.";
  }

  if (error === "otp_failed") {
    return "We could not send the sign-in link. Try again.";
  }

  if (error === "password_failed") {
    return "Email or password is invalid. Try again.";
  }

  if (error === "callback_failed") {
    return "The sign-in link could not be verified. Request a new one.";
  }

  return null;
}

function resolveMode(value: string | undefined): SignInMode {
  if (value === "register") {
    return "register";
  }

  return "sign-in";
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
  const mode = resolveMode(getSingleSearchParamValue(resolvedSearchParams.mode));
  const isRegisterMode = mode === "register";
  const statusMessage = getStatusMessage(status);
  const errorMessage = getErrorMessage(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {isRegisterMode ? "Sailog Registration" : "Sailog"}
          </p>
          <CardTitle className="text-2xl">
            {isRegisterMode ? "Create your account" : "Sign in"}
          </CardTitle>
          <CardDescription>
            {isRegisterMode
              ? "Start with a magic link. You can set a password after your first access."
              : "Use email + password or request a magic link."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {isRegisterMode ? (
            <p className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              New to Sailog? Enter your email below and we will send a secure sign-in
              link to create your account.
            </p>
          ) : null}

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

          <form action="/auth/password" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sign-in-email-password">Email</Label>
              <Input
                id="sign-in-email-password"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@team.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sign-in-password">Password</Label>
              <Input
                id="sign-in-password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ className: "w-full" })}
            >
              {isRegisterMode ? "Sign in with existing password" : "Sign in with password"}
            </button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>

          <form action="/auth/otp" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sign-in-email-magic-link">Email</Label>
              <Input
                id="sign-in-email-magic-link"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@team.com"
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              {isRegisterMode ? "Create account with magic link" : "Send magic link"}
            </button>
          </form>

          <p className="text-xs text-muted-foreground">
            Your access is granted by organization and team memberships. If this is
            your first login, ask an admin to assign your membership.
          </p>

          <p className="text-xs text-muted-foreground">
            Signed in with magic link only?{" "}
            <Link
              href="/set-password"
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "h-auto px-0 text-xs",
              })}
            >
              Set password
            </Link>
          </p>

          <Link
            href="/"
            className={buttonVariants({
              variant: "link",
              size: "sm",
              className: "h-auto px-0 text-xs",
            })}
          >
            Back to home
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
