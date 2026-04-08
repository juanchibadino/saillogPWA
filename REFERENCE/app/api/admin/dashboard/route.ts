import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { buildDashboardSummary } from "@/lib/dashboard/summary";
import { serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function countByStatus<T extends { status: string }>(rows: T[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();

  const [jobsResult, leadsResult, quotesResult, purchasesResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, status, projected_revenue, projected_total_cost, projected_margin, actual_total_cost, actual_margin, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("leads").select("id, status"),
    supabase.from("quotes").select("id, status"),
    supabase.from("purchases").select("id, status"),
  ]);

  if (jobsResult.error || leadsResult.error || quotesResult.error || purchasesResult.error) {
    return serverError("Failed to load dashboard summary.", {
      jobs: jobsResult.error?.message,
      leads: leadsResult.error?.message,
      quotes: quotesResult.error?.message,
      purchases: purchasesResult.error?.message,
    });
  }

  const jobs = jobsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const quotes = quotesResult.data ?? [];
  const purchases = purchasesResult.data ?? [];

  const summary = buildDashboardSummary(
    jobs.map((job) => ({
      id: job.id,
      status: job.status,
      projectedRevenue: Number(job.projected_revenue),
      projectedTotalCost: Number(job.projected_total_cost),
      projectedMargin: Number(job.projected_margin),
      actualTotalCost:
        job.actual_total_cost === null ? null : Number(job.actual_total_cost),
      actualMargin: job.actual_margin === null ? null : Number(job.actual_margin),
      createdAt: job.created_at,
    })),
  );

  return NextResponse.json({
    counts: {
      leads: leads.length,
      quotes: quotes.length,
      jobs: jobs.length,
      purchases: purchases.length,
    },
    statusCounts: {
      leads: countByStatus(leads),
      quotes: countByStatus(quotes),
      jobs: countByStatus(jobs),
      purchases: countByStatus(purchases),
    },
    totals: summary.totals,
    recentJobs: summary.jobs.slice(0, 8),
  });
}
