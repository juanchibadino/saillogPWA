import { NextResponse } from "next/server";

import {
  appendSafeNextParam,
  normalizeSafeNextPath,
} from "@/lib/auth/safe-next-path.mjs";
import { buildRequestUrl, resolveRequestOrigin } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OtpRequestBody = {
  email?: string;
  next?: string;
};

type OtpRequestResponse =
  | { ok: true }
  | { ok: false; error: "missing_email" | "otp_failed" };

async function getOtpInputFromRequest(request: Request): Promise<{
  email: string;
  nextPath: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as OtpRequestBody;
    return {
      email: typeof body.email === "string" ? body.email.trim() : "",
      nextPath: normalizeSafeNextPath(body.next),
    };
  }

  const formData = await request.formData();
  const emailValue = formData.get("email");
  const nextValue = formData.get("next");

  return {
    email: typeof emailValue === "string" ? emailValue.trim() : "",
    nextPath: normalizeSafeNextPath(
      typeof nextValue === "string" ? nextValue : undefined,
    ),
  };
}

function isJsonRequest(request: Request): boolean {
  const acceptHeader = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return acceptHeader.includes("application/json") || contentType.includes("application/json");
}

export async function POST(request: Request) {
  const { email, nextPath } = await getOtpInputFromRequest(request);

  if (!email) {
    if (isJsonRequest(request)) {
      return NextResponse.json<OtpRequestResponse>(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    return NextResponse.redirect(
      await buildRequestUrl(
        appendSafeNextParam("/sign-in?error=missing_email", nextPath),
        request,
      ),
      {
        status: 303,
      },
    );
  }

  const supabase = await createServerSupabaseClient();
  const origin = await resolveRequestOrigin(request);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (isJsonRequest(request)) {
      return NextResponse.json<OtpRequestResponse>(
        { ok: false, error: "otp_failed" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(
      await buildRequestUrl(
        appendSafeNextParam("/sign-in?error=otp_failed", nextPath),
        request,
      ),
      {
        status: 303,
      },
    );
  }

  if (isJsonRequest(request)) {
    return NextResponse.json<OtpRequestResponse>({ ok: true }, { status: 200 });
  }

  return NextResponse.redirect(
    await buildRequestUrl(
      appendSafeNextParam("/sign-in?status=check-email", nextPath),
      request,
    ),
    {
      status: 303,
    },
  );
}
