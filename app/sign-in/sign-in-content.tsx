"use client";

import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { SignInAccessCodePanel } from "./access-code-panel";

type SignInAccessCodeProps = {
  isRegisterMode: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
};

export function SignInAuthContent({
  isRegisterMode,
  statusMessage,
  errorMessage,
}: SignInAccessCodeProps) {
  const [isAccessCodeMode, setIsAccessCodeMode] = useState(false);

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
              {isRegisterMode
                ? "Sign in with existing password"
                : "Sign in with password"}
            </button>
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
        onChangeEmail={handleChangeEmail}
        onRequestSuccess={handleAccessCodeRequest}
      />
    </div>
  );
}
