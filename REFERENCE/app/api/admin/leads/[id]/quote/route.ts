import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recalculateQuoteTotals } from "@/lib/quotes/totals";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: leadId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: existingQuote, error: existingQuoteError } = await supabase
    .from("quotes")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existingQuoteError) {
    return serverError("Failed to check existing quote.", existingQuoteError.message);
  }

  if (existingQuote) {
    return NextResponse.json({ quoteId: existingQuote.id, reused: true });
  }

  const [{ data: lead, error: leadError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .single(),
      supabase
        .from("lead_items")
        .select("id, frame_catalog_id, preliminary_price, projected_cost, quantity")
        .eq("lead_id", leadId),
    ]);

  if (leadError) {
    if (leadError.code === "PGRST116") {
      return notFound("Lead not found.");
    }

    return serverError("Failed to load lead.", leadError.message);
  }

  if (itemsError) {
    return serverError("Failed to load lead items.", itemsError.message);
  }

  if (!items || items.length === 0) {
    return serverError("Lead has no items to quote.");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: lead.id,
      status: "quote_reviewed",
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return serverError("Failed to create quote.", quoteError?.message);
  }

  const { error: quoteItemsError } = await supabase.from("quote_items").insert(
    items.map((item) => {
      const linePrice = Number(item.preliminary_price);
      const lineCost = Number(item.projected_cost);
      const quantity = Number(item.quantity);
      const unitPrice = quantity > 0 ? linePrice / quantity : 0;
      const unitProjectedCost = quantity > 0 ? lineCost / quantity : 0;

      return {
        quote_id: quote.id,
        lead_item_id: item.id,
        frame_catalog_id: item.frame_catalog_id,
        unit_price: unitPrice,
        unit_projected_cost: unitProjectedCost,
        unit_projected_margin: unitPrice - unitProjectedCost,
        quantity,
      };
    }),
  );

  if (quoteItemsError) {
    return serverError("Quote created but failed to create quote items.", quoteItemsError.message);
  }

  try {
    await recalculateQuoteTotals(supabase, quote.id);
  } catch (error) {
    return serverError("Quote created but failed to recalculate totals.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const { error: leadStatusError } = await supabase
    .from("leads")
    .update({ status: "quote_reviewed" })
    .eq("id", leadId);

  if (leadStatusError) {
    return serverError("Quote created but failed to update lead status.", leadStatusError.message);
  }

  return NextResponse.json({ quoteId: quote.id, reused: false });
}
