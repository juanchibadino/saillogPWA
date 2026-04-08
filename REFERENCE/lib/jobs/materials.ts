import type { SupabaseClient } from "@supabase/supabase-js";

type JobMaterialRequirement = {
  jobItemId: string;
  profileId: string;
  widthCm: number;
  heightCm: number;
  quantity: number;
};

type ProfileCostRef = {
  purchaseUnitLengthCm: number;
  costPerUnit: number;
  supplierName: string;
};

type ShortagePlan = {
  profileId: string;
  shortageCm: number;
  barsNeeded: number;
  unitCost: number;
  totalCost: number;
  supplierName: string;
};

export async function allocateMaterialsForJob(
  _supabase: SupabaseClient,
  _requirements: JobMaterialRequirement[],
  _profileCostMap: Record<string, ProfileCostRef>,
): Promise<{ hasShortage: boolean; shortages: ShortagePlan[] }> {
  void _supabase;
  void _requirements;
  void _profileCostMap;

  throw new Error(
    "Legacy stock_lots/stock_remnants flow is deprecated. Use /api/admin/jobs/[id]/materials/consume with catalog_items stock.",
  );
}
