import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { deriveSimpleBastidorSnapshot } from "@/lib/pricing/frame-geometry";
import { calculatePreliminaryPricing } from "@/lib/pricing/preliminary";
import {
  type CatalogCostReader,
  CatalogPricingConfigurationError,
  loadUnifiedReferenceCosts,
} from "@/lib/pricing/unified-costs";
import { deriveReferencePricePerMeter } from "@/lib/pricing/catalog-price";
import { recalculateQuoteTotals } from "@/lib/quotes/totals";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  quoteItemId: z.string().uuid(),
  frameCatalogId: z.string().uuid(),
  bastidorSecondaryFrameId: z.string().uuid().nullable().optional(),
});

type FrameRow = {
  id: string;
  wood_type: string;
  style_type: string;
  color_group: string;
  face_mm: number | string;
  depth_mm: number | string;
  supports_bastidor: boolean;
  lomo_mm: number | string | null;
  active: boolean;
};

function requireBastidorSupport(frame: FrameRow, label: string) {
  if (!frame.supports_bastidor) {
    throw new Error(`${label} no esta habilitada para bastidor.`);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: quoteId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: quote, error: quoteError }, { data: quoteItem, error: quoteItemError }] =
    await Promise.all([
      supabase.from("quotes").select("id, status").eq("id", quoteId).single(),
      supabase
        .from("quote_items")
        .select("id, quote_id, lead_item_id, quantity")
        .eq("id", parsed.data.quoteItemId)
        .eq("quote_id", quoteId)
        .single(),
    ]);

  if (quoteError) {
    if (quoteError.code === "PGRST116") {
      return notFound("Quote not found.");
    }

    return serverError("Failed to load quote.", quoteError.message);
  }

  if (quote.status === "quote_approved" || quote.status === "quote_rejected") {
    return badRequest("Cannot override frame for a finalized quote.");
  }

  if (quoteItemError) {
    if (quoteItemError.code === "PGRST116") {
      return notFound("Quote item not found in this quote.");
    }

    return serverError("Failed to load quote item.", quoteItemError.message);
  }

  if (!quoteItem.lead_item_id) {
    return badRequest("Quote item has no linked lead item.");
  }

  const { data: leadItem, error: leadItemError } = await supabase
    .from("lead_items")
    .select(
      "id, width_cm, height_cm, quantity, has_glass, has_matboard, matboard_border_cm, glass_type_id, matboard_type_id, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm",
    )
    .eq("id", quoteItem.lead_item_id)
    .single();

  if (leadItemError) {
    return serverError("Failed to load override dependencies.", {
      leadItem: leadItemError.message,
    });
  }

  const assemblyMode = leadItem.assembly_mode ?? "normal";
  const nextSecondaryFrameId =
    assemblyMode === "bastidor" && leadItem.bastidor_variant === "double_profile"
      ? parsed.data.bastidorSecondaryFrameId ??
        leadItem.bastidor_secondary_frame_catalog_id ??
        null
      : null;

  const frameIds = [
    parsed.data.frameCatalogId,
    ...(nextSecondaryFrameId ? [nextSecondaryFrameId] : []),
  ];

  const { data: frames, error: framesError } = await supabase
    .from("catalog_frames")
    .select(
      "id, wood_type, style_type, color_group, face_mm, depth_mm, supports_bastidor, lomo_mm, active",
    )
    .in("id", frameIds)
    .eq("active", true);

  if (framesError) {
    return serverError("Failed to load override dependencies.", {
      frame: framesError.message,
    });
  }

  const frameById = new Map(
    (frames ?? []).map((frame) => [frame.id, frame as FrameRow]),
  );
  const frame = frameById.get(parsed.data.frameCatalogId);

  if (!frame) {
    return badRequest("Selected primary frame is missing or inactive.");
  }

  const secondaryFrame = nextSecondaryFrameId
    ? frameById.get(nextSecondaryFrameId) ?? null
    : null;

  if (nextSecondaryFrameId && !secondaryFrame) {
    return badRequest("Selected secondary frame is missing or inactive.");
  }

  let bastidorSnapshot = null;

  try {
    if (assemblyMode === "bastidor" && leadItem.bastidor_variant === "simple") {
      requireBastidorSupport(frame, "La varilla principal");

      const snapshot = deriveSimpleBastidorSnapshot(
        {
          id: frame.id,
          faceMm: Number(frame.face_mm),
          depthMm: Number(frame.depth_mm),
          lomoMm:
            frame.lomo_mm === null || frame.lomo_mm === undefined
              ? null
              : Number(frame.lomo_mm),
        },
        Number(leadItem.bastidor_light_cm ?? 0),
      );

      if (!snapshot) {
        throw new Error("La varilla principal no tiene lomo valido para bastidor simple.");
      }

      bastidorSnapshot = snapshot;
    }

    if (assemblyMode === "bastidor" && leadItem.bastidor_variant === "double_profile") {
      requireBastidorSupport(frame, "La varilla principal");

      if (!secondaryFrame) {
        throw new Error("Falta seleccionar la segunda varilla para bastidor de dos varillas.");
      }

      requireBastidorSupport(secondaryFrame, "La segunda varilla");
      const primarySnapshot = deriveSimpleBastidorSnapshot(
        {
          id: frame.id,
          faceMm: Number(frame.face_mm),
          depthMm: Number(frame.depth_mm),
          lomoMm:
            frame.lomo_mm === null || frame.lomo_mm === undefined
              ? null
              : Number(frame.lomo_mm),
        },
        Number(leadItem.bastidor_light_cm ?? 0),
      );

      if (!primarySnapshot) {
        throw new Error("La varilla principal no tiene lomo valido para bastidor.");
      }

      bastidorSnapshot = {
        variant: "double_profile" as const,
        lightCm: primarySnapshot.lightCm,
        supportMm: primarySnapshot.supportMm,
        lomoMm: primarySnapshot.lomoMm,
        depthMm: primarySnapshot.depthMm,
        secondaryFrameId: secondaryFrame.id,
      };
    }
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid bastidor override.");
  }

  let costMaps: Awaited<ReturnType<typeof loadUnifiedReferenceCosts>>;

  try {
    costMaps = await loadUnifiedReferenceCosts(supabase as unknown as CatalogCostReader, {
      frameCatalogIds: [
        frame.id,
        ...(secondaryFrame ? [secondaryFrame.id] : []),
      ],
      glassTypeIds: leadItem.glass_type_id ? [leadItem.glass_type_id] : [],
      matboardTypeIds: leadItem.matboard_type_id ? [leadItem.matboard_type_id] : [],
    });
  } catch (error) {
    if (error instanceof CatalogPricingConfigurationError) {
      return serverError("Pricing catalog is misconfigured.", error.details);
    }

    return serverError("Failed to load override costs.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const frameCostPerMeter = costMaps.frameCostPerMeterByFrameId.get(frame.id);

  if (frameCostPerMeter === undefined) {
    return serverError("Pricing catalog is misconfigured.", {
      message: `No reference cost metric found for frame ${frame.id}.`,
    });
  }

  const secondaryFrameCostPerMeter = secondaryFrame
    ? costMaps.frameCostPerMeterByFrameId.get(secondaryFrame.id)
    : undefined;

  if (secondaryFrame && secondaryFrameCostPerMeter === undefined) {
    return serverError("Pricing catalog is misconfigured.", {
      message: `No reference cost metric found for frame ${secondaryFrame.id}.`,
    });
  }

  const glassCostPerSquareM = leadItem.glass_type_id
    ? costMaps.glassCostPerSquareMByTypeId.get(leadItem.glass_type_id)
    : undefined;
  const matboardCostPerSquareM = leadItem.matboard_type_id
    ? costMaps.matboardCostPerSquareMByTypeId.get(leadItem.matboard_type_id)
    : undefined;

  if (leadItem.glass_type_id && glassCostPerSquareM === undefined) {
    return serverError("Pricing catalog is misconfigured.", {
      message: `No reference cost metric found for glass ${leadItem.glass_type_id}.`,
    });
  }

  if (leadItem.matboard_type_id && matboardCostPerSquareM === undefined) {
    return serverError("Pricing catalog is misconfigured.", {
      message: `No reference cost metric found for matboard ${leadItem.matboard_type_id}.`,
    });
  }

  const pricing = calculatePreliminaryPricing({
    widthCm: Number(leadItem.width_cm),
    heightCm: Number(leadItem.height_cm),
    quantity: Number(quoteItem.quantity),
    hasGlass: Boolean(leadItem.has_glass),
    hasMatboard: Boolean(leadItem.has_matboard),
    matboardBorderCm: leadItem.has_matboard
      ? Number(leadItem.matboard_border_cm ?? 0)
      : undefined,
    assemblyMode,
    bastidor: bastidorSnapshot,
    frame: {
      id: frame.id,
      faceMm: Number(frame.face_mm),
      referencePricePerMeter: deriveReferencePricePerMeter(frameCostPerMeter),
      referenceCostPerMeter: frameCostPerMeter,
      secondaryFrame: secondaryFrame
        ? {
            id: secondaryFrame.id,
            referencePricePerMeter: deriveReferencePricePerMeter(
              secondaryFrameCostPerMeter ?? 0,
            ),
            referenceCostPerMeter: secondaryFrameCostPerMeter ?? 0,
          }
        : null,
    },
    glassCostPerSquareM,
    matboardCostPerSquareM,
  });

  const quantity = Number(quoteItem.quantity);
  const newUnitProjectedCost = quantity > 0 ? pricing.projectedCost / quantity : 0;
  const newUnitPrice = quantity > 0 ? pricing.preliminaryPrice / quantity : 0;

  const { error: updateError } = await supabase
    .from("quote_items")
    .update({
      frame_catalog_id: parsed.data.frameCatalogId,
      unit_projected_cost: newUnitProjectedCost,
      unit_price: newUnitPrice,
      unit_projected_margin: newUnitPrice - newUnitProjectedCost,
    })
    .eq("id", quoteItem.id);

  if (updateError) {
    return serverError("Failed to update quote item frame override.", updateError.message);
  }

  const { error: leadUpdateError } = await supabase
    .from("lead_items")
    .update({
      frame_catalog_id: parsed.data.frameCatalogId,
      wood_type: frame.wood_type,
      style_type: frame.style_type,
      color_group: frame.color_group,
      face_mm: frame.face_mm,
      depth_mm: frame.depth_mm,
      required_moulding_cm: pricing.requiredMouldingCm,
      required_moulding_m: pricing.requiredMouldingM,
      frame_cost: pricing.frameCost,
      glass_cost: pricing.glassCost,
      matboard_cost: pricing.matboardCost,
      labor_cost: pricing.laborCost,
      projected_cost: pricing.projectedCost,
      preliminary_price: pricing.preliminaryPrice,
      assembly_mode: assemblyMode,
      bastidor_variant: bastidorSnapshot?.variant ?? null,
      bastidor_light_cm: bastidorSnapshot?.lightCm ?? null,
      bastidor_secondary_frame_catalog_id: bastidorSnapshot?.secondaryFrameId ?? null,
      bastidor_support_mm: bastidorSnapshot?.supportMm ?? null,
      bastidor_lomo_mm: bastidorSnapshot?.lomoMm ?? null,
      bastidor_depth_mm: bastidorSnapshot?.depthMm ?? null,
    })
    .eq("id", quoteItem.lead_item_id);

  if (leadUpdateError) {
    return serverError(
      "Quote item updated but failed to sync lead item curated frame.",
      leadUpdateError.message,
    );
  }

  try {
    const totals = await recalculateQuoteTotals(supabase, quoteId);

    return NextResponse.json({
      success: true,
      quoteId,
      quoteItemId: quoteItem.id,
      totals,
    });
  } catch (error) {
    return serverError("Quote item updated but failed to recalculate quote totals.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
