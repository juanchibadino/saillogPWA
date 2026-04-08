import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import {
  buildJobItemMaterials,
  buildJobMaterialUsageKey,
  summarizeJobMaterialUsage,
  type JobLeadItemMaterialContext,
  type JobMaterialUsageMovement,
  type MaterialCatalogItemProjection,
} from "@/lib/jobs/material-breakdown";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2, round4 } from "@/lib/utils/math";

const schema = z.object({
  jobItemId: z.string().uuid(),
  catalogItemId: z.string().uuid(),
});

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const { id: jobId } = await context.params;
  const { jobItemId, catalogItemId } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    return serverError("Failed to load job.", jobError.message);
  }

  if (!job) {
    return notFound("Job not found.");
  }

  const { data: jobItem, error: jobItemError } = await supabase
    .from("job_items")
    .select("id, quote_item_id, frame_catalog_id, width_cm, height_cm, quantity")
    .eq("job_id", jobId)
    .eq("id", jobItemId)
    .maybeSingle();

  if (jobItemError) {
    return serverError("Failed to load job item.", jobItemError.message);
  }

  if (!jobItem) {
    return notFound("Job item not found.");
  }

  const { data: quoteItem, error: quoteItemError } = jobItem.quote_item_id
    ? await supabase
        .from("quote_items")
        .select("id, lead_item_id")
        .eq("id", jobItem.quote_item_id)
        .maybeSingle()
    : { data: null, error: null };

  if (quoteItemError) {
    return serverError("Failed to load quote item.", quoteItemError.message);
  }

  const { data: leadItem, error: leadItemError } = quoteItem?.lead_item_id
    ? await supabase
        .from("lead_items")
        .select(
          "id, face_mm, has_glass, has_matboard, matboard_border_cm, glass_type_id, matboard_type_id, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm",
        )
        .eq("id", quoteItem.lead_item_id)
        .maybeSingle()
    : { data: null, error: null };

  if (leadItemError) {
    return serverError("Failed to load lead item.", leadItemError.message);
  }

  const frameIds = Array.from(
    new Set(
      [
        jobItem.frame_catalog_id,
        leadItem?.bastidor_secondary_frame_catalog_id ?? null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const glassIds = leadItem?.glass_type_id ? [leadItem.glass_type_id] : [];
  const matboardIds = leadItem?.matboard_type_id ? [leadItem.matboard_type_id] : [];

  const [frameCatalogItems, glassCatalogItems, matboardCatalogItems, existingMovements] =
    await Promise.all([
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
      supabase
        .from("stock_movements")
        .select("catalog_item_id, job_item_id, quantity_delta, unit_cost, total_cost")
        .eq("job_id", jobId)
        .eq("movement_type", "job_consumption")
        .order("occurred_at", { ascending: true }),
    ]);

  if (
    frameCatalogItems.error ||
    glassCatalogItems.error ||
    matboardCatalogItems.error ||
    existingMovements.error
  ) {
    return serverError("Failed to resolve material usage for job item.", {
      frame: frameCatalogItems.error?.message,
      glass: glassCatalogItems.error?.message,
      matboard: matboardCatalogItems.error?.message,
      movements: existingMovements.error?.message,
    });
  }

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

  let materials;

  try {
    materials = buildJobItemMaterials(
      {
        id: jobItem.id,
        widthCm: Number(jobItem.width_cm),
        heightCm: Number(jobItem.height_cm),
        quantity: Number(jobItem.quantity),
        frameCatalogId: jobItem.frame_catalog_id,
        leadItem: leadItem
          ? ({
              faceMm:
                leadItem.face_mm === null || leadItem.face_mm === undefined
                  ? null
                  : Number(leadItem.face_mm),
              hasGlass: leadItem.has_glass === true,
              hasMatboard: leadItem.has_matboard === true,
              matboardBorderCm:
                leadItem.matboard_border_cm === null ||
                leadItem.matboard_border_cm === undefined
                  ? null
                  : Number(leadItem.matboard_border_cm),
              glassTypeId: leadItem.glass_type_id ?? null,
              matboardTypeId: leadItem.matboard_type_id ?? null,
              assemblyMode: leadItem.assembly_mode ?? null,
              bastidorVariant: leadItem.bastidor_variant ?? null,
              bastidorLightCm:
                leadItem.bastidor_light_cm === null ||
                leadItem.bastidor_light_cm === undefined
                  ? null
                  : Number(leadItem.bastidor_light_cm),
              bastidorSecondaryFrameCatalogId:
                leadItem.bastidor_secondary_frame_catalog_id ?? null,
              bastidorSupportMm:
                leadItem.bastidor_support_mm === null ||
                leadItem.bastidor_support_mm === undefined
                  ? null
                  : Number(leadItem.bastidor_support_mm),
              bastidorLomoMm:
                leadItem.bastidor_lomo_mm === null ||
                leadItem.bastidor_lomo_mm === undefined
                  ? null
                  : Number(leadItem.bastidor_lomo_mm),
              bastidorDepthMm:
                leadItem.bastidor_depth_mm === null ||
                leadItem.bastidor_depth_mm === undefined
                  ? null
                  : Number(leadItem.bastidor_depth_mm),
            } satisfies JobLeadItemMaterialContext)
          : null,
      },
      {
        frameCatalogItems: frameCatalogItemMap,
        glassCatalogItems: glassCatalogItemMap,
        matboardCatalogItems: matboardCatalogItemMap,
        onHandByCatalogItemId,
      },
    );
  } catch (error) {
    return serverError(
      "Failed to build job item materials.",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  const material = materials.find(
    (entry) => entry.catalogItemId === catalogItemId,
  );

  if (!material) {
    return notFound("Material row not found for this job item.");
  }

  const usageSummary = summarizeJobMaterialUsage(
    materials,
    ((existingMovements.data ?? []) as Array<{
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

  const materialUsage = usageSummary.get(material.key);

  if (materialUsage?.consumed) {
    return NextResponse.json({
      success: true,
      reused: true,
      jobId,
      jobItemId,
      catalogItemId,
    });
  }

  if (round4(material.onHandQuantity) + 0.0001 < round4(material.requiredQuantity)) {
    return badRequest("Insufficient stock to use this material row.", {
      jobId,
      jobItemId,
      catalogItemId,
      required: material.requiredQuantity,
      available: material.onHandQuantity,
      unit: material.unit,
    });
  }

  const idempotencyKey = `job_consumption:${jobId}:${jobItemId}:${catalogItemId}`;
  const quantityConsumed = round4(material.requiredQuantity);
  const unitCost = round4(material.suggestedCostPerUnit);
  const totalCost = round2(quantityConsumed * unitCost);
  const nextOnHandQuantity = round4(material.onHandQuantity - quantityConsumed);

  const { error: movementError } = await supabase.from("stock_movements").insert({
    catalog_item_id: catalogItemId,
    movement_type: "job_consumption",
    quantity_delta: -quantityConsumed,
    unit_cost: unitCost,
    total_cost: totalCost,
    job_id: jobId,
    job_item_id: jobItemId,
    idempotency_key: idempotencyKey,
    notes: "Used from job detail row",
    occurred_at: new Date().toISOString(),
  });

  if (movementError) {
    if (movementError.code === "23505") {
      return NextResponse.json({
        success: true,
        reused: true,
        jobId,
        jobItemId,
        catalogItemId,
      });
    }

    return serverError("Failed to record stock usage.", movementError.message);
  }

  const { error: balanceUpdateError } = await supabase
    .from("stock_balances")
    .update({ on_hand_quantity: nextOnHandQuantity, updated_at: new Date().toISOString() })
    .eq("catalog_item_id", catalogItemId);

  if (balanceUpdateError) {
    return serverError(
      "Stock movement recorded but failed to update stock balance.",
      balanceUpdateError.message,
    );
  }

  return NextResponse.json({
    success: true,
    reused: false,
    jobId,
    jobItemId,
    catalogItemId,
    idempotencyKey: buildJobMaterialUsageKey(jobItemId, catalogItemId),
  });
}
