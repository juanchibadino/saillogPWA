import { NextResponse } from "next/server";

import { buildRequestUrl } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 6;

function getTrimmedFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function buildSetPasswordRedirect(
  request: Request,
  params: Record<string, string>,
) {
  const nextUrl = await buildRequestUrl("/set-password", request);

  Object.entries(params).forEach(([key, value]) => {
    nextUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(nextUrl, { status: 303 });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(await buildRequestUrl("/sign-in", request), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const password = getTrimmedFormValue(formData, "password");
  const confirmPassword = getTrimmedFormValue(formData, "confirmPassword");

  if (!password) {
    return await buildSetPasswordRedirect(request, { error: "missing_password" });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return await buildSetPasswordRedirect(request, { error: "password_too_short" });
  }

  if (password !== confirmPassword) {
    return await buildSetPasswordRedirect(request, { error: "password_mismatch" });
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return await buildSetPasswordRedirect(request, { error: "update_failed" });
  }

  return await buildSetPasswordRedirect(request, { status: "updated" });
}
