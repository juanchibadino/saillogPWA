import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LEAD_ITEMS_SELECT_FULL =
  "id, width_cm, height_cm, quantity, wood_type, style_type, color_group, finish_color_hex, finish_color_name, face_mm, depth_mm, has_glass, has_matboard, matboard_border_cm, frame_cost, glass_cost, matboard_cost, labor_cost, preliminary_price, projected_cost, frame_catalog_id, glass_type_id, matboard_type_id, required_moulding_cm, required_moulding_m, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm";
const LEAD_ITEMS_SELECT_LEGACY =
  "id, width_cm, height_cm, quantity, wood_type, style_type, color_group, face_mm, depth_mm, has_glass, has_matboard, preliminary_price, projected_cost, frame_catalog_id, glass_type_id, matboard_type_id, required_moulding_cm, required_moulding_m";

type LeadItemRow = {
  id: string;
  width_cm: number | string;
  height_cm: number | string;
  quantity: number | string;
  wood_type: string;
  style_type: string;
  color_group: string;
  finish_color_hex?: string | null;
  finish_color_name?: string | null;
  face_mm: number | string;
  depth_mm: number | string;
  has_glass: boolean;
  has_matboard: boolean;
  matboard_border_cm?: number | string | null;
  frame_cost?: number | string | null;
  glass_cost?: number | string | null;
  matboard_cost?: number | string | null;
  labor_cost?: number | string | null;
  preliminary_price: number | string;
  projected_cost: number | string;
  frame_catalog_id: string;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  required_moulding_cm: number | string;
  required_moulding_m: number | string;
  assembly_mode?: string;
  bastidor_variant?: string | null;
  bastidor_light_cm?: number | string | null;
  bastidor_secondary_frame_catalog_id?: string | null;
  bastidor_support_mm?: number | string | null;
  bastidor_lomo_mm?: number | string | null;
  bastidor_depth_mm?: number | string | null;
};

type CatalogFrameRow = {
  id: string;
  wood_type: string;
  style_type: string;
  color_group: string;
  face_mm: number | string;
  depth_mm: number | string;
  public_label: string | null;
};

type AccessoryTypeRow = {
  id: string;
  name: string;
};

type CatalogItemCostMetricRow = {
  reference_cost_per_unit: number | string | null;
};

type CatalogItemCostRow = {
  catalog_frame_id: string | null;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  catalog_item_cost_metrics: CatalogItemCostMetricRow[] | CatalogItemCostMetricRow | null;
};

function titleize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeMetric(
  relation: CatalogItemCostRow["catalog_item_cost_metrics"],
): CatalogItemCostMetricRow | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function readReferenceCost(
  relation: CatalogItemCostRow["catalog_item_cost_metrics"],
): number | null {
  const metric = normalizeMetric(relation);

  if (!metric || metric.reference_cost_per_unit === null || metric.reference_cost_per_unit === undefined) {
    return null;
  }

  const parsed = Number(metric.reference_cost_per_unit);
  return Number.isFinite(parsed) ? parsed : null;
}

function frameLabel(frame: CatalogFrameRow | null | undefined): string | null {
  if (!frame) {
    return null;
  }

  if (frame.public_label && frame.public_label.trim().length > 0) {
    return frame.public_label.trim();
  }

  return `${titleize(frame.wood_type)} ${Number(frame.face_mm)}x${Number(frame.depth_mm)} ${titleize(frame.color_group)}`;
}

function isMissingLegacyLeadItemsColumnsError(error: { code?: string | null; message?: string | null }) {
  if (!error.message) {
    return false;
  }

  if (error.code !== "PGRST204" && error.code !== "42703") {
    return false;
  }

  const message = error.message.toLowerCase();
  const columns = [
    "finish_color_hex",
    "finish_color_name",
    "matboard_border_cm",
    "frame_cost",
    "glass_cost",
    "matboard_cost",
    "labor_cost",
    "assembly_mode",
    "bastidor_variant",
    "bastidor_light_cm",
    "bastidor_secondary_frame_catalog_id",
    "bastidor_support_mm",
    "bastidor_lomo_mm",
    "bastidor_depth_mm",
  ];

  return columns.some(
    (column) =>
      message.includes(`'${column}'`) ||
      message.includes(`.${column}`) ||
      message.includes(column),
  );
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

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, created_at, customer_name, customer_phone, customer_email, status, preliminary_total, notes",
    )
    .eq("id", id)
    .single();

  if (leadError) {
    if (leadError.code === "PGRST116") {
      return notFound("Lead not found.");
    }

    return serverError("Failed to load lead.", leadError.message);
  }

  const fullItemsResult = await supabase
    .from("lead_items")
    .select(LEAD_ITEMS_SELECT_FULL)
    .eq("lead_id", id);
  let items = (fullItemsResult.data ?? null) as LeadItemRow[] | null;
  let itemsError = fullItemsResult.error;

  if (itemsError && isMissingLegacyLeadItemsColumnsError(itemsError)) {
    const legacyItemsResult = await supabase
      .from("lead_items")
      .select(LEAD_ITEMS_SELECT_LEGACY)
      .eq("lead_id", id);
    items = (legacyItemsResult.data ?? null) as LeadItemRow[] | null;
    itemsError = legacyItemsResult.error;
  }

  if (itemsError) {
    return serverError("Failed to load lead items.", itemsError.message);
  }

  const frameCatalogIds = uniqueIds((items ?? []).map((item) => item.frame_catalog_id));
  const secondaryFrameCatalogIds = uniqueIds(
    (items ?? []).map((item) => item.bastidor_secondary_frame_catalog_id),
  );
  const glassTypeIds = uniqueIds((items ?? []).map((item) => item.glass_type_id));
  const matboardTypeIds = uniqueIds((items ?? []).map((item) => item.matboard_type_id));

  const emptyAccessoryResult = Promise.resolve({ data: [] as AccessoryTypeRow[], error: null });
  const emptyFrameResult = Promise.resolve({ data: [] as CatalogFrameRow[], error: null });
  const emptyCostResult = Promise.resolve({ data: [] as CatalogItemCostRow[], error: null });

  const [
    frameResult,
    glassTypeResult,
    matboardTypeResult,
    frameCostResult,
    glassCostResult,
    matboardCostResult,
  ] = await Promise.all([
    frameCatalogIds.length > 0 || secondaryFrameCatalogIds.length > 0
      ? supabase
          .from("catalog_frames")
          .select("id, wood_type, style_type, color_group, face_mm, depth_mm, public_label")
          .in("id", uniqueIds([...frameCatalogIds, ...secondaryFrameCatalogIds]))
      : emptyFrameResult,
    glassTypeIds.length > 0
      ? supabase
          .from("glass_types")
          .select("id, name")
          .in("id", glassTypeIds)
      : emptyAccessoryResult,
    matboardTypeIds.length > 0
      ? supabase
          .from("matboard_types")
          .select("id, name")
          .in("id", matboardTypeIds)
      : emptyAccessoryResult,
    frameCatalogIds.length > 0 || secondaryFrameCatalogIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("catalog_frame_id", uniqueIds([...frameCatalogIds, ...secondaryFrameCatalogIds]))
      : emptyCostResult,
    glassTypeIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("glass_type_id", glassTypeIds)
      : emptyCostResult,
    matboardTypeIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("matboard_type_id", matboardTypeIds)
      : emptyCostResult,
  ]);

  if (
    frameResult.error ||
    glassTypeResult.error ||
    matboardTypeResult.error ||
    frameCostResult.error ||
    glassCostResult.error ||
    matboardCostResult.error
  ) {
    return serverError("Failed to load lead item metadata.", {
      frames: frameResult.error?.message,
      glassTypes: glassTypeResult.error?.message,
      matboardTypes: matboardTypeResult.error?.message,
      frameCosts: frameCostResult.error?.message,
      glassCosts: glassCostResult.error?.message,
      matboardCosts: matboardCostResult.error?.message,
    });
  }

  const frameById = new Map((frameResult.data ?? []).map((frame) => [frame.id, frame]));
  const glassNameById = new Map((glassTypeResult.data ?? []).map((glass) => [glass.id, glass.name]));
  const matboardNameById = new Map(
    (matboardTypeResult.data ?? []).map((matboard) => [matboard.id, matboard.name]),
  );

  const frameReferenceCostPerMById = new Map<string, number>();
  const glassReferenceCostPerM2ById = new Map<string, number>();
  const matboardReferenceCostPerM2ById = new Map<string, number>();

  for (const row of frameCostResult.data ?? []) {
    if (!row.catalog_frame_id) {
      continue;
    }

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      continue;
    }

    frameReferenceCostPerMById.set(row.catalog_frame_id, referenceCost);
  }

  for (const row of glassCostResult.data ?? []) {
    if (!row.glass_type_id) {
      continue;
    }

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      continue;
    }

    glassReferenceCostPerM2ById.set(row.glass_type_id, referenceCost);
  }

  for (const row of matboardCostResult.data ?? []) {
    if (!row.matboard_type_id) {
      continue;
    }

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      continue;
    }

    matboardReferenceCostPerM2ById.set(row.matboard_type_id, referenceCost);
  }

  return NextResponse.json({
    id: lead.id,
    createdAt: lead.created_at,
    customerName: lead.customer_name,
    customerPhone: lead.customer_phone,
    customerEmail: lead.customer_email,
    status: lead.status,
    preliminaryTotal: Number(lead.preliminary_total),
    notes: lead.notes,
    items: (items ?? []).map((item) => ({
      id: item.id,
      widthCm: Number(item.width_cm),
      heightCm: Number(item.height_cm),
      quantity: Number(item.quantity),
      woodType: item.wood_type,
      styleType: item.style_type,
      colorGroup: item.color_group,
      finishColorHex: item.finish_color_hex ?? null,
      finishColorName: item.finish_color_name ?? null,
      faceMm: Number(item.face_mm),
      depthMm: Number(item.depth_mm),
      hasGlass: item.has_glass,
      hasMatboard: item.has_matboard,
      matboardBorderCm:
        item.matboard_border_cm !== undefined && item.matboard_border_cm !== null
          ? Number(item.matboard_border_cm)
          : null,
      frameCost:
        item.frame_cost !== undefined && item.frame_cost !== null
          ? Number(item.frame_cost)
          : null,
      glassCost:
        item.glass_cost !== undefined && item.glass_cost !== null
          ? Number(item.glass_cost)
          : null,
      matboardCost:
        item.matboard_cost !== undefined && item.matboard_cost !== null
          ? Number(item.matboard_cost)
          : null,
      laborCost:
        item.labor_cost !== undefined && item.labor_cost !== null
          ? Number(item.labor_cost)
          : null,
      preliminaryPrice: Number(item.preliminary_price),
      projectedCost: Number(item.projected_cost),
      frameCatalogId: item.frame_catalog_id,
      glassTypeId: item.glass_type_id,
      matboardTypeId: item.matboard_type_id,
      frameLabel: frameLabel(frameById.get(item.frame_catalog_id)),
      glassTypeName: item.glass_type_id ? glassNameById.get(item.glass_type_id) ?? null : null,
      matboardTypeName: item.matboard_type_id
        ? matboardNameById.get(item.matboard_type_id) ?? null
        : null,
      frameReferenceCostPerM:
        frameReferenceCostPerMById.get(item.frame_catalog_id) ?? null,
      assemblyMode: item.assembly_mode ?? "normal",
      bastidorVariant: item.bastidor_variant ?? null,
      bastidorLightCm:
        item.bastidor_light_cm !== undefined && item.bastidor_light_cm !== null
          ? Number(item.bastidor_light_cm)
          : null,
      bastidorSecondaryFrameCatalogId: item.bastidor_secondary_frame_catalog_id ?? null,
      bastidorSecondaryFrameLabel: item.bastidor_secondary_frame_catalog_id
        ? frameLabel(frameById.get(item.bastidor_secondary_frame_catalog_id))
        : null,
      bastidorSecondaryFrameReferenceCostPerM: item.bastidor_secondary_frame_catalog_id
        ? frameReferenceCostPerMById.get(item.bastidor_secondary_frame_catalog_id) ?? null
        : null,
      bastidorSupportMm:
        item.bastidor_support_mm !== undefined && item.bastidor_support_mm !== null
          ? Number(item.bastidor_support_mm)
          : null,
      bastidorLomoMm:
        item.bastidor_lomo_mm !== undefined && item.bastidor_lomo_mm !== null
          ? Number(item.bastidor_lomo_mm)
          : null,
      bastidorDepthMm:
        item.bastidor_depth_mm !== undefined && item.bastidor_depth_mm !== null
          ? Number(item.bastidor_depth_mm)
          : null,
      glassReferenceCostPerM2: item.glass_type_id
        ? glassReferenceCostPerM2ById.get(item.glass_type_id) ?? null
        : null,
      matboardReferenceCostPerM2: item.matboard_type_id
        ? matboardReferenceCostPerM2ById.get(item.matboard_type_id) ?? null
        : null,
      requiredMouldingCm: Number(item.required_moulding_cm),
      requiredMouldingM: Number(item.required_moulding_m),
    })),
  });
}
