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
    .from("catalog_items")
    .select("id, kind, unit, display_name, stock_balances(on_hand_quantity, updated_at)")
    .order("display_name", { ascending: true });

  if (error) {
    return serverError("Failed to load stock availability.", error.message);
  }

  return NextResponse.json({
    items: (data ?? []).map((row) => {
      const balance = Array.isArray(row.stock_balances)
        ? row.stock_balances[0]
        : row.stock_balances;

      return {
        catalogItemId: row.id,
        name: row.display_name,
        kind: row.kind,
        unit: row.unit,
        onHandQuantity: Number(balance?.on_hand_quantity ?? 0),
        updatedAt: balance?.updated_at ?? null,
      };
    }),
  });
}
