import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, code, name, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    return serverError("Failed to load suppliers.", error.message);
  }

  return NextResponse.json(
    (data ?? []).map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      active: supplier.active,
    })),
  );
}
