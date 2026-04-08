import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/utils/math";

const TAX_MODES = ["without_vat", "with_vat"] as const;

const patchSchema = z
  .object({
    status: z.enum(["draft", "ordered", "received", "cancelled"]).optional(),
    orderedAt: z.string().datetime().nullable().optional(),
    receivedAt: z.string().datetime().nullable().optional(),
    totalCost: z.number().nonnegative().optional(),
    notes: z.string().max(1000).nullable().optional(),
    taxMode: z.enum(TAX_MODES).optional(),
    vatRate: z.number().min(0).max(1).optional(),
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.orderedAt !== undefined ||
      payload.receivedAt !== undefined ||
      payload.totalCost !== undefined ||
      payload.notes !== undefined ||
      payload.taxMode !== undefined ||
      payload.vatRate !== undefined,
    { message: "At least one editable field is required." },
  );

function computeVatAmount(subtotalNet: number, taxMode: (typeof TAX_MODES)[number], vatRate: number) {
  return taxMode === "with_vat" ? round2(subtotalNet * vatRate) : 0;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("id, status, job_id, received_at, tax_mode, vat_rate, subtotal_net, total_cost")
    .eq("id", id)
    .single();

  if (purchaseError || !purchase) {
    if (purchaseError?.code === "PGRST116") {
      return notFound("Purchase not found.");
    }

    return serverError("Failed to load purchase.", purchaseError?.message);
  }

  const nextStatus = parsed.data.status ?? purchase.status;

  if (purchase.status === "received" && nextStatus !== "received") {
    return badRequest("Cannot revert a received purchase to another status.");
  }

  const updates: {
    status?: "draft" | "ordered" | "received" | "cancelled";
    ordered_at?: string | null;
    received_at?: string | null;
    total_cost?: number;
    subtotal_net?: number;
    vat_amount?: number;
    total_gross?: number;
    tax_mode?: "without_vat" | "with_vat";
    vat_rate?: number;
    notes?: string | null;
  } = {};

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  if (parsed.data.orderedAt !== undefined) {
    updates.ordered_at = parsed.data.orderedAt;
  }

  if (parsed.data.receivedAt !== undefined) {
    updates.received_at = parsed.data.receivedAt;
  } else if (nextStatus === "received" && purchase.received_at === null) {
    updates.received_at = new Date().toISOString();
  }

  const hasTaxInput = parsed.data.taxMode !== undefined || parsed.data.vatRate !== undefined;
  const hasSubtotalInput = parsed.data.totalCost !== undefined;

  if (hasTaxInput || hasSubtotalInput) {
    const subtotalNet = round2(
      parsed.data.totalCost ??
        (purchase.subtotal_net === null || purchase.subtotal_net === undefined
          ? Number(purchase.total_cost)
          : Number(purchase.subtotal_net)),
    );
    const taxMode = (parsed.data.taxMode ?? purchase.tax_mode ?? "without_vat") as
      | "without_vat"
      | "with_vat";
    const vatRate = parsed.data.vatRate ?? Number(purchase.vat_rate ?? 0.21);
    const vatAmount = computeVatAmount(subtotalNet, taxMode, vatRate);
    const totalGross = round2(subtotalNet + vatAmount);

    updates.total_cost = subtotalNet;
    updates.subtotal_net = subtotalNet;
    updates.tax_mode = taxMode;
    updates.vat_rate = vatRate;
    updates.vat_amount = vatAmount;
    updates.total_gross = totalGross;
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("purchases")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return serverError("Failed to update purchase.", updateError.message);
    }
  }

  if (nextStatus === "received") {
    const { error: effectsError } = await supabase.rpc("apply_purchase_received_effects", {
      p_purchase_id: id,
    });

    if (effectsError) {
      return serverError(
        "Purchase updated but failed to apply stock/cost effects.",
        effectsError.message,
      );
    }
  }

  if (purchase.job_id) {
    const { error: jobError } = await supabase
      .from("jobs")
      .update({ status: nextStatus === "cancelled" ? "purchase_pending" : "ready_for_production" })
      .eq("id", purchase.job_id);

    if (jobError) {
      return serverError("Purchase updated but failed to update job status.", jobError.message);
    }
  }

  return NextResponse.json({
    success: true,
    purchaseId: id,
    status: nextStatus,
  });
}
