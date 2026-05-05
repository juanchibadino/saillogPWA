import { NextResponse } from "next/server";

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
    return NextResponse.redirect(new URL("/sign-in?error=missing_email", request.url), {
      status: 303,
    });
  }

  if (!password) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_password", request.url), {
      status: 303,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=password_failed", request.url), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), {
    status: 303,
  });
}
