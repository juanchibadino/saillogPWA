import { NextResponse } from "next/server";

import { buildRequestUrl } from "@/lib/http/request-origin";
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
  const callbackErrorUrl = await buildRequestUrl("/sign-in?error=callback_failed", request);

  if (!code) {
    return NextResponse.redirect(callbackErrorUrl, {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(callbackErrorUrl, {
      status: 303,
    });
  }

  const destinationUrl = await buildRequestUrl(nextPath, request);
  return NextResponse.redirect(destinationUrl, {
    status: 303,
  });
}
