"use client";

import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { SignInAccessCodePanel } from "./access-code-panel";

type SignInAccessCodeProps = {
  statusMessage: string | null;
  errorMessage: string | null;
  nextPath: string;
};

export function SignInAuthContent({
  statusMessage,
  errorMessage,
  nextPath,
}: SignInAccessCodeProps) {
  const [isAccessCodeMode, setIsAccessCodeMode] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!event.currentTarget.checkValidity()) {
      return;
    }

    setIsPasswordSubmitting(true);
  };

  const handleAccessCodeRequest = () => {
    setIsAccessCodeMode(true);
  };

  const handleChangeEmail = () => {
    setIsAccessCodeMode(false);
  };

  return (
    <div className="space-y-5">
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

      {!isAccessCodeMode ? (
        <>
          <form
            action="/auth/password"
            method="post"
            className="space-y-4"
            onSubmit={handlePasswordSubmit}
          >
            <input type="hidden" name="next" value={nextPath} />
            <fieldset
              aria-disabled={isPasswordSubmitting}
              className="space-y-4 data-[pending=true]:opacity-60"
              data-pending={isPasswordSubmitting}
            >
              <div className="space-y-2">
                <Label htmlFor="sign-in-email-password">Email</Label>
                <Input
                  id="sign-in-email-password"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@team.com"
                  className="h-11 px-3 md:h-8 md:px-2.5"
                  readOnly={isPasswordSubmitting}
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
                  className="h-11 px-3 md:h-8 md:px-2.5"
                  readOnly={isPasswordSubmitting}
                />
              </div>

              <button
                type="submit"
                className={buttonVariants({ className: "h-11 w-full md:h-8" })}
                disabled={isPasswordSubmitting}
                aria-busy={isPasswordSubmitting}
              >
                {isPasswordSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Sign In
              </button>
            </fieldset>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>
        </>
      ) : null}

      <SignInAccessCodePanel
        nextPath={nextPath}
        onChangeEmail={handleChangeEmail}
        onRequestSuccess={handleAccessCodeRequest}
      />
    </div>
  );
}
