import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function resolveRequestOrigin(request: Request, headerStore: Headers): string {
  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto");

  if (forwardedHost) {
    const protocol = forwardedProto ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_email", request.url), {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const headerStore = await headers();
  const origin = resolveRequestOrigin(request, headerStore);
  const callbackUrl = `${origin}/auth/callback?next=/dashboard`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=otp_failed", request.url), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL("/sign-in?status=check-email", request.url), {
    status: 303,
  });
}
