import { NextResponse } from "next/server";
import { calculatePreliminaryPricing } from "@/lib/pricing/preliminary";
import {
  type CatalogCostReader,
  CatalogPricingConfigurationError,
  loadUnifiedReferenceCosts,
} from "@/lib/pricing/unified-costs";
import { deriveReferencePricePerMeter } from "@/lib/pricing/catalog-price";
import { requireAdminAuth } from "@/lib/admin/auth";
import { notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/utils/math";

const LABOR_COST_PER_CM = 0;
const PRICE_SOURCE_EPSILON = 0.01;

function titleize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
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
    { data: quote, error: quoteError },
    { data: quoteItems, error: quoteItemsError },
    { data: activeFrames, error: framesError },
    { data: existingJob, error: existingJobError },
  ] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("id, lead_id, status, subtotal, total, created_at, approved_at")
        .eq("id", id)
        .single(),
      supabase
        .from("quote_items")
        .select("id, quote_id, lead_item_id, frame_catalog_id, unit_price, unit_projected_cost, unit_projected_margin, quantity")
        .eq("quote_id", id),
      supabase
        .from("catalog_frames")
        .select("id, wood_type, style_type, color_group, face_mm, depth_mm, supports_bastidor, lomo_mm, public_label, active")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("wood_type", { ascending: true }),
      supabase.from("jobs").select("id").eq("quote_id", id).maybeSingle(),
    ]);

  if (quoteError) {
    if (quoteError.code === "PGRST116") {
      return notFound("Quote not found.");
    }

    return serverError("Failed to load quote.", quoteError.message);
  }

  if (quoteItemsError || framesError || existingJobError) {
    return serverError("Failed to load quote details.", {
      quoteItems: quoteItemsError?.message,
      frames: framesError?.message,
      job: existingJobError?.message,
    });
  }

  const leadItemIds = Array.from(
    new Set(
      (quoteItems ?? [])
        .map((item) => item.lead_item_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );
  const primaryFrameIds = Array.from(
    new Set(
      (quoteItems ?? [])
        .map((item) => item.frame_catalog_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );

  const { data: leadItems, error: leadItemsError } =
    leadItemIds.length > 0
      ? await supabase
          .from("lead_items")
          .select(
            "id, width_cm, height_cm, has_glass, has_matboard, matboard_border_cm, glass_type_id, matboard_type_id, wood_type, style_type, color_group, finish_color_hex, finish_color_name, face_mm, depth_mm, required_moulding_cm, required_moulding_m, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm",
          )
          .in("id", leadItemIds)
      : { data: [], error: null };

  if (leadItemsError) {
    return serverError("Failed to load quote dependencies.", {
      leadItems: leadItemsError?.message,
    });
  }

  const selectedFrameIds = Array.from(
    new Set(
      [
        ...primaryFrameIds,
        ...(leadItems ?? [])
          .map((item) => item.bastidor_secondary_frame_catalog_id)
          .filter((item): item is string => Boolean(item)),
      ],
    ),
  );
  const { data: selectedFrames, error: selectedFramesError } =
    selectedFrameIds.length > 0
      ? await supabase
          .from("catalog_frames")
          .select(
            "id, wood_type, style_type, color_group, face_mm, depth_mm, supports_bastidor, lomo_mm, public_label, active",
          )
          .in("id", selectedFrameIds)
      : { data: [], error: null };

  if (selectedFramesError) {
    return serverError("Failed to load quote dependencies.", {
      selectedFrames: selectedFramesError.message,
    });
  }

  const leadItemMap = new Map((leadItems ?? []).map((item) => [item.id, item]));
  const selectedFrameMap = new Map(
    (selectedFrames ?? []).map((frame) => [frame.id, frame]),
  );

  const glassTypeIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.glass_type_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );
  const matboardTypeIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.matboard_type_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );

  const [{ data: glassTypes, error: glassTypesError }, { data: matboardTypes, error: matboardTypesError }] =
    await Promise.all([
      glassTypeIds.length > 0
        ? supabase
            .from("glass_types")
            .select("id, name")
            .in("id", glassTypeIds)
        : Promise.resolve({ data: [], error: null }),
      matboardTypeIds.length > 0
        ? supabase
            .from("matboard_types")
            .select("id, name")
            .in("id", matboardTypeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (glassTypesError || matboardTypesError) {
    return serverError("Failed to load quote accessories.", {
      glassTypes: glassTypesError?.message,
      matboardTypes: matboardTypesError?.message,
    });
  }

  const glassTypeMap = new Map((glassTypes ?? []).map((item) => [item.id, item]));
  const matboardTypeMap = new Map((matboardTypes ?? []).map((item) => [item.id, item]));

  let costMaps: Awaited<ReturnType<typeof loadUnifiedReferenceCosts>>;

  try {
    costMaps = await loadUnifiedReferenceCosts(supabase as unknown as CatalogCostReader, {
      frameCatalogIds: selectedFrameIds,
      glassTypeIds,
      matboardTypeIds,
    });
  } catch (error) {
    if (error instanceof CatalogPricingConfigurationError) {
      return serverError("Pricing catalog is misconfigured.", error.details);
    }

    return serverError("Failed to load quote costs.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return NextResponse.json({
    id: quote.id,
    leadId: quote.lead_id,
    jobId: existingJob?.id ?? null,
    status: quote.status,
    subtotal: Number(quote.subtotal),
    total: Number(quote.total),
    createdAt: quote.created_at,
    approvedAt: quote.approved_at,
    items: (quoteItems ?? []).map((item) => {
      const leadItem = item.lead_item_id ? leadItemMap.get(item.lead_item_id) : null;
      const selectedFrame = selectedFrameMap.get(item.frame_catalog_id);
      const selectedSecondaryFrame =
        leadItem?.bastidor_secondary_frame_catalog_id
          ? selectedFrameMap.get(leadItem.bastidor_secondary_frame_catalog_id)
          : null;
      const glassType = leadItem?.glass_type_id
        ? glassTypeMap.get(leadItem.glass_type_id)
        : null;
      const matboardType = leadItem?.matboard_type_id
        ? matboardTypeMap.get(leadItem.matboard_type_id)
        : null;
      const selectedFrameReferenceCost = selectedFrame
        ? costMaps.frameCostPerMeterByFrameId.get(selectedFrame.id)
        : undefined;
      const selectedSecondaryFrameReferenceCost = selectedSecondaryFrame
        ? costMaps.frameCostPerMeterByFrameId.get(selectedSecondaryFrame.id)
        : undefined;
      const selectedFrameReferencePrice =
        selectedFrameReferenceCost === undefined
          ? undefined
          : deriveReferencePricePerMeter(selectedFrameReferenceCost);
      const selectedSecondaryFrameReferencePrice =
        selectedSecondaryFrameReferenceCost === undefined
          ? undefined
          : deriveReferencePricePerMeter(selectedSecondaryFrameReferenceCost);
      const glassCostPerSquareM =
        leadItem?.glass_type_id
          ? costMaps.glassCostPerSquareMByTypeId.get(leadItem.glass_type_id)
          : undefined;
      const matboardCostPerSquareM =
        leadItem?.matboard_type_id
          ? costMaps.matboardCostPerSquareMByTypeId.get(leadItem.matboard_type_id)
          : undefined;
      const quantity = Number(item.quantity);

      let unitAutoPrice: number | null = null;
      let unitAutoCost: number | null = null;
      let perimeterCm: number | null = null;
      let source: "calculated" | "manual_edit" | "unknown" = "unknown";

      if (leadItem && selectedFrame) {
        const pricing = calculatePreliminaryPricing({
          widthCm: Number(leadItem.width_cm),
          heightCm: Number(leadItem.height_cm),
          quantity,
          hasGlass: Boolean(leadItem.has_glass),
          hasMatboard: Boolean(leadItem.has_matboard),
          matboardBorderCm: leadItem.has_matboard
            ? Number(leadItem.matboard_border_cm ?? 0)
            : undefined,
          assemblyMode: leadItem.assembly_mode ?? "normal",
          bastidor:
            leadItem.assembly_mode === "bastidor" &&
            leadItem.bastidor_variant &&
            leadItem.bastidor_light_cm !== null &&
            leadItem.bastidor_support_mm !== null &&
            leadItem.bastidor_lomo_mm !== null &&
            leadItem.bastidor_depth_mm !== null
              ? {
                  variant: leadItem.bastidor_variant,
                  lightCm: Number(leadItem.bastidor_light_cm),
                  supportMm: Number(leadItem.bastidor_support_mm),
                  lomoMm: Number(leadItem.bastidor_lomo_mm),
                  depthMm: Number(leadItem.bastidor_depth_mm),
                  secondaryFrameId: leadItem.bastidor_secondary_frame_catalog_id ?? null,
                }
              : null,
          frame: {
            id: selectedFrame.id,
            faceMm: Number(selectedFrame.face_mm),
            referencePricePerMeter: selectedFrameReferencePrice ?? 0,
            referenceCostPerMeter:
              selectedFrameReferenceCost ?? 0,
            secondaryFrame: selectedSecondaryFrame
              ? {
                  id: selectedSecondaryFrame.id,
                  referencePricePerMeter: selectedSecondaryFrameReferencePrice ?? 0,
                  referenceCostPerMeter: selectedSecondaryFrameReferenceCost ?? 0,
                }
              : null,
          },
          glassCostPerSquareM,
          matboardCostPerSquareM,
        });

        unitAutoPrice = quantity > 0 ? round2(pricing.preliminaryPrice / quantity) : 0;
        unitAutoCost = quantity > 0 ? round2(pricing.projectedCost / quantity) : 0;
        perimeterCm = pricing.perimeterCm;

        const hasManualDiff =
          Math.abs(unitAutoPrice - Number(item.unit_price)) > PRICE_SOURCE_EPSILON ||
          Math.abs(unitAutoCost - Number(item.unit_projected_cost)) > PRICE_SOURCE_EPSILON;

        source = hasManualDiff ? "manual_edit" : "calculated";
      }

      return {
        id: item.id,
        leadItemId: item.lead_item_id,
        frameCatalogId: item.frame_catalog_id,
        unitPrice: Number(item.unit_price),
        unitProjectedCost: Number(item.unit_projected_cost),
        unitProjectedMargin: Number(item.unit_projected_margin),
        quantity,
        widthCm: leadItem ? Number(leadItem.width_cm) : null,
        heightCm: leadItem ? Number(leadItem.height_cm) : null,
        hasGlass: leadItem?.has_glass ?? false,
        hasMatboard: leadItem?.has_matboard ?? false,
        matboardBorderCm: leadItem
          ? leadItem.matboard_border_cm === null
            ? null
            : Number(leadItem.matboard_border_cm)
          : null,
        glassTypeId: leadItem?.glass_type_id ?? null,
        matboardTypeId: leadItem?.matboard_type_id ?? null,
        requestedWoodType: leadItem?.wood_type ?? null,
        requestedStyleType: leadItem?.style_type ?? null,
        requestedColorGroup: leadItem?.color_group ?? null,
        requestedFinishColorHex: leadItem?.finish_color_hex ?? null,
        requestedFinishColorName: leadItem?.finish_color_name ?? null,
        requestedFaceMm: leadItem ? Number(leadItem.face_mm) : null,
        requestedDepthMm: leadItem ? Number(leadItem.depth_mm) : null,
        assemblyMode: leadItem?.assembly_mode ?? "normal",
        bastidorVariant: leadItem?.bastidor_variant ?? null,
        bastidorLightCm:
          leadItem?.bastidor_light_cm === null || leadItem?.bastidor_light_cm === undefined
            ? null
            : Number(leadItem.bastidor_light_cm),
        bastidorSecondaryFrameCatalogId: leadItem?.bastidor_secondary_frame_catalog_id ?? null,
        bastidorSupportMm:
          leadItem?.bastidor_support_mm === null || leadItem?.bastidor_support_mm === undefined
            ? null
            : Number(leadItem.bastidor_support_mm),
        bastidorLomoMm:
          leadItem?.bastidor_lomo_mm === null || leadItem?.bastidor_lomo_mm === undefined
            ? null
            : Number(leadItem.bastidor_lomo_mm),
        bastidorDepthMm:
          leadItem?.bastidor_depth_mm === null || leadItem?.bastidor_depth_mm === undefined
            ? null
            : Number(leadItem.bastidor_depth_mm),
        requiredMouldingCm: leadItem ? Number(leadItem.required_moulding_cm) : null,
        requiredMouldingM: leadItem ? Number(leadItem.required_moulding_m) : null,
        perimeterCm,
        glassTypeName: glassType?.name ?? null,
        glassCostPerSquareM: glassCostPerSquareM ?? null,
        matboardTypeName: matboardType?.name ?? null,
        matboardCostPerSquareM: matboardCostPerSquareM ?? null,
        laborCostPerCm: LABOR_COST_PER_CM,
        unitAutoPrice,
        unitAutoCost,
        pricingSource: source,
        selectedFrame: selectedFrame
          ? {
              id: selectedFrame.id,
              label:
                selectedFrame.public_label ??
                `${titleize(selectedFrame.wood_type)} ${selectedFrame.face_mm}x${selectedFrame.depth_mm}`,
              woodType: selectedFrame.wood_type,
              styleType: selectedFrame.style_type,
              colorGroup: selectedFrame.color_group,
              faceMm: Number(selectedFrame.face_mm),
              depthMm: Number(selectedFrame.depth_mm),
              referencePricePerMeter: selectedFrameReferencePrice ?? 0,
              referenceCostPerMeter:
                selectedFrameReferenceCost ?? 0,
              active: selectedFrame.active,
              supportsBastidor: Boolean(selectedFrame.supports_bastidor),
              lomoMm:
                selectedFrame.lomo_mm === null || selectedFrame.lomo_mm === undefined
                  ? null
                  : Number(selectedFrame.lomo_mm),
            }
          : null,
        selectedSecondaryFrame: selectedSecondaryFrame
          ? {
              id: selectedSecondaryFrame.id,
              label:
                selectedSecondaryFrame.public_label ??
                `${titleize(selectedSecondaryFrame.wood_type)} ${selectedSecondaryFrame.face_mm}x${selectedSecondaryFrame.depth_mm}`,
              woodType: selectedSecondaryFrame.wood_type,
              styleType: selectedSecondaryFrame.style_type,
              colorGroup: selectedSecondaryFrame.color_group,
              faceMm: Number(selectedSecondaryFrame.face_mm),
              depthMm: Number(selectedSecondaryFrame.depth_mm),
              referencePricePerMeter: selectedSecondaryFrameReferencePrice ?? 0,
              referenceCostPerMeter: selectedSecondaryFrameReferenceCost ?? 0,
              active: selectedSecondaryFrame.active,
              supportsBastidor: Boolean(selectedSecondaryFrame.supports_bastidor),
              lomoMm:
                selectedSecondaryFrame.lomo_mm === null || selectedSecondaryFrame.lomo_mm === undefined
                  ? null
                  : Number(selectedSecondaryFrame.lomo_mm),
            }
          : null,
      };
    }),
    activeFrames: (activeFrames ?? []).map((frame) => ({
      id: frame.id,
      woodType: frame.wood_type,
      styleType: frame.style_type,
      colorGroup: frame.color_group,
      faceMm: Number(frame.face_mm),
      depthMm: Number(frame.depth_mm),
      supportsBastidor: Boolean(frame.supports_bastidor),
      lomoMm:
        frame.lomo_mm === null || frame.lomo_mm === undefined
          ? null
          : Number(frame.lomo_mm),
      label: frame.public_label,
    })),
  });
}
