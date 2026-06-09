import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type OtpVerifyBody = {
  email?: string;
  token?: string;
};

type OtpVerifyResponse =
  | { ok: true }
  | {
      ok: false;
      error:
        | "missing_email"
        | "missing_token"
        | "invalid_code"
        | "expired_code";
    };

type OtpVerifyError =
  | "missing_email"
  | "missing_token"
  | "invalid_code"
  | "expired_code";

function mapOtpVerifyError(message = ""): OtpVerifyError {
  const lower = message.toLowerCase();

  if (lower.includes("expired") || lower.includes("expiry")) {
    return "expired_code";
  }

  return "invalid_code";
}

async function getBody(request: Request): Promise<OtpVerifyBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as OtpVerifyBody;
    return {
      email: typeof body.email === "string" ? body.email.trim() : "",
      token: typeof body.token === "string" ? body.token.trim() : "",
    };
  }

  const formData = await request.formData();
  return {
    email: typeof formData.get("email") === "string"
      ? (formData.get("email") as string).trim()
      : "",
    token: typeof formData.get("token") === "string"
      ? (formData.get("token") as string).trim()
      : "",
  };
}

export async function POST(request: Request) {
  const { email = "", token = "" } = await getBody(request);

  if (!email) {
    return NextResponse.json<OtpVerifyResponse>(
      { ok: false, error: "missing_email" },
      { status: 400 },
    );
  }

  if (!token) {
    return NextResponse.json<OtpVerifyResponse>(
      { ok: false, error: "missing_token" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return NextResponse.json<OtpVerifyResponse>(
      { ok: false, error: mapOtpVerifyError(error.message) },
      { status: 401 },
    );
  }

  return NextResponse.json<OtpVerifyResponse>({ ok: true }, { status: 200 });
}
