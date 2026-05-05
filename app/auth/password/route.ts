import { NextResponse } from "next/server";

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

  if (!email) {
    return NextResponse.redirect(await buildRequestUrl("/sign-in?error=missing_email", request), {
      status: 303,
    });
  }

  if (!password) {
    return NextResponse.redirect(
      await buildRequestUrl("/sign-in?error=missing_password", request),
      {
        status: 303,
      },
    );
  }

  const dashboardUrl = await buildRequestUrl("/dashboard", request);
  const passwordErrorUrl = await buildRequestUrl("/sign-in?error=password_failed", request);

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

  return NextResponse.redirect(dashboardUrl, {
    status: 303,
  });
}
