import { NextResponse } from "next/server";

import {
  appendSafeNextParam,
  normalizeSafeNextPath,
} from "@/lib/auth/safe-next-path.mjs";
import { buildRequestUrl } from "@/lib/http/request-origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getTrimmedFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = getTrimmedFormValue(formData, "email");
  const password = getTrimmedFormValue(formData, "password");
  const nextPath = normalizeSafeNextPath(getTrimmedFormValue(formData, "next"));

  if (!email) {
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

  if (!password) {
    return NextResponse.redirect(
      await buildRequestUrl(
        appendSafeNextParam("/sign-in?error=missing_password", nextPath),
        request,
      ),
      {
        status: 303,
      },
    );
  }

  const postAuthUrl = await buildRequestUrl(nextPath, request);
  const passwordErrorUrl = await buildRequestUrl(
    appendSafeNextParam("/sign-in?error=password_failed", nextPath),
    request,
  );

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.redirect(passwordErrorUrl, {
      status: 303,
    });
  }

  return NextResponse.redirect(postAuthUrl, {
    status: 303,
  });
}
