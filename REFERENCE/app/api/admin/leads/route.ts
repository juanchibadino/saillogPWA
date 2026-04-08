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
    .from("leads")
    .select("id, created_at, customer_name, customer_phone, customer_email, status, preliminary_total, lead_items(id)")
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to load leads.", error.message);
  }

  return NextResponse.json(
    (data ?? []).map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      customerName: lead.customer_name,
      customerPhone: lead.customer_phone,
      customerEmail: lead.customer_email,
      status: lead.status,
      preliminaryTotal: Number(lead.preliminary_total),
      itemCount: lead.lead_items?.length ?? 0,
    })),
  );
}
