import { NextResponse } from "next/server";

import { buildRequestUrl, resolveRequestOrigin } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email) {
    return NextResponse.redirect(await buildRequestUrl("/sign-in?error=missing_email", request), {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const origin = await resolveRequestOrigin(request);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/dashboard");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return NextResponse.redirect(await buildRequestUrl("/sign-in?error=otp_failed", request), {
      status: 303,
    });
  }

  return NextResponse.redirect(await buildRequestUrl("/sign-in?status=check-email", request), {
    status: 303,
  });
}
