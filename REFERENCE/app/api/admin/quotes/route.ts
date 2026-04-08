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
    .from("quotes")
    .select(
      "id, lead_id, status, subtotal, total, created_at, approved_at, leads(customer_name), quote_items(id)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to load quotes.", error.message);
  }

  return NextResponse.json(
    (data ?? []).map((quote) => {
      const lead = Array.isArray(quote.leads) ? quote.leads[0] : quote.leads;

      return {
        id: quote.id,
        leadId: quote.lead_id,
        status: quote.status,
        subtotal: Number(quote.subtotal),
        total: Number(quote.total),
        createdAt: quote.created_at,
        approvedAt: quote.approved_at,
        customerName: lead?.customer_name ?? null,
        itemCount: quote.quote_items?.length ?? 0,
      };
    }),
  );
}
