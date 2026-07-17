import { NextResponse } from "next/server";

import { buildRequestUrl, resolveRequestOrigin } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = await resolveRequestOrigin(request);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/post-auth");

  const errorUrl = await buildRequestUrl("/sign-in?error=google_failed", request);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(errorUrl, {
      status: 303,
    });
  }

  return NextResponse.redirect(data.url, {
    status: 303,
  });
}
