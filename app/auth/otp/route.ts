import { NextResponse } from "next/server";

import { buildRequestUrl, resolveRequestOrigin } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OtpRequestBody = {
  email?: string;
};

type OtpRequestResponse =
  | { ok: true }
  | { ok: false; error: "missing_email" | "otp_failed" };

async function getEmailFromRequest(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as OtpRequestBody;
    return typeof body.email === "string" ? body.email.trim() : "";
  }

  const formData = await request.formData();
  const emailValue = formData.get("email");
  return typeof emailValue === "string" ? emailValue.trim() : "";
}

function isJsonRequest(request: Request): boolean {
  const acceptHeader = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return acceptHeader.includes("application/json") || contentType.includes("application/json");
}

export async function POST(request: Request) {
  const email = await getEmailFromRequest(request);

  if (!email) {
    if (isJsonRequest(request)) {
      return NextResponse.json<OtpRequestResponse>(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    return NextResponse.redirect(await buildRequestUrl("/sign-in?error=missing_email", request), {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const origin = await resolveRequestOrigin(request);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/post-auth");

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

    return NextResponse.redirect(await buildRequestUrl("/sign-in?error=otp_failed", request), {
      status: 303,
    });
  }

  if (isJsonRequest(request)) {
    return NextResponse.json<OtpRequestResponse>({ ok: true }, { status: 200 });
  }

  return NextResponse.redirect(await buildRequestUrl("/sign-in?status=check-email", request), {
    status: 303,
  });
}
