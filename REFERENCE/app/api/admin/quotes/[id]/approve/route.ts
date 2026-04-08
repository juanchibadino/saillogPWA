import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { DEFAULT_JOB_STAGES } from "@/types/domain";
import { sum } from "@/lib/utils/math";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  dueDate: z.string().date().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: quoteId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: quote, error: quoteError }, { data: existingJob, error: existingJobError }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("id, lead_id, status")
        .eq("id", quoteId)
        .single(),
      supabase.from("jobs").select("id").eq("quote_id", quoteId).maybeSingle(),
    ]);

  if (quoteError) {
    if (quoteError.code === "PGRST116") {
      return notFound("Quote not found.");
    }

    return serverError("Failed to load quote.", quoteError.message);
  }

  if (existingJobError) {
    return serverError("Failed to check existing job.", existingJobError.message);
  }

  if (quote.status === "quote_rejected") {
    return badRequest("Cannot approve a rejected quote.");
  }

  if (existingJob) {
    return NextResponse.json({ jobId: existingJob.id, reused: true });
  }

  const { data: quoteItems, error: quoteItemsError } = await supabase
    .from("quote_items")
    .select("id, lead_item_id, frame_catalog_id, unit_price, unit_projected_cost, quantity")
    .eq("quote_id", quoteId);

  if (quoteItemsError) {
    return serverError("Failed to load quote items.", quoteItemsError.message);
  }

  if (!quoteItems || quoteItems.length === 0) {
    return badRequest("Cannot approve a quote without items.");
  }

  const leadItemIds = Array.from(
    new Set(
      quoteItems
        .map((item) => item.lead_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: leadItems, error: leadItemsError } = await supabase
    .from("lead_items")
    .select("id, width_cm, height_cm, required_moulding_cm, required_moulding_m")
    .in("id", leadItemIds);

  if (leadItemsError) {
    return serverError("Failed to load approval dependencies.", {
      leadItems: leadItemsError.message,
    });
  }

  const leadItemMap = new Map((leadItems ?? []).map((item) => [item.id, item]));

  for (const item of quoteItems) {
    if (!item.lead_item_id || !leadItemMap.has(item.lead_item_id)) {
      return badRequest(`Quote item ${item.id} has no valid lead dimensions.`);
    }

    if (!item.frame_catalog_id) {
      return badRequest(`Quote item ${item.id} has no curated frame selected.`);
    }
  }

  const projectedRevenue = sum(
    quoteItems.map((item) => Number(item.unit_price) * Number(item.quantity)),
  );
  const projectedTotalCost = sum(
    quoteItems.map((item) => Number(item.unit_projected_cost) * Number(item.quantity)),
  );
  const projectedMargin = projectedRevenue - projectedTotalCost;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      quote_id: quoteId,
      due_date: parsed.data.dueDate ?? null,
      status: "purchase_pending",
      projected_revenue: projectedRevenue,
      projected_total_cost: projectedTotalCost,
      projected_margin: projectedMargin,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return serverError("Failed to create job.", jobError?.message);
  }

  const { data: insertedJobItems, error: jobItemsError } = await supabase
    .from("job_items")
    .insert(
      quoteItems.map((item) => {
        const leadItem = leadItemMap.get(item.lead_item_id as string)!;
        const lineProjectedCost = Number(item.unit_projected_cost) * Number(item.quantity);

        return {
          job_id: job.id,
          quote_item_id: item.id,
          width_cm: Number(leadItem.width_cm),
          height_cm: Number(leadItem.height_cm),
          frame_catalog_id: item.frame_catalog_id,
          quantity: Number(item.quantity),
          required_moulding_cm: Number(leadItem.required_moulding_cm),
          required_moulding_m: Number(leadItem.required_moulding_m),
          projected_cost: lineProjectedCost,
        };
      }),
    )
    .select("id, quote_item_id");

  if (jobItemsError) {
    return serverError("Job created but failed to create job items.", jobItemsError.message);
  }

  const { error: jobStagesError } = await supabase.from("job_stages").insert(
    DEFAULT_JOB_STAGES.map((stageName) => ({
      job_id: job.id,
      stage_name: stageName,
      status: "pending",
      estimated_minutes: null,
      actual_minutes: null,
    })),
  );

  if (jobStagesError) {
    return serverError("Job created but failed to initialize job stages.", jobStagesError.message);
  }

  const { error: jobSnapshotError } = await supabase.from("cost_snapshots").insert({
    reference_type: "job",
    reference_id: job.id,
    material_cost: projectedTotalCost,
    labor_cost: 0,
    total_cost: projectedTotalCost,
    price: projectedRevenue,
    margin: projectedMargin,
    metadata: { source: "quote_approval" },
  });

  if (jobSnapshotError) {
    return serverError("Job created but failed to save projected cost snapshot.", jobSnapshotError.message);
  }

  const quoteItemMap = new Map(quoteItems.map((item) => [item.id, item]));

  const { error: itemSnapshotsError } = await supabase.from("cost_snapshots").insert(
    (insertedJobItems ?? []).map((jobItem) => {
      const quoteItem = quoteItemMap.get(jobItem.quote_item_id as string)!;
      const price = Number(quoteItem.unit_price) * Number(quoteItem.quantity);
      const totalCost = Number(quoteItem.unit_projected_cost) * Number(quoteItem.quantity);

      return {
        reference_type: "job_item",
        reference_id: jobItem.id,
        material_cost: totalCost,
        labor_cost: 0,
        total_cost: totalCost,
        price,
        margin: price - totalCost,
        metadata: { source: "quote_approval" },
      };
    }),
  );

  if (itemSnapshotsError) {
    return serverError(
      "Job created but failed to save projected cost snapshots for items.",
      itemSnapshotsError.message,
    );
  }

  const [{ error: quoteUpdateError }, { error: leadUpdateError }] = await Promise.all([
    supabase
      .from("quotes")
      .update({ status: "quote_approved", approved_at: new Date().toISOString() })
      .eq("id", quoteId),
    supabase
      .from("leads")
      .update({ status: "quote_approved" })
      .eq("id", quote.lead_id),
  ]);

  if (quoteUpdateError || leadUpdateError) {
    return serverError("Job created but failed to finalize quote/lead status.", {
      quote: quoteUpdateError?.message,
      lead: leadUpdateError?.message,
    });
  }

  return NextResponse.json({
    jobId: job.id,
    reused: false,
    hasShortage: false,
    shortages: [],
  });
}
