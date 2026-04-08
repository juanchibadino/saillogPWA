import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  catalogItemId: z.string().uuid(),
  quantityDelta: z.number().refine((value) => value !== 0, {
    message: "quantityDelta must be different from 0.",
  }),
  unitCost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

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

  const { data: catalogItem, error: catalogItemError } = await supabase
    .from("catalog_items")
    .select("id, active")
    .eq("id", parsed.data.catalogItemId)
    .single();

  if (catalogItemError || !catalogItem) {
    return badRequest("Catalog item not found.");
  }

  if (!catalogItem.active) {
    return badRequest("Cannot adjust stock for an inactive catalog item.");
  }

  const { data: balanceRow, error: balanceError } = await supabase
    .from("stock_balances")
    .select("catalog_item_id, on_hand_quantity")
    .eq("catalog_item_id", parsed.data.catalogItemId)
    .maybeSingle();

  if (balanceError) {
    return serverError("Failed to load current stock balance.", balanceError.message);
  }

  const current = Number(balanceRow?.on_hand_quantity ?? 0);
  const quantityDelta = round4(parsed.data.quantityDelta);
  const next = round4(current + quantityDelta);

  if (next < 0) {
    return badRequest("Stock adjustment would leave negative balance.", {
      current,
      quantityDelta,
      next,
    });
  }

  const totalCost =
    parsed.data.unitCost === undefined || parsed.data.unitCost === null
      ? null
      : round2(parsed.data.unitCost * Math.abs(quantityDelta));

  const { error: movementError } = await supabase.from("stock_movements").insert({
    catalog_item_id: parsed.data.catalogItemId,
    movement_type: parsed.data.quantityDelta > 0 ? "manual_adjustment" : "manual_reversal",
    quantity_delta: quantityDelta,
    unit_cost: parsed.data.unitCost ?? null,
    total_cost: totalCost,
    notes: parsed.data.notes ?? "Ajuste manual de stock",
    occurred_at: new Date().toISOString(),
  });

  if (movementError) {
    return serverError("Failed to create stock movement.", movementError.message);
  }

  const { error: upsertError } = await supabase.from("stock_balances").upsert(
    {
      catalog_item_id: parsed.data.catalogItemId,
      on_hand_quantity: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "catalog_item_id" },
  );

  if (upsertError) {
    return serverError("Stock movement created but failed to update stock balance.", upsertError.message);
  }

  return NextResponse.json({
    success: true,
    catalogItemId: parsed.data.catalogItemId,
    previousQuantity: current,
    quantityDelta,
    currentQuantity: next,
  });
}
