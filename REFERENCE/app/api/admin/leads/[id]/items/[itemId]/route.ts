import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/utils/math";

const schema = z.object({
  laborCost: z.number().nonnegative(),
});

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: leadId, itemId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: lead, error: leadError }, { data: leadItem, error: leadItemError }] =
    await Promise.all([
      supabase.from("leads").select("id").eq("id", leadId).maybeSingle(),
      supabase
        .from("lead_items")
        .select(
          "id, lead_id, frame_cost, glass_cost, matboard_cost, labor_cost, projected_cost, preliminary_price",
        )
        .eq("id", itemId)
        .eq("lead_id", leadId)
        .maybeSingle(),
    ]);

  if (leadError) {
    return serverError("Failed to load lead.", leadError.message);
  }

  if (!lead) {
    return notFound("Lead not found.");
  }

  if (leadItemError) {
    return serverError("Failed to load lead item.", leadItemError.message);
  }

  if (!leadItem) {
    return notFound("Lead item not found in this lead.");
  }

  const nextLaborCost = round2(parsed.data.laborCost);
  const previousLaborCost = toNumber(leadItem.labor_cost) ?? 0;
  const componentSnapshotCost =
    (toNumber(leadItem.frame_cost) ?? 0) +
    (toNumber(leadItem.glass_cost) ?? 0) +
    (toNumber(leadItem.matboard_cost) ?? 0);
  const fallbackBaseCost = Math.max((toNumber(leadItem.projected_cost) ?? 0) - previousLaborCost, 0);
  const baseCost =
    leadItem.frame_cost === null ||
    leadItem.glass_cost === null ||
    leadItem.matboard_cost === null
      ? fallbackBaseCost
      : componentSnapshotCost;
  const nextProjectedCost = round2(baseCost + nextLaborCost);
  const nextPreliminaryPrice = nextProjectedCost;

  const { error: updateError } = await supabase
    .from("lead_items")
    .update({
      labor_cost: nextLaborCost,
      projected_cost: nextProjectedCost,
      preliminary_price: nextPreliminaryPrice,
    })
    .eq("id", itemId)
    .eq("lead_id", leadId);

  if (updateError) {
    return serverError("Failed to update lead item labor cost.", updateError.message);
  }

  const { data: leadItems, error: itemsError } = await supabase
    .from("lead_items")
    .select("preliminary_price")
    .eq("lead_id", leadId);

  if (itemsError) {
    return serverError(
      "Lead item updated but failed to recalculate lead total.",
      itemsError.message,
    );
  }

  const nextLeadPreliminaryTotal = round2(
    (leadItems ?? []).reduce(
      (total, item) => total + (toNumber(item.preliminary_price) ?? 0),
      0,
    ),
  );

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({ preliminary_total: nextLeadPreliminaryTotal })
    .eq("id", leadId);

  if (leadUpdateError) {
    return serverError(
      "Lead item updated but failed to persist lead total.",
      leadUpdateError.message,
    );
  }

  return NextResponse.json({
    success: true,
    leadId,
    leadItemId: itemId,
    laborCost: nextLaborCost,
    projectedCost: nextProjectedCost,
    preliminaryPrice: nextPreliminaryPrice,
    leadPreliminaryTotal: nextLeadPreliminaryTotal,
  });
}
