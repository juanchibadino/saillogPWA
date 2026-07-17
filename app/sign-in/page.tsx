import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentAccessContext, hasAppAccess } from "@/lib/auth/access";
import { SignInAuthContent } from "./sign-in-content";

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

  if (error === "google_failed") {
    return "Google sign-in is not available right now. Try email instead.";
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

  if (context.user && hasAppAccess(context)) {
    redirect("/post-auth");
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
      <Card className="w-full max-w-sm border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {isRegisterMode ? "Dock Out Registration" : "Dock Out"}
          </p>
          <CardTitle className="text-2xl">
            {isRegisterMode ? "Create your account" : "Sign in"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <SignInAuthContent
            statusMessage={statusMessage}
            errorMessage={errorMessage}
          />
          <p className="text-center text-xs leading-5 text-muted-foreground">
            By continuing, you agree to the{" "}
            <Link
              href="/terms"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
