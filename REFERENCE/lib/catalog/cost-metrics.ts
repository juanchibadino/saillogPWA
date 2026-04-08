import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncFrameReferenceCostMetric(
  supabase: SupabaseClient,
  frameId: string,
  referenceCostPerMeter: number,
) {
  const { data: catalogItem, error: catalogItemError } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("catalog_frame_id", frameId)
    .single();

  if (catalogItemError || !catalogItem) {
    throw new Error(
      `Failed to resolve catalog item for frame ${frameId}: ${catalogItemError?.message ?? "missing row"}`,
    );
  }

  const { error: upsertError } = await supabase
    .from("catalog_item_cost_metrics")
    .upsert(
      {
        catalog_item_id: catalogItem.id,
        reference_cost_per_unit: referenceCostPerMeter,
      },
      { onConflict: "catalog_item_id" },
    );

  if (upsertError) {
    throw new Error(
      `Failed to upsert cost metrics for frame ${frameId}: ${upsertError.message}`,
    );
  }

  const { error: recomputeError } = await supabase.rpc(
    "recompute_catalog_item_cost_metric",
    {
      p_catalog_item_id: catalogItem.id,
    },
  );

  if (recomputeError) {
    throw new Error(
      `Failed to recompute cost metrics for frame ${frameId}: ${recomputeError.message}`,
    );
  }
}
