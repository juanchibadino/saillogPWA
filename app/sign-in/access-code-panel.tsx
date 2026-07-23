"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type OtpRequestError = "missing_email" | "otp_failed";
type OtpVerifyError =
  | "missing_email"
  | "missing_token"
  | "invalid_code"
  | "expired_code";

const COOLDOWN_SECONDS = 180;

type SignInAccessCodePanelProps = {
  nextPath: string;
  onChangeEmail?: () => void;
  onRequestSuccess?: () => void;
};

function mapRequestError(error: OtpRequestError): string {
  if (error === "missing_email") {
    return "Enter a valid email address.";
  }

  return "We could not send the access code. Try again.";
}

function mapVerifyError(error: OtpVerifyError): string {
  if (error === "expired_code") {
    return "The access code has expired. Request a new one.";
  }

  if (error === "missing_token") {
    return "Enter the 6-digit access code.";
  }

  if (error === "missing_email") {
    return "Enter a valid email address.";
  }

  return "The access code is invalid. Try again.";
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function isValidOtp(token: string): boolean {
  return token.trim().length === 6 && /^\d+$/.test(token);
}

export function SignInAccessCodePanel({
  nextPath,
  onChangeEmail,
  onRequestSuccess,
}: SignInAccessCodePanelProps) {
  const notifyChangeEmail = useCallback(() => {
    onChangeEmail?.();
  }, [onChangeEmail]);

  const notifyRequestSuccess = useCallback(() => {
    onRequestSuccess?.();
  }, [onRequestSuccess]);

  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [showOtpInput, setShowOtpInput] = useState(false);
  const [requestErrorMessage, setRequestErrorMessage] = useState("");
  const [verifyErrorMessage, setVerifyErrorMessage] = useState("");

  const [isRequesting, setIsRequesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [remainingSeconds]);

  const resetVerificationMessages = useCallback(() => {
    setVerifyErrorMessage("");
  }, []);

  const handleChangeEmail = useCallback(() => {
    setShowOtpInput(false);
    setOtp("");
    setRemainingSeconds(0);
    setRequestErrorMessage("");
    setVerifyErrorMessage("");
    notifyChangeEmail();
  }, [notifyChangeEmail]);

  const requestAccessCode = useCallback(
    async (isRefresh: boolean = false) => {
      const updateLoading = isRefresh ? setIsRefreshing : setIsRequesting;
      updateLoading(true);
      setRequestErrorMessage("");
      if (!isRefresh) {
        setVerifyErrorMessage("");
      }

      try {
        const response = await fetch("/auth/otp", {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim(), next: nextPath }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true }
          | { ok: false; error: OtpRequestError }
          | null;

        if (!response.ok || !payload?.ok) {
          setRequestErrorMessage(
            mapRequestError(payload?.ok === false ? payload.error : "otp_failed"),
          );
          return;
        }

        setShowOtpInput(true);
        setOtp("");
        setRemainingSeconds(COOLDOWN_SECONDS);
        notifyRequestSuccess();
      } finally {
        updateLoading(false);
      }
    },
    [email, nextPath, notifyRequestSuccess],
  );

  const verifyAccessCode = useCallback(async () => {
    setIsVerifying(true);
    setVerifyErrorMessage("");

    try {
      if (!isValidOtp(otp)) {
        setVerifyErrorMessage("The access code must be 6 digits.");
        return;
      }

      const response = await fetch("/auth/otp/verify", {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), next: nextPath, token: otp }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; next: string }
        | { ok: false; error: OtpVerifyError }
        | null;

      if (!response.ok || !payload?.ok) {
        setVerifyErrorMessage(
          mapVerifyError(payload?.ok === false ? payload.error : "invalid_code"),
        );
        return;
      }

      router.replace(payload.next);
    } catch {
      setVerifyErrorMessage("The access code is invalid. Try again.");
    } finally {
      setIsVerifying(false);
    }
  }, [email, nextPath, otp, router]);

  const refreshDisabled = remainingSeconds > 0 || isRefreshing;
  const showRefreshSpinner = remainingSeconds > 0 || isRefreshing;

  return (
    <div className="space-y-4">
      {!showOtpInput ? (
        <div className="space-y-2">
          <Label htmlFor="sign-in-email-access-code">Email</Label>
          <Input
            id="sign-in-email-access-code"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@team.com"
            className="h-11 px-3 md:h-8 md:px-2.5"
            value={email}
            disabled={isRequesting || isRefreshing || isVerifying}
            onChange={(event) => {
              setEmail(event.target.value);
              if (requestErrorMessage) {
                setRequestErrorMessage("");
              }
              if (verifyErrorMessage) {
                setVerifyErrorMessage("");
              }
            }}
          />
        </div>
      ) : null}

      {!showOtpInput ? (
        <button
          type="button"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 w-full md:h-8",
          })}
          disabled={isRequesting || !email.trim()}
          onClick={() => void requestAccessCode(false)}
        >
          {isRequesting ? <Loader2 className="size-4 animate-spin" /> : null}
          Request access code
        </button>
      ) : null}

      {requestErrorMessage ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {requestErrorMessage}
        </p>
      ) : null}

      {showOtpInput ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="w-full">
              <InputOTP
                id="sign-in-otp-code"
                value={otp}
                maxLength={6}
                disabled={isVerifying}
                containerClassName="w-full"
                onChange={(value) => {
                  setOtp(value);
                  resetVerificationMessages();
                }}
              >
                <InputOTPGroup className="w-full gap-2">
                  <InputOTPSlot
                    index={0}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                  <InputOTPSlot
                    index={1}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                  <InputOTPSlot
                    index={2}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                  <InputOTPSlot
                    index={3}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                  <InputOTPSlot
                    index={4}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                  <InputOTPSlot
                    index={5}
                    className="h-14 flex-1 basis-0 rounded-md border-l text-2xl font-medium"
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <button
            type="button"
            className={buttonVariants({ className: "h-11 w-full md:h-8" })}
            disabled={isVerifying || !isValidOtp(otp)}
            onClick={() => void verifyAccessCode()}
          >
            {isVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify access code
          </button>

          {verifyErrorMessage ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {verifyErrorMessage}
            </p>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <button
              type="button"
              className={buttonVariants({
                variant: "outline",
                className: "h-11 min-w-0 md:h-8",
              })}
              onClick={() => void requestAccessCode(true)}
              disabled={refreshDisabled}
            >
              <RotateCcw
                className={`size-4 ${showRefreshSpinner ? "animate-spin" : ""}`}
              />
              <span className="truncate">
                {remainingSeconds > 0
                  ? `Refresh in ${formatRemaining(remainingSeconds)}`
                  : "Refresh code"}
              </span>
            </button>

            <button
              type="button"
              className={buttonVariants({
                variant: "ghost",
                className: "h-11 shrink-0 px-2 md:h-8",
              })}
              disabled={isRefreshing || isVerifying}
              onClick={handleChangeEmail}
            >
              <ArrowLeft className="size-4" />
              Change email
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
