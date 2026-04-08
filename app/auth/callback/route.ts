import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeNextPath(nextValue: string | null): string {
  if (!nextValue) {
    return "/dashboard";
  }

  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) {
    return "/dashboard";
  }

  return nextValue;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=callback_failed", request.url), {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=callback_failed", request.url), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303,
  });
}
