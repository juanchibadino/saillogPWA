import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/client";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function normalizeEmailList(raw?: string) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminAuth(
  request: Request,
): Promise<NextResponse | null> {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = request.headers.get("x-admin-key");

  if (expectedKey && providedKey === expectedKey) {
    return null;
  }

  const authorization = request.headers.get("authorization");
  const token =
    authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;

  if (!token) {
    return unauthorizedResponse();
  }

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return unauthorizedResponse();
  }

  const allowlist = normalizeEmailList(process.env.ADMIN_EMAIL_ALLOWLIST);

  if (allowlist.length > 0) {
    const email = data.user.email?.toLowerCase();

    if (!email || !allowlist.includes(email)) {
      return forbiddenResponse();
    }
  }

  return null;
}
