import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ASSEMBLY_MODES,
  BASTIDOR_VARIANTS,
  type BastidorSnapshot,
  type MatchedProfile,
} from "@/types/domain";
import { COLOR_GROUPS, STYLE_CODES } from "@/lib/catalog/taxonomy";
import {
  AmbiguousExactProfileMatchError,
  MissingExactProfileMatchError,
  isMissingBastidorCatalogFrameColumnsError,
  normalizeWoodType,
  resolveExactProfileBySelection,
} from "@/lib/matching/exact-profile-match";
import { deriveSimpleBastidorSnapshot } from "@/lib/pricing/frame-geometry";
import { calculatePreliminaryPricing } from "@/lib/pricing/preliminary";
import {
  type CatalogCostReader,
  CatalogPricingConfigurationError,
  loadUnifiedReferenceCosts,
} from "@/lib/pricing/unified-costs";
import { deriveReferencePricePerMeter } from "@/lib/pricing/catalog-price";
import { calculateLeadPreliminaryTotal } from "@/lib/pricing/lead-total";
import { ensureBastidorCompatible, leadItemSchema } from "@/lib/public-leads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildLeadWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { badRequest, serverError } from "@/lib/http/responses";
const REQUIRED_LEAD_ITEM_SNAPSHOT_COLUMNS = [
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
] as const;
const REQUIRED_LEAD_ITEM_MIGRATIONS = [
  "202603181030_lead_items_matboard_border.sql",
  "202603181730_catalog_v2_style_finish_color.sql",
  "202603201900_lead_items_cost_snapshot.sql",
  "202604021130_bastidor_support.sql",
] as const;

type LeadItemInsertRow = {
  lead_id: string;
  width_cm: number;
  height_cm: number;
  quantity: number;
  frame_catalog_id: string;
  wood_type: string;
  style_type: (typeof STYLE_CODES)[number];
  color_group: (typeof COLOR_GROUPS)[number];
  finish_color_hex: string | null;
  finish_color_name: string | null;
  face_mm: number;
  depth_mm: number;
  has_glass: boolean;
  has_matboard: boolean;
  matboard_border_cm: number | null;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  uploaded_image_url: string | null;
  required_moulding_cm: number;
  required_moulding_m: number;
  frame_cost: number;
  glass_cost: number;
  matboard_cost: number;
  labor_cost: number;
  projected_cost: number;
  preliminary_price: number;
  assembly_mode: (typeof ASSEMBLY_MODES)[number];
  bastidor_variant: (typeof BASTIDOR_VARIANTS)[number] | null;
  bastidor_light_cm: number | null;
  bastidor_secondary_frame_catalog_id: string | null;
  bastidor_support_mm: number | null;
  bastidor_lomo_mm: number | null;
  bastidor_depth_mm: number | null;
  render_url: string | null;
};

type PublicFrameRow = {
  id: string;
  wood_type: string;
  style_type: (typeof STYLE_CODES)[number];
  color_group: (typeof COLOR_GROUPS)[number];
  face_mm: number | string;
  depth_mm: number | string;
  public_label: string | null;
  supports_bastidor?: boolean | null;
  lomo_mm?: number | string | null;
};

function isMissingLegacyLeadItemsColumnsError(error: { code?: string | null; message?: string | null }) {
  if (!error.message) {
    return false;
  }

  if (error.code !== "PGRST204" && error.code !== "42703") {
    return false;
  }

  const message = error.message.toLowerCase();

  return REQUIRED_LEAD_ITEM_SNAPSHOT_COLUMNS.some((column) =>
    message.includes(`'${column}'`) ||
    message.includes(`.${column}`) ||
    message.includes(column),
  );
}

function mapPublicFrameRow(row: PublicFrameRow): MatchedProfile {
  return {
    id: row.id,
    woodType: row.wood_type,
    styleType: row.style_type,
    colorGroup: row.color_group,
    faceMm: Number(row.face_mm),
    depthMm: Number(row.depth_mm),
    referencePricePerMeter: 0,
    referenceCostPerMeter: 0,
    publicLabel: row.public_label,
    supportsBastidor: Boolean(row.supports_bastidor),
    lomoMm:
      row.lomo_mm === null || row.lomo_mm === undefined ? null : Number(row.lomo_mm),
  };
}

function buildDoubleProfileBastidorSnapshot(
  primaryFrame: Pick<MatchedProfile, "id" | "faceMm" | "depthMm" | "lomoMm">,
  lightCm: number,
  secondaryFrameId: string,
): BastidorSnapshot | null {
  const snapshot = deriveSimpleBastidorSnapshot(
    {
      id: primaryFrame.id,
      faceMm: primaryFrame.faceMm,
      depthMm: primaryFrame.depthMm,
      lomoMm: primaryFrame.lomoMm,
    },
    lightCm,
  );

  if (!snapshot) {
    return null;
  }

  return {
    variant: "double_profile",
    lightCm: snapshot.lightCm,
    supportMm: snapshot.supportMm,
    lomoMm: snapshot.lomoMm,
    depthMm: snapshot.depthMm,
    secondaryFrameId,
  };
}

async function loadPublicFramesByIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  frameIds: string[],
): Promise<Map<string, MatchedProfile>> {
  if (frameIds.length === 0) {
    return new Map();
  }

  const baseQuery = (columns: string) =>
    supabase
      .from("catalog_frames")
      .select(columns)
      .eq("active", true)
      .eq("is_public", true)
      .in("id", frameIds);

  let { data, error } = await baseQuery(
    "id, wood_type, style_type, color_group, face_mm, depth_mm, public_label, supports_bastidor, lomo_mm",
  );

  if (error && isMissingBastidorCatalogFrameColumnsError(error)) {
    ({ data, error } = await baseQuery(
      "id, wood_type, style_type, color_group, face_mm, depth_mm, public_label",
    ));
  }

  if (error) {
    throw new Error(`Failed to load public frame catalog: ${error.message}`);
  }

  return new Map(
    (((data ?? []) as unknown) as PublicFrameRow[]).map((row: PublicFrameRow) => [
      row.id,
      mapPublicFrameRow(row),
    ]),
  );
}

const createLeadSchema = z.object({
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(6),
  customerEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
  items: z.array(leadItemSchema).min(1),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = createLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const glassIds = Array.from(
    new Set(
      parsed.data.items
        .map((item) => item.glassTypeId ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const matboardIds = Array.from(
    new Set(
      parsed.data.items
        .map((item) => item.matboardTypeId ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const matchedItems: Array<{
    input: z.infer<typeof leadItemSchema>;
    frame: Awaited<ReturnType<typeof resolveExactProfileBySelection>>;
  }> = [];

  try {
    for (const item of parsed.data.items) {
      const frame = await resolveExactProfileBySelection(
        supabase,
        {
          woodType: item.woodType,
          styleType: item.styleType,
          colorGroup: item.colorGroup,
          faceMm: item.faceMm,
          depthMm: item.depthMm,
        },
        true,
      );

      matchedItems.push({ input: item, frame });
    }
  } catch (error) {
    if (error instanceof MissingExactProfileMatchError) {
      return badRequest(error.message);
    }

    if (error instanceof AmbiguousExactProfileMatchError) {
      return badRequest(error.message);
    }

    return serverError("Failed to resolve exact frame match.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const secondaryFrameIds = Array.from(
    new Set(
      matchedItems
        .map((item) =>
          item.input.assemblyMode === "bastidor" &&
          item.input.bastidorVariant === "double_profile"
            ? item.input.bastidorSecondaryFrameId ?? null
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let secondaryFrameById: Map<string, MatchedProfile>;

  try {
    secondaryFrameById = await loadPublicFramesByIds(supabase, secondaryFrameIds);
  } catch (error) {
    return serverError("Failed to load bastidor secondary frames.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const configuredItems: Array<{
    input: z.infer<typeof leadItemSchema>;
    frame: MatchedProfile;
    secondaryFrame: MatchedProfile | null;
    bastidorSnapshot: BastidorSnapshot | null;
  }> = [];

  try {
    for (const item of matchedItems) {
      if (item.input.assemblyMode !== "bastidor") {
        configuredItems.push({
          input: item.input,
          frame: item.frame,
          secondaryFrame: null,
          bastidorSnapshot: null,
        });
        continue;
      }

      ensureBastidorCompatible(item.frame, "La varilla principal");

      if (item.input.bastidorVariant === "simple") {
        const snapshot = deriveSimpleBastidorSnapshot(
          {
            id: item.frame.id,
            faceMm: item.frame.faceMm,
            depthMm: item.frame.depthMm,
            lomoMm: item.frame.lomoMm,
          },
          item.input.bastidorLightCm ?? 0,
        );

        if (!snapshot) {
          throw new Error("La varilla principal no tiene lomo configurado para bastidor simple.");
        }

        configuredItems.push({
          input: item.input,
          frame: item.frame,
          secondaryFrame: null,
          bastidorSnapshot: snapshot,
        });
        continue;
      }

      const secondaryFrameId = item.input.bastidorSecondaryFrameId ?? "";
      const secondaryFrame = secondaryFrameById.get(secondaryFrameId);

      if (!secondaryFrame) {
        throw new Error("La segunda varilla de bastidor no existe o no esta publicada.");
      }

      ensureBastidorCompatible(secondaryFrame, "La segunda varilla");

      const snapshot = buildDoubleProfileBastidorSnapshot(
        item.frame,
        item.input.bastidorLightCm ?? 0,
        secondaryFrame.id,
      );

      if (!snapshot) {
        throw new Error("La varilla principal no tiene lomo configurado para bastidor.");
      }

      configuredItems.push({
        input: item.input,
        frame: item.frame,
        secondaryFrame,
        bastidorSnapshot: snapshot,
      });
    }
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Configuracion de bastidor invalida.");
  }

  const frameIds = Array.from(
    new Set(
      configuredItems.flatMap((item) =>
        item.secondaryFrame ? [item.frame.id, item.secondaryFrame.id] : [item.frame.id],
      ),
    ),
  );

  let costMaps: Awaited<ReturnType<typeof loadUnifiedReferenceCosts>>;

  try {
    costMaps = await loadUnifiedReferenceCosts(supabase as unknown as CatalogCostReader, {
      frameCatalogIds: frameIds,
      glassTypeIds: glassIds,
      matboardTypeIds: matboardIds,
    });
  } catch (error) {
    if (error instanceof CatalogPricingConfigurationError) {
      return serverError("Pricing catalog is misconfigured.", error.details);
    }

    return serverError("Failed to load catalog costs.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const resolvedItems: Array<{
    input: z.infer<typeof leadItemSchema>;
    frameId: string;
    woodType: string;
    styleType: z.infer<typeof leadItemSchema>["styleType"];
    colorGroup: z.infer<typeof leadItemSchema>["colorGroup"];
    finishColorHex: string | null;
    finishColorName: string | null;
    faceMm: number;
    depthMm: number;
    requiredMouldingCm: number;
    requiredMouldingM: number;
    frameCost: number;
    glassCost: number;
    matboardCost: number;
    laborCost: number;
    projectedCost: number;
    preliminaryPrice: number;
    assemblyMode: z.infer<typeof leadItemSchema>["assemblyMode"];
    bastidorVariant: BastidorSnapshot["variant"] | null;
    bastidorLightCm: number | null;
    bastidorSecondaryFrameId: string | null;
    bastidorSupportMm: number | null;
    bastidorLomoMm: number | null;
    bastidorDepthMm: number | null;
  }> = [];

  for (const item of configuredItems) {
    const frameCostPerMeter = costMaps.frameCostPerMeterByFrameId.get(item.frame.id);

    if (frameCostPerMeter === undefined) {
      return serverError("Pricing catalog is misconfigured.", {
        message: `No reference cost metric found for frame ${item.frame.id}.`,
      });
    }

    const secondaryFrameCostPerMeter = item.secondaryFrame
      ? costMaps.frameCostPerMeterByFrameId.get(item.secondaryFrame.id)
      : undefined;

    if (item.secondaryFrame && secondaryFrameCostPerMeter === undefined) {
      return serverError("Pricing catalog is misconfigured.", {
        message: `No reference cost metric found for frame ${item.secondaryFrame.id}.`,
      });
    }

    const glassCostPerSquareM = item.input.glassTypeId
      ? costMaps.glassCostPerSquareMByTypeId.get(item.input.glassTypeId)
      : undefined;
    const matboardCostPerSquareM = item.input.matboardTypeId
      ? costMaps.matboardCostPerSquareMByTypeId.get(item.input.matboardTypeId)
      : undefined;

    if (item.input.glassTypeId && glassCostPerSquareM === undefined) {
      return serverError("Pricing catalog is misconfigured.", {
        message: `No reference cost metric found for glass ${item.input.glassTypeId}.`,
      });
    }

    if (item.input.matboardTypeId && matboardCostPerSquareM === undefined) {
      return serverError("Pricing catalog is misconfigured.", {
        message: `No reference cost metric found for matboard ${item.input.matboardTypeId}.`,
      });
    }

    const pricing = calculatePreliminaryPricing({
      widthCm: item.input.widthCm,
      heightCm: item.input.heightCm,
      quantity: item.input.quantity,
      hasGlass: item.input.hasGlass,
      hasMatboard: item.input.hasMatboard,
      matboardBorderCm: item.input.hasMatboard
        ? item.input.matboardBorderCm ?? undefined
        : undefined,
      assemblyMode: item.input.assemblyMode,
      bastidor: item.bastidorSnapshot,
      frame: {
        id: item.frame.id,
        faceMm: item.frame.faceMm,
        referencePricePerMeter: deriveReferencePricePerMeter(frameCostPerMeter),
        referenceCostPerMeter: frameCostPerMeter,
        secondaryFrame: item.secondaryFrame
          ? {
              id: item.secondaryFrame.id,
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

    resolvedItems.push({
      input: item.input,
      frameId: item.frame.id,
      woodType: item.frame.woodType,
      styleType: item.frame.styleType,
      colorGroup: item.frame.colorGroup,
      finishColorHex:
        item.input.colorGroup === "color"
          ? item.input.finishColorHex ?? null
          : null,
      finishColorName:
        item.input.colorGroup === "color"
          ? item.input.finishColorName?.trim() || null
          : null,
      faceMm: item.frame.faceMm,
      depthMm: item.frame.depthMm,
      requiredMouldingCm: pricing.requiredMouldingCm,
      requiredMouldingM: pricing.requiredMouldingM,
      frameCost: pricing.frameCost,
      glassCost: pricing.glassCost,
      matboardCost: pricing.matboardCost,
      laborCost: pricing.laborCost,
      projectedCost: pricing.projectedCost,
      preliminaryPrice: pricing.preliminaryPrice,
      assemblyMode: item.input.assemblyMode,
      bastidorVariant: item.bastidorSnapshot?.variant ?? null,
      bastidorLightCm: item.bastidorSnapshot?.lightCm ?? null,
      bastidorSecondaryFrameId: item.bastidorSnapshot?.secondaryFrameId ?? null,
      bastidorSupportMm: item.bastidorSnapshot?.supportMm ?? null,
      bastidorLomoMm: item.bastidorSnapshot?.lomoMm ?? null,
      bastidorDepthMm: item.bastidorSnapshot?.depthMm ?? null,
    });
  }

  const preliminaryTotal = calculateLeadPreliminaryTotal(resolvedItems);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer_name: parsed.data.customerName,
      customer_phone: parsed.data.customerPhone,
      customer_email: parsed.data.customerEmail || null,
      notes: parsed.data.notes || null,
      status: "lead_new",
      preliminary_total: preliminaryTotal,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return serverError("Failed to create lead.", leadError?.message);
  }

  const leadItemsRows: LeadItemInsertRow[] = resolvedItems.map((item) => ({
    lead_id: lead.id,
    width_cm: item.input.widthCm,
    height_cm: item.input.heightCm,
    quantity: item.input.quantity,
    frame_catalog_id: item.frameId,
    wood_type: normalizeWoodType(item.woodType),
    style_type: item.styleType,
    color_group: item.colorGroup,
    finish_color_hex: item.finishColorHex,
    finish_color_name: item.finishColorName,
    face_mm: item.faceMm,
    depth_mm: item.depthMm,
    has_glass: item.input.hasGlass,
    has_matboard: item.input.hasMatboard,
    matboard_border_cm: item.input.hasMatboard ? item.input.matboardBorderCm ?? null : null,
    glass_type_id: item.input.glassTypeId ?? null,
    matboard_type_id: item.input.matboardTypeId ?? null,
    uploaded_image_url: item.input.uploadedImageUrl ?? null,
    required_moulding_cm: item.requiredMouldingCm,
    required_moulding_m: item.requiredMouldingM,
    frame_cost: item.frameCost,
    glass_cost: item.glassCost,
    matboard_cost: item.matboardCost,
    labor_cost: item.laborCost,
    projected_cost: item.projectedCost,
    preliminary_price: item.preliminaryPrice,
    assembly_mode: item.assemblyMode,
    bastidor_variant: item.bastidorVariant,
    bastidor_light_cm: item.bastidorLightCm,
    bastidor_secondary_frame_catalog_id: item.bastidorSecondaryFrameId,
    bastidor_support_mm: item.bastidorSupportMm,
    bastidor_lomo_mm: item.bastidorLomoMm,
    bastidor_depth_mm: item.bastidorDepthMm,
    render_url: item.input.renderUrl ?? null,
  }));

  const { error: leadItemsError } = await supabase.from("lead_items").insert(leadItemsRows);

  const leadItemsErrorDetails =
    leadItemsError && isMissingLegacyLeadItemsColumnsError(leadItemsError)
      ? {
          message:
            "lead_items schema is outdated. The configurator requires full snapshot columns to persist matboard border, bastidor geometry and component costs.",
          missingColumns: REQUIRED_LEAD_ITEM_SNAPSHOT_COLUMNS,
          requiredMigrations: REQUIRED_LEAD_ITEM_MIGRATIONS,
          originalError: leadItemsError.message,
        }
      : leadItemsError?.message;

  if (leadItemsError) {
    const { error: rollbackError } = await supabase
      .from("leads")
      .delete()
      .eq("id", lead.id);

    if (rollbackError) {
      return serverError("Lead created but lead items failed.", {
        leadItems: leadItemsErrorDetails,
        rollback: rollbackError.message,
        leadId: lead.id,
      });
    }

    return serverError("Failed to create lead.", leadItemsErrorDetails);
  }

  const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP;
  const whatsappMessage = buildLeadWhatsAppMessage({
    leadId: lead.id,
    customerName: parsed.data.customerName,
    preliminaryTotal,
  });
  const whatsappUrl = businessPhone
    ? buildWhatsAppUrl(businessPhone, whatsappMessage)
    : null;

  return NextResponse.json({
    leadId: lead.id,
    preliminaryTotal,
    whatsappUrl,
    orientativeNotice:
      "Este presupuesto es preliminar y orientativo. El valor final puede variar por stock, terminacion y costos actualizados.",
  });
}
