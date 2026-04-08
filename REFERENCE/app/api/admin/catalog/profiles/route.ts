import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COLOR_GROUPS,
  STYLE_CODES,
  isWoodType,
  normalizeWoodType,
} from "@/lib/catalog/taxonomy";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, serverError } from "@/lib/http/responses";
import { deriveReferencePricePerMeter } from "@/lib/pricing/catalog-price";
import { syncFrameReferenceCostMetric } from "@/lib/catalog/cost-metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  woodType: z.string().trim().min(1),
  styleType: z.enum(STYLE_CODES),
  colorGroup: z.enum(COLOR_GROUPS),
  faceMm: z.number().positive(),
  depthMm: z.number().positive(),
  supportsBastidor: z.boolean().optional(),
  lomoMm: z.number().positive().nullable().optional(),
  referenceCostPerMeter: z.number().nonnegative(),
  supplierId: z.string().uuid(),
  supplierModelCode: z.string().trim().max(120).nullable().optional(),
  publicLabel: z.string().trim().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();
  const deviationAlertThreshold = Number(process.env.COST_ALERT_DEVIATION_PCT ?? "20");

  const [
    { data: frames, error: framesError },
    { data: links, error: linksError },
    { data: frameCostItems, error: frameCostItemsError },
  ] =
    await Promise.all([
      supabase
        .from("catalog_frames")
        .select(
          "id, wood_type, style_type, color_group, face_mm, depth_mm, supports_bastidor, lomo_mm, is_public, public_label, sort_order, active",
        )
        .order("sort_order", { ascending: true })
        .order("style_type", { ascending: true })
        .order("face_mm", { ascending: true })
        .order("depth_mm", { ascending: true })
        .order("wood_type", { ascending: true })
        .order("color_group", { ascending: true }),
      supabase
        .from("catalog_frame_suppliers")
        .select(
          "catalog_frame_id, supplier_id, supplier_model_code, last_cost_per_meter, active, suppliers(id, code, name, active)",
        )
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("catalog_items")
        .select(
          "catalog_frame_id, catalog_item_cost_metrics(suggested_cost_per_unit, reference_cost_per_unit, deviation_vs_reference_pct, purchase_count_window, updated_at)",
        )
        .not("catalog_frame_id", "is", null),
    ]);

  if (framesError || linksError || frameCostItemsError) {
    return serverError("Failed to load curated frames.", {
      frames: framesError?.message,
      links: linksError?.message,
      costItems: frameCostItemsError?.message,
    });
  }

  const supplierByFrameId = new Map<
    string,
    {
      supplierId: string | null;
      supplierCode: string | null;
      supplierName: string | null;
      supplierModelCode: string | null;
      supplierCostPerMeter: number | null;
    }
  >();

  for (const link of links ?? []) {
    if (supplierByFrameId.has(link.catalog_frame_id)) {
      continue;
    }

    const supplier = Array.isArray(link.suppliers) ? link.suppliers[0] : link.suppliers;

    supplierByFrameId.set(link.catalog_frame_id, {
      supplierId: link.supplier_id,
      supplierCode: supplier?.code ?? null,
      supplierName: supplier?.name ?? null,
      supplierModelCode: link.supplier_model_code ?? null,
      supplierCostPerMeter:
        link.last_cost_per_meter === null ? null : Number(link.last_cost_per_meter),
    });
  }

  const costByFrameId = new Map<
    string,
    {
      suggestedCostPerMeter: number;
      referenceCostPerMeter: number;
      costDeviationPct: number;
      purchaseCountWindow: number;
      metricsUpdatedAt: string | null;
    }
  >();

  for (const row of frameCostItems ?? []) {
    if (!row.catalog_frame_id || costByFrameId.has(row.catalog_frame_id)) {
      continue;
    }

    const metrics = Array.isArray(row.catalog_item_cost_metrics)
      ? row.catalog_item_cost_metrics[0]
      : row.catalog_item_cost_metrics;

    costByFrameId.set(row.catalog_frame_id, {
      suggestedCostPerMeter:
        metrics?.suggested_cost_per_unit === null ||
        metrics?.suggested_cost_per_unit === undefined
          ? 0
          : Number(metrics.suggested_cost_per_unit),
      referenceCostPerMeter:
        metrics?.reference_cost_per_unit === null ||
        metrics?.reference_cost_per_unit === undefined
          ? 0
          : Number(metrics.reference_cost_per_unit),
      costDeviationPct:
        metrics?.deviation_vs_reference_pct === null ||
        metrics?.deviation_vs_reference_pct === undefined
          ? 0
          : Number(metrics.deviation_vs_reference_pct),
      purchaseCountWindow: Number(metrics?.purchase_count_window ?? 0),
      metricsUpdatedAt: metrics?.updated_at ?? null,
    });
  }

  return NextResponse.json(
    (frames ?? []).map((row) => {
      const supplier = supplierByFrameId.get(row.id);
      const costMetrics = costByFrameId.get(row.id);
      const referenceCost = costMetrics?.referenceCostPerMeter ?? 0;
      const referencePrice = deriveReferencePricePerMeter(referenceCost);
      const suggestedCost =
        costMetrics?.suggestedCostPerMeter && costMetrics.suggestedCostPerMeter > 0
          ? costMetrics.suggestedCostPerMeter
          : referenceCost;
      const deviationPct =
        costMetrics?.referenceCostPerMeter && costMetrics.referenceCostPerMeter > 0
          ? costMetrics.costDeviationPct
          : referenceCost > 0
            ? ((suggestedCost - referenceCost) / referenceCost) * 100
            : 0;

      return {
        id: row.id,
        woodType: row.wood_type,
        styleType: row.style_type,
        colorGroup: row.color_group,
        faceMm: Number(row.face_mm),
        depthMm: Number(row.depth_mm),
        supportsBastidor: Boolean(row.supports_bastidor),
        lomoMm:
          row.lomo_mm === null || row.lomo_mm === undefined
            ? null
            : Number(row.lomo_mm),
        referencePricePerMeter: referencePrice,
        referenceCostPerMeter: referenceCost,
        isPublic: row.is_public,
        publicLabel: row.public_label,
        sortOrder: row.sort_order,
        active: row.active,
        supplierId: supplier?.supplierId ?? null,
        supplierCode: supplier?.supplierCode ?? null,
        supplierName: supplier?.supplierName ?? null,
        supplierModelCode: supplier?.supplierModelCode ?? null,
        supplierCostPerMeter:
          supplier?.supplierCostPerMeter ?? referenceCost,
        suggestedCostPerMeter: suggestedCost,
        costDeviationPct: deviationPct,
        costDeviationAlert: Math.abs(deviationPct) >= deviationAlertThreshold,
        purchaseCountWindow: costMetrics?.purchaseCountWindow ?? 0,
        costMetricsUpdatedAt: costMetrics?.metricsUpdatedAt ?? null,
      };
    }),
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const woodType = normalizeWoodType(parsed.data.woodType);

  if (!isWoodType(woodType)) {
    return badRequest("Invalid woodType. Allowed: pino, marupa, kiri, tiza.");
  }

  const supabase = createSupabaseAdminClient();

  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", parsed.data.supplierId)
    .eq("active", true)
    .single();

  if (supplierError || !supplier) {
    return badRequest("Supplier not found or inactive.");
  }

  const referenceCost = parsed.data.referenceCostPerMeter;
  const supportsBastidor = parsed.data.supportsBastidor ?? false;
  const lomoMm = supportsBastidor ? parsed.data.lomoMm ?? null : null;

  if (supportsBastidor && (lomoMm === null || lomoMm >= parsed.data.faceMm)) {
    return badRequest("Lomo must be greater than 0 and smaller than faceMm for bastidor frames.");
  }

  const { data: frame, error: frameError } = await supabase
    .from("catalog_frames")
    .insert({
      wood_type: woodType,
      style_type: parsed.data.styleType,
      color_group: parsed.data.colorGroup,
      face_mm: parsed.data.faceMm,
      depth_mm: parsed.data.depthMm,
      supports_bastidor: supportsBastidor,
      lomo_mm: lomoMm,
      active: parsed.data.active ?? true,
      is_public: parsed.data.isPublic ?? false,
      sort_order: parsed.data.sortOrder ?? 0,
      public_label: parsed.data.publicLabel ?? null,
    })
    .select("id")
    .single();

  if (frameError || !frame) {
    return serverError("Failed to create curated frame.", frameError?.message);
  }

  const { error: supplierLinkError } = await supabase
    .from("catalog_frame_suppliers")
    .insert({
      catalog_frame_id: frame.id,
      supplier_id: parsed.data.supplierId,
      supplier_model_code: parsed.data.supplierModelCode ?? null,
      last_cost_per_meter: null,
      active: true,
    });

  if (supplierLinkError) {
    await supabase
      .from("catalog_frames")
      .delete()
      .eq("id", frame.id);

    return serverError("Failed to link supplier to curated frame.", supplierLinkError.message);
  }

  try {
    await syncFrameReferenceCostMetric(supabase, frame.id, referenceCost);
  } catch (error) {
    await supabase
      .from("catalog_frames")
      .delete()
      .eq("id", frame.id);

    return serverError(
      "Failed to initialize curated frame reference cost.",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return NextResponse.json({ success: true, id: frame.id });
}
