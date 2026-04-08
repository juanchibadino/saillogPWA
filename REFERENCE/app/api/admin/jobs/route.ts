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

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(
      "id, quote_id, status, projected_revenue, projected_total_cost, projected_margin, actual_total_cost, actual_margin, created_at, due_date",
    )
    .order("created_at", { ascending: false });

  if (jobsError) {
    return serverError("Failed to load jobs.", jobsError.message);
  }

  const quoteIds = Array.from(new Set((jobs ?? []).map((job) => job.quote_id)));

  const { data: quotes, error: quotesError } =
    quoteIds.length > 0
      ? await supabase
          .from("quotes")
          .select("id, lead_id")
          .in("id", quoteIds)
      : { data: [], error: null };

  if (quotesError) {
    return serverError("Failed to load job quote references.", quotesError.message);
  }

  const leadIds = Array.from(
    new Set((quotes ?? []).map((quote) => quote.lead_id).filter(Boolean)),
  );

  const { data: leads, error: leadsError } =
    leadIds.length > 0
      ? await supabase
          .from("leads")
          .select("id, customer_name")
          .in("id", leadIds)
      : { data: [], error: null };

  if (leadsError) {
    return serverError("Failed to load job customer references.", leadsError.message);
  }

  const quoteMap = new Map((quotes ?? []).map((quote) => [quote.id, quote]));
  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead]));

  return NextResponse.json(
    (jobs ?? []).map((job) => {
      const quote = quoteMap.get(job.quote_id);
      const lead = quote ? leadMap.get(quote.lead_id) : null;

      return {
        id: job.id,
        quoteId: job.quote_id,
        status: job.status,
        projectedRevenue: Number(job.projected_revenue),
        projectedTotalCost: Number(job.projected_total_cost),
        projectedMargin: Number(job.projected_margin),
        actualTotalCost:
          job.actual_total_cost === null ? null : Number(job.actual_total_cost),
        actualMargin: job.actual_margin === null ? null : Number(job.actual_margin),
        dueDate: job.due_date,
        createdAt: job.created_at,
        customerName: lead?.customer_name ?? null,
      };
    }),
  );
}
