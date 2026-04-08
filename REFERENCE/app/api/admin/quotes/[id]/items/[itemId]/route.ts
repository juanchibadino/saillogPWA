import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { recalculateQuoteTotals } from "@/lib/quotes/totals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/utils/math";

const schema = z
  .object({
    unitPrice: z.number().nonnegative().optional(),
    unitProjectedCost: z.number().nonnegative().optional(),
  })
  .refine(
    (payload) =>
      payload.unitPrice !== undefined || payload.unitProjectedCost !== undefined,
    { message: "At least one editable field is required." },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: quoteId, itemId } = await context.params;

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

  const [{ data: quote, error: quoteError }, { data: quoteItem, error: quoteItemError }] =
    await Promise.all([
      supabase.from("quotes").select("id, status").eq("id", quoteId).single(),
      supabase
        .from("quote_items")
        .select("id, quote_id, unit_price, unit_projected_cost")
        .eq("id", itemId)
        .eq("quote_id", quoteId)
        .single(),
    ]);

  if (quoteError) {
    if (quoteError.code === "PGRST116") {
      return notFound("Quote not found.");
    }

    return serverError("Failed to load quote.", quoteError.message);
  }

  if (quoteItemError) {
    if (quoteItemError.code === "PGRST116") {
      return notFound("Quote item not found in this quote.");
    }

    return serverError("Failed to load quote item.", quoteItemError.message);
  }

  if (quote.status === "quote_approved" || quote.status === "quote_rejected") {
    return badRequest("Cannot edit pricing for a finalized quote.");
  }

  const unitPrice = parsed.data.unitPrice ?? Number(quoteItem.unit_price);
  const unitProjectedCost =
    parsed.data.unitProjectedCost ?? Number(quoteItem.unit_projected_cost);
  const unitProjectedMargin = round2(unitPrice - unitProjectedCost);

  const { error: updateError } = await supabase
    .from("quote_items")
    .update({
      unit_price: unitPrice,
      unit_projected_cost: unitProjectedCost,
      unit_projected_margin: unitProjectedMargin,
    })
    .eq("id", itemId)
    .eq("quote_id", quoteId);

  if (updateError) {
    return serverError("Failed to update quote item pricing.", updateError.message);
  }

  try {
    const totals = await recalculateQuoteTotals(supabase, quoteId);

    return NextResponse.json({
      success: true,
      quoteId,
      quoteItemId: itemId,
      totals,
      unitPrice,
      unitProjectedCost,
      unitProjectedMargin,
    });
  } catch (error) {
    return serverError("Pricing updated but failed to recalculate quote totals.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
