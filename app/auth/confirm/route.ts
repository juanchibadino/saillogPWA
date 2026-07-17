import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { buildRequestUrl } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "recovery",
]);

function normalizeNextPath(nextValue: string | null): string {
  if (!nextValue) {
    return "/post-auth";
  }

  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) {
    return "/post-auth";
  }

  return nextValue;
}

function normalizeEmailOtpType(typeValue: string | null): EmailOtpType | null {
  if (!typeValue || !EMAIL_OTP_TYPES.has(typeValue as EmailOtpType)) {
    return null;
  }

  return typeValue as EmailOtpType;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = normalizeEmailOtpType(requestUrl.searchParams.get("type"));
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  const confirmErrorUrl = await buildRequestUrl(
    "/sign-in?error=callback_failed",
    request,
  );

  if (!tokenHash || !type) {
    return NextResponse.redirect(confirmErrorUrl, {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(confirmErrorUrl, {
      status: 303,
    });
  }

  const destinationUrl = await buildRequestUrl(nextPath, request);
  return NextResponse.redirect(destinationUrl, {
    status: 303,
  });
}
