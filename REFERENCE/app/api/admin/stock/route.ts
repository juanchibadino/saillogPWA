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

  const [itemsResult, movementsResult] = await Promise.all([
    supabase
      .from("catalog_items")
      .select(
        "id, kind, unit, display_name, active, catalog_frame_id, glass_type_id, matboard_type_id, stock_balances(on_hand_quantity, updated_at), catalog_item_cost_metrics(suggested_cost_per_unit, last_received_cost_per_unit, reference_cost_per_unit, deviation_vs_reference_pct, purchase_count_window, updated_at)",
      )
      .order("display_name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select(
        "id, catalog_item_id, movement_type, quantity_delta, unit_cost, total_cost, purchase_id, purchase_item_id, job_id, notes, occurred_at, catalog_items(display_name, unit, kind), purchases(id, supplier_name, status, total_cost, total_gross), jobs(id, status)",
      )
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);

  if (itemsResult.error || movementsResult.error) {
    return serverError("Failed to load stock data.", {
      items: itemsResult.error?.message,
      movements: movementsResult.error?.message,
    });
  }

  return NextResponse.json({
    items: (itemsResult.data ?? []).map((row) => {
      const balance = Array.isArray(row.stock_balances)
        ? row.stock_balances[0]
        : row.stock_balances;
      const metrics = Array.isArray(row.catalog_item_cost_metrics)
        ? row.catalog_item_cost_metrics[0]
        : row.catalog_item_cost_metrics;

      const referenceCostPerUnit =
        metrics?.reference_cost_per_unit === null || metrics?.reference_cost_per_unit === undefined
          ? 0
          : Number(metrics.reference_cost_per_unit);
      const suggestedCostPerUnit =
        metrics?.suggested_cost_per_unit === null || metrics?.suggested_cost_per_unit === undefined
          ? referenceCostPerUnit
          : Number(metrics.suggested_cost_per_unit);

      return {
        id: row.id,
        kind: row.kind,
        unit: row.unit,
        displayName: row.display_name,
        active: row.active,
        catalogFrameId: row.catalog_frame_id,
        glassTypeId: row.glass_type_id,
        matboardTypeId: row.matboard_type_id,
        onHandQuantity: Number(balance?.on_hand_quantity ?? 0),
        updatedAt: balance?.updated_at ?? null,
        suggestedCostPerUnit,
        lastReceivedCostPerUnit:
          metrics?.last_received_cost_per_unit === null ||
          metrics?.last_received_cost_per_unit === undefined
            ? null
            : Number(metrics.last_received_cost_per_unit),
        referenceCostPerUnit,
        deviationVsReferencePct:
          metrics?.deviation_vs_reference_pct === null ||
          metrics?.deviation_vs_reference_pct === undefined
            ? 0
            : Number(metrics.deviation_vs_reference_pct),
        purchaseCountWindow: Number(metrics?.purchase_count_window ?? 0),
      };
    }),
    movements: (movementsResult.data ?? []).map((row) => {
      const catalogItem = Array.isArray(row.catalog_items)
        ? row.catalog_items[0]
        : row.catalog_items;
      const purchase = Array.isArray(row.purchases)
        ? row.purchases[0]
        : row.purchases;
      const job = Array.isArray(row.jobs)
        ? row.jobs[0]
        : row.jobs;

      return {
        id: row.id,
        catalogItemId: row.catalog_item_id,
        catalogItemName: catalogItem?.display_name ?? null,
        catalogItemKind: catalogItem?.kind ?? null,
        catalogItemUnit: catalogItem?.unit ?? null,
        movementType: row.movement_type,
        quantityDelta: Number(row.quantity_delta),
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        totalCost: row.total_cost === null ? null : Number(row.total_cost),
        purchaseId: row.purchase_id,
        purchaseSupplierName: purchase?.supplier_name ?? null,
        purchaseStatus: purchase?.status ?? null,
        purchaseTotalCost:
          purchase?.total_cost === null || purchase?.total_cost === undefined
            ? null
            : Number(purchase.total_cost),
        purchaseTotalGross:
          purchase?.total_gross === null || purchase?.total_gross === undefined
            ? null
            : Number(purchase.total_gross),
        purchaseItemId: row.purchase_item_id,
        jobId: row.job_id,
        jobStatus: job?.status ?? null,
        notes: row.notes,
        occurredAt: row.occurred_at,
      };
    }),
  });
}
