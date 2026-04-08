import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { notFound, serverError } from "@/lib/http/responses";
import {
  buildJobItemMaterials,
  summarizeJobMaterialUsage,
  type JobLeadItemMaterialContext,
  type JobMaterialUsageMovement,
  type MaterialCatalogItemProjection,
} from "@/lib/jobs/material-breakdown";
import {
  mapPurchaseRecord,
  PURCHASE_RECORD_SELECT,
} from "@/lib/purchases/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const balance = readSingleRelation(row.stock_balances);
  const metrics = readSingleRelation(row.catalog_item_cost_metrics);

  void balance;

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();

  const [
    { data: job, error: jobError },
    { data: items, error: itemsError },
    { data: stages, error: stagesError },
    { data: snapshots, error: snapshotsError },
    { data: purchases, error: purchasesError },
    { data: consumptionMovements, error: consumptionMovementsError },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, quote_id, status, due_date, projected_revenue, projected_total_cost, projected_margin, actual_total_cost, actual_margin, created_at",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("job_items")
      .select(
        "id, quote_item_id, width_cm, height_cm, frame_catalog_id, quantity, required_moulding_cm, required_moulding_m, projected_cost, actual_cost",
      )
      .eq("job_id", id),
    supabase
      .from("job_stages")
      .select("id, stage_name, status, estimated_minutes, actual_minutes, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("cost_snapshots")
      .select(
        "id, reference_type, reference_id, material_cost, labor_cost, total_cost, price, margin, calculated_at, metadata",
      )
      .eq("reference_type", "job")
      .in("reference_id", [id]),
    supabase
      .from("purchases")
      .select(PURCHASE_RECORD_SELECT)
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_movements")
      .select("catalog_item_id, job_item_id, quantity_delta, unit_cost, total_cost")
      .eq("job_id", id)
      .eq("movement_type", "job_consumption")
      .order("occurred_at", { ascending: true }),
  ]);

  if (jobError) {
    if (jobError.code === "PGRST116") {
      return notFound("Job not found.");
    }

    return serverError("Failed to load job.", jobError.message);
  }

  if (
    itemsError ||
    stagesError ||
    snapshotsError ||
    purchasesError ||
    consumptionMovementsError
  ) {
    return serverError("Failed to load job details.", {
      items: itemsError?.message,
      stages: stagesError?.message,
      snapshots: snapshotsError?.message,
      purchases: purchasesError?.message,
      consumptionMovements: consumptionMovementsError?.message,
    });
  }

  const jobItemIds = (items ?? []).map((item) => item.id);

  const { data: itemSnapshots, error: itemSnapshotsError } =
    jobItemIds.length > 0
      ? await supabase
          .from("cost_snapshots")
          .select(
            "id, reference_type, reference_id, material_cost, labor_cost, total_cost, price, margin, calculated_at, metadata",
          )
          .eq("reference_type", "job_item")
          .in("reference_id", jobItemIds)
      : { data: [], error: null };

  if (itemSnapshotsError) {
    return serverError("Failed to load job item snapshots.", itemSnapshotsError.message);
  }

  const quoteItemIds = Array.from(
    new Set(
      (items ?? [])
        .map((item) => item.quote_item_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: quoteItems, error: quoteItemsError } =
    quoteItemIds.length > 0
      ? await supabase
          .from("quote_items")
          .select("id, lead_item_id")
          .in("id", quoteItemIds)
      : { data: [], error: null };

  if (quoteItemsError) {
    return serverError("Failed to load job quote item links.", quoteItemsError.message);
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
    return serverError("Failed to load lead items for job materials.", leadItemsError.message);
  }

  const frameIds = Array.from(
    new Set(
      [
        ...(items ?? [])
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
    return serverError("Failed to resolve job material catalog items.", {
      frame: frameCatalogItems.error?.message,
      glass: glassCatalogItems.error?.message,
      matboard: matboardCatalogItems.error?.message,
    });
  }

  const quoteItemToLeadItemId = new Map(
    (quoteItems ?? [])
      .filter(
        (item): item is { id: string; lead_item_id: string } => Boolean(item.lead_item_id),
      )
      .map((item) => [item.id, item.lead_item_id]),
  );
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
    computedMaterials = (items ?? []).flatMap((item) =>
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
    (consumptionMovements ?? []).map(
      (movement) =>
        ({
          catalogItemId: movement.catalog_item_id,
          jobItemId: movement.job_item_id ?? null,
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

  return NextResponse.json({
    id: job.id,
    quoteId: job.quote_id,
    status: job.status,
    dueDate: job.due_date,
    projectedRevenue: Number(job.projected_revenue),
    projectedTotalCost: Number(job.projected_total_cost),
    projectedMargin: Number(job.projected_margin),
    actualTotalCost:
      job.actual_total_cost === null ? null : Number(job.actual_total_cost),
    actualMargin: job.actual_margin === null ? null : Number(job.actual_margin),
    createdAt: job.created_at,
    items: (items ?? []).map((item) => ({
      id: item.id,
      quoteItemId: item.quote_item_id,
      widthCm: Number(item.width_cm),
      heightCm: Number(item.height_cm),
      frameCatalogId: item.frame_catalog_id,
      quantity: Number(item.quantity),
      requiredMouldingCm: Number(item.required_moulding_cm),
      requiredMouldingM: Number(item.required_moulding_m),
      projectedCost: Number(item.projected_cost),
      actualCost: item.actual_cost === null ? null : Number(item.actual_cost),
      materials: computedMaterials
        .filter((material) => material.jobItemId === item.id)
        .map(({ suggestedCostPerUnit, ...material }) => ({
          ...material,
          consumed: materialUsage.get(material.key)?.consumed ?? false,
        })),
    })),
    stages: (stages ?? []).map((stage) => ({
      id: stage.id,
      name: stage.stage_name,
      status: stage.status,
      estimatedMinutes: stage.estimated_minutes,
      actualMinutes: stage.actual_minutes,
      createdAt: stage.created_at,
    })),
    snapshots: [...(snapshots ?? []), ...(itemSnapshots ?? [])].map((snapshot) => ({
      id: snapshot.id,
      referenceType: snapshot.reference_type,
      referenceId: snapshot.reference_id,
      materialCost: Number(snapshot.material_cost),
      laborCost: Number(snapshot.labor_cost),
      totalCost: Number(snapshot.total_cost),
      price: Number(snapshot.price),
      margin: Number(snapshot.margin),
      calculatedAt: snapshot.calculated_at,
      metadata: snapshot.metadata,
    })),
    purchases: (purchases ?? []).map((purchase) => mapPurchaseRecord(purchase)),
  });
}
