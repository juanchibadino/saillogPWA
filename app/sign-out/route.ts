import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

async function signOutAndRedirect(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/sign-in", request.url), {
    status: 303,
  });
}

export async function POST(request: Request) {
  return signOutAndRedirect(request);
}

export async function GET(request: Request) {
  return signOutAndRedirect(request);
}
