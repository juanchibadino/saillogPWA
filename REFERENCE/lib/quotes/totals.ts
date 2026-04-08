import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/utils/math";

export async function recalculateQuoteTotals(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<{ subtotal: number; total: number }> {
  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("unit_price, quantity")
    .eq("quote_id", quoteId);

  if (itemsError) {
    throw new Error(`Failed to load quote items: ${itemsError.message}`);
  }

  const subtotal = round2(
    (items ?? []).reduce((acc, item) => {
      return acc + Number(item.unit_price) * Number(item.quantity);
    }, 0),
  );

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ subtotal, total: subtotal })
    .eq("id", quoteId);

  if (updateError) {
    throw new Error(`Failed to update quote totals: ${updateError.message}`);
  }

  return { subtotal, total: subtotal };
}
