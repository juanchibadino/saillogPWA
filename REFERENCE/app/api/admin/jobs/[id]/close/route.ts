import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import {
  buildJobCloseTotals,
  validateJobForClosure,
} from "@/lib/jobs/close-job";
import {
  buildJobItemMaterials,
  summarizeJobMaterialUsage,
  type JobLeadItemMaterialContext,
  type JobMaterialUsageMovement,
  type MaterialCatalogItemProjection,
} from "@/lib/jobs/material-breakdown";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/utils/math";

type CatalogItemRow = {
  id: string;
  kind: "frame" | "glass" | "matboard";
  unit: "m" | "m2";
  display_name: string;
  catalog_frame_id: string | null;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  stock_balances:
    | { on_hand_quantity: number | string | null }
    | Array<{ on_hand_quantity: number | string | null }>
    | null;
  catalog_item_cost_metrics:
    | { suggested_cost_per_unit: number | string | null }
    | Array<{ suggested_cost_per_unit: number | string | null }>
    | null;
};

function readSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapCatalogItemProjection(row: CatalogItemRow): MaterialCatalogItemProjection {
  const metrics = readSingleRelation(row.catalog_item_cost_metrics);

  return {
    id: row.id,
    kind: row.kind,
    unit: row.unit,
    displayName: row.display_name,
    suggestedCostPerUnit:
      metrics?.suggested_cost_per_unit === null ||
      metrics?.suggested_cost_per_unit === undefined
        ? 0
        : Number(metrics.suggested_cost_per_unit),
  };
}

function mapOnHandQuantity(row: CatalogItemRow) {
  const balance = readSingleRelation(row.stock_balances);

  return balance?.on_hand_quantity === null || balance?.on_hand_quantity === undefined
    ? 0
    : Number(balance.on_hand_quantity);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: jobId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const [
    { data: job, error: jobError },
    { data: jobItems, error: jobItemsError },
    { data: stages, error: stagesError },
    { data: consumptionMovements, error: consumptionMovementsError },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, projected_revenue")
      .eq("id", jobId)
      .maybeSingle(),
    supabase
      .from("job_items")
      .select("id, quote_item_id, frame_catalog_id, width_cm, height_cm, quantity")
      .eq("job_id", jobId),
    supabase
      .from("job_stages")
      .select("id, status, actual_minutes")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    supabase
      .from("stock_movements")
      .select("catalog_item_id, job_item_id, quantity_delta, unit_cost, total_cost")
      .eq("job_id", jobId)
      .eq("movement_type", "job_consumption")
      .order("occurred_at", { ascending: true }),
  ]);

  if (jobError) {
    return serverError("Failed to load job.", jobError.message);
  }

  if (!job) {
    return notFound("Job not found.");
  }

  if (jobItemsError || stagesError || consumptionMovementsError) {
    return serverError("Failed to load job close context.", {
      jobItems: jobItemsError?.message,
      stages: stagesError?.message,
      consumptionMovements: consumptionMovementsError?.message,
    });
  }

  const quoteItemIds = Array.from(
    new Set(
      (jobItems ?? [])
        .map((item) => item.quote_item_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: quoteItems, error: quoteItemsError } =
    quoteItemIds.length > 0
      ? await supabase
          .from("quote_items")
          .select("id, lead_item_id, unit_price, quantity")
          .in("id", quoteItemIds)
      : { data: [], error: null };

  if (quoteItemsError) {
    return serverError("Failed to load quote items for job close.", quoteItemsError.message);
  }

  const leadItemIds = Array.from(
    new Set(
      (quoteItems ?? [])
        .map((item) => item.lead_item_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: leadItems, error: leadItemsError } =
    leadItemIds.length > 0
      ? await supabase
          .from("lead_items")
          .select(
            "id, face_mm, has_glass, has_matboard, matboard_border_cm, glass_type_id, matboard_type_id, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm",
          )
          .in("id", leadItemIds)
      : { data: [], error: null };

  if (leadItemsError) {
    return serverError("Failed to load lead items for job close.", leadItemsError.message);
  }

  const frameIds = Array.from(
    new Set(
      [
        ...(jobItems ?? [])
          .map((item) => item.frame_catalog_id)
          .filter((value): value is string => Boolean(value)),
        ...(leadItems ?? [])
          .map((item) => item.bastidor_secondary_frame_catalog_id)
          .filter((value): value is string => Boolean(value)),
      ],
    ),
  );
  const glassIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.glass_type_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const matboardIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.matboard_type_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [frameCatalogItems, glassCatalogItems, matboardCatalogItems] = await Promise.all([
    frameIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, kind, unit, display_name, catalog_frame_id, glass_type_id, matboard_type_id, stock_balances(on_hand_quantity), catalog_item_cost_metrics(suggested_cost_per_unit)",
          )
          .in("catalog_frame_id", frameIds)
      : Promise.resolve({ data: [], error: null }),
    glassIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, kind, unit, display_name, catalog_frame_id, glass_type_id, matboard_type_id, stock_balances(on_hand_quantity), catalog_item_cost_metrics(suggested_cost_per_unit)",
          )
          .in("glass_type_id", glassIds)
      : Promise.resolve({ data: [], error: null }),
    matboardIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, kind, unit, display_name, catalog_frame_id, glass_type_id, matboard_type_id, stock_balances(on_hand_quantity), catalog_item_cost_metrics(suggested_cost_per_unit)",
          )
          .in("matboard_type_id", matboardIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    frameCatalogItems.error ||
    glassCatalogItems.error ||
    matboardCatalogItems.error
  ) {
    return serverError("Failed to resolve catalog items for job close.", {
      frame: frameCatalogItems.error?.message,
      glass: glassCatalogItems.error?.message,
      matboard: matboardCatalogItems.error?.message,
    });
  }

  const quoteItemToLeadItemId = new Map(
    (quoteItems ?? [])
      .filter(
        (item): item is { id: string; lead_item_id: string; unit_price: number | string; quantity: number | string } =>
          Boolean(item.lead_item_id),
      )
      .map((item) => [item.id, item.lead_item_id]),
  );
  const quoteItemById = new Map((quoteItems ?? []).map((item) => [item.id, item]));
  const leadItemById = new Map(
    (leadItems ?? []).map((item) => [
      item.id,
      {
        faceMm:
          item.face_mm === null || item.face_mm === undefined
            ? null
            : Number(item.face_mm),
        hasGlass: item.has_glass === true,
        hasMatboard: item.has_matboard === true,
        matboardBorderCm:
          item.matboard_border_cm === null || item.matboard_border_cm === undefined
            ? null
            : Number(item.matboard_border_cm),
        glassTypeId: item.glass_type_id ?? null,
        matboardTypeId: item.matboard_type_id ?? null,
        assemblyMode: item.assembly_mode ?? null,
        bastidorVariant: item.bastidor_variant ?? null,
        bastidorLightCm:
          item.bastidor_light_cm === null || item.bastidor_light_cm === undefined
            ? null
            : Number(item.bastidor_light_cm),
        bastidorSecondaryFrameCatalogId:
          item.bastidor_secondary_frame_catalog_id ?? null,
        bastidorSupportMm:
          item.bastidor_support_mm === null || item.bastidor_support_mm === undefined
            ? null
            : Number(item.bastidor_support_mm),
        bastidorLomoMm:
          item.bastidor_lomo_mm === null || item.bastidor_lomo_mm === undefined
            ? null
            : Number(item.bastidor_lomo_mm),
        bastidorDepthMm:
          item.bastidor_depth_mm === null || item.bastidor_depth_mm === undefined
            ? null
            : Number(item.bastidor_depth_mm),
      } satisfies JobLeadItemMaterialContext,
    ]),
  );

  const frameCatalogItemMap = new Map<string, MaterialCatalogItemProjection>();
  const glassCatalogItemMap = new Map<string, MaterialCatalogItemProjection>();
  const matboardCatalogItemMap = new Map<string, MaterialCatalogItemProjection>();
  const onHandByCatalogItemId = new Map<string, number>();

  for (const row of (frameCatalogItems.data ?? []) as CatalogItemRow[]) {
    const projection = mapCatalogItemProjection(row);
    if (row.catalog_frame_id) {
      frameCatalogItemMap.set(row.catalog_frame_id, projection);
    }
    onHandByCatalogItemId.set(row.id, mapOnHandQuantity(row));
  }

  for (const row of (glassCatalogItems.data ?? []) as CatalogItemRow[]) {
    const projection = mapCatalogItemProjection(row);
    if (row.glass_type_id) {
      glassCatalogItemMap.set(row.glass_type_id, projection);
    }
    onHandByCatalogItemId.set(row.id, mapOnHandQuantity(row));
  }

  for (const row of (matboardCatalogItems.data ?? []) as CatalogItemRow[]) {
    const projection = mapCatalogItemProjection(row);
    if (row.matboard_type_id) {
      matboardCatalogItemMap.set(row.matboard_type_id, projection);
    }
    onHandByCatalogItemId.set(row.id, mapOnHandQuantity(row));
  }

  let computedMaterials;

  try {
    computedMaterials = (jobItems ?? []).flatMap((item) =>
      buildJobItemMaterials(
        {
          id: item.id,
          widthCm: Number(item.width_cm),
          heightCm: Number(item.height_cm),
          quantity: Number(item.quantity),
          frameCatalogId: item.frame_catalog_id,
          leadItem: item.quote_item_id
            ? leadItemById.get(quoteItemToLeadItemId.get(item.quote_item_id) ?? "") ?? null
            : null,
        },
        {
          frameCatalogItems: frameCatalogItemMap,
          glassCatalogItems: glassCatalogItemMap,
          matboardCatalogItems: matboardCatalogItemMap,
          onHandByCatalogItemId,
        },
      ),
    );
  } catch (error) {
    return serverError(
      "Failed to build job material breakdown.",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  const materialUsage = summarizeJobMaterialUsage(
    computedMaterials,
    ((consumptionMovements ?? []) as Array<{
      catalog_item_id: string;
      job_item_id: string | null;
      quantity_delta: number | string;
      unit_cost: number | string | null;
      total_cost: number | string | null;
    }>).map(
      (movement) =>
        ({
          catalogItemId: movement.catalog_item_id,
          jobItemId: movement.job_item_id,
          quantityConsumed: Math.abs(Number(movement.quantity_delta)),
          unitCost:
            movement.unit_cost === null || movement.unit_cost === undefined
              ? null
              : Number(movement.unit_cost),
          totalCost:
            movement.total_cost === null || movement.total_cost === undefined
              ? null
              : Number(movement.total_cost),
        }) satisfies JobMaterialUsageMovement,
    ),
  );

  const materialRows = computedMaterials.map((material) => ({
    jobItemId: material.jobItemId,
    consumed: materialUsage.get(material.key)?.consumed ?? false,
    actualCost: materialUsage.get(material.key)?.actualCost ?? 0,
  }));

  const validation = validateJobForClosure(
    (stages ?? []).map((stage) => ({
      status: stage.status,
      actualMinutes:
        stage.actual_minutes === null || stage.actual_minutes === undefined
          ? null
          : Number(stage.actual_minutes),
    })),
    materialRows,
  );

  if (!validation.canClose) {
    return badRequest("Job cannot be closed yet.", validation);
  }

  let totals;

  try {
    totals = buildJobCloseTotals({
      projectedRevenue: Number(job.projected_revenue),
      stages: (stages ?? []).map((stage) => ({
        status: stage.status,
        actualMinutes:
          stage.actual_minutes === null || stage.actual_minutes === undefined
            ? null
            : Number(stage.actual_minutes),
      })),
      materials: materialRows,
    });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Job cannot be closed yet.",
    );
  }

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update({
      status: "finished",
      actual_total_cost: totals.actualTotalCost,
      actual_margin: totals.actualMargin,
    })
    .eq("id", jobId);

  if (jobUpdateError) {
    return serverError("Failed to update job with actual costs.", jobUpdateError.message);
  }

  const { error: jobSnapshotError } = await supabase.from("cost_snapshots").insert({
    reference_type: "job",
    reference_id: jobId,
    material_cost: totals.actualMaterialCost,
    labor_cost: totals.actualLaborCost,
    total_cost: totals.actualTotalCost,
    price: Number(job.projected_revenue),
    margin: totals.actualMargin,
    metadata: {
      source: "job_close_actual",
      totalActualMinutes: totals.totalActualMinutes,
    },
  });

  if (jobSnapshotError) {
    return serverError(
      "Job updated but failed to insert actual cost snapshot.",
      jobSnapshotError.message,
    );
  }

  for (const itemCost of totals.itemActualCosts) {
    const { error: itemUpdateError } = await supabase
      .from("job_items")
      .update({
        actual_cost: itemCost.materialCost,
      })
      .eq("id", itemCost.jobItemId)
      .eq("job_id", jobId);

    if (itemUpdateError) {
      return serverError(
        "Job closed but failed to update job item actual costs.",
        itemUpdateError.message,
      );
    }
  }

  if (totals.itemActualCosts.length > 0) {
    const { error: itemSnapshotsError } = await supabase.from("cost_snapshots").insert(
      totals.itemActualCosts.map((itemCost) => {
        const jobItem = (jobItems ?? []).find((item) => item.id === itemCost.jobItemId);
        const quoteItem =
          jobItem?.quote_item_id
            ? quoteItemById.get(jobItem.quote_item_id)
            : null;
        const price = quoteItem
          ? round2(Number(quoteItem.unit_price) * Number(quoteItem.quantity))
          : 0;

        return {
          reference_type: "job_item",
          reference_id: itemCost.jobItemId,
          material_cost: itemCost.materialCost,
          labor_cost: 0,
          total_cost: itemCost.materialCost,
          price,
          margin: round2(price - itemCost.materialCost),
          metadata: { source: "job_close_actual" },
        };
      }),
    );

    if (itemSnapshotsError) {
      return serverError(
        "Job closed but failed to insert item-level actual snapshots.",
        itemSnapshotsError.message,
      );
    }
  }

  return NextResponse.json({
    success: true,
    jobId,
    actualMaterialCost: totals.actualMaterialCost,
    actualLaborCost: totals.actualLaborCost,
    actualTotalCost: totals.actualTotalCost,
    actualMargin: totals.actualMargin,
    totalActualMinutes: totals.totalActualMinutes,
  });
}
