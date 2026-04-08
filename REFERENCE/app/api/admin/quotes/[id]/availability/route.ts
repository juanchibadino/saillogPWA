import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { calculateFrameGeometry } from "@/lib/pricing/frame-geometry";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BastidorSnapshot } from "@/types/domain";

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

type CatalogItemProjection = {
  id: string;
  unit: "m" | "m2";
  display_name: string;
};

function buildBastidorSnapshot(leadItem: {
  assembly_mode?: string | null;
  bastidor_variant?: string | null;
  bastidor_light_cm?: number | string | null;
  bastidor_secondary_frame_catalog_id?: string | null;
  bastidor_support_mm?: number | string | null;
  bastidor_lomo_mm?: number | string | null;
  bastidor_depth_mm?: number | string | null;
}): BastidorSnapshot | null {
  if (leadItem.assembly_mode !== "bastidor") {
    return null;
  }

  if (
    (leadItem.bastidor_variant !== "simple" &&
      leadItem.bastidor_variant !== "double_profile") ||
    leadItem.bastidor_light_cm === null ||
    leadItem.bastidor_light_cm === undefined ||
    leadItem.bastidor_support_mm === null ||
    leadItem.bastidor_support_mm === undefined ||
    leadItem.bastidor_lomo_mm === null ||
    leadItem.bastidor_lomo_mm === undefined ||
    leadItem.bastidor_depth_mm === null ||
    leadItem.bastidor_depth_mm === undefined
  ) {
    return null;
  }

  return {
    variant: leadItem.bastidor_variant,
    lightCm: Number(leadItem.bastidor_light_cm),
    supportMm: Number(leadItem.bastidor_support_mm),
    lomoMm: Number(leadItem.bastidor_lomo_mm),
    depthMm: Number(leadItem.bastidor_depth_mm),
    secondaryFrameId: leadItem.bastidor_secondary_frame_catalog_id ?? null,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: quoteId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const [{ data: quote, error: quoteError }, { data: quoteItems, error: quoteItemsError }] =
    await Promise.all([
      supabase.from("quotes").select("id").eq("id", quoteId).maybeSingle(),
      supabase
        .from("quote_items")
        .select("id, lead_item_id, frame_catalog_id, quantity")
        .eq("quote_id", quoteId),
    ]);

  if (quoteError) {
    return serverError("Failed to load quote.", quoteError.message);
  }

  if (!quote) {
    return notFound("Quote not found.");
  }

  if (quoteItemsError) {
    return serverError("Failed to load quote items.", quoteItemsError.message);
  }

  const items = quoteItems ?? [];

  if (items.length === 0) {
    return NextResponse.json({
      quoteId,
      hasShortage: false,
      items: [],
    });
  }

  const leadItemIds = Array.from(
    new Set(
      items.map((item) => item.lead_item_id).filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: leadItems, error: leadItemsError } = await supabase
    .from("lead_items")
    .select(
      "id, width_cm, height_cm, face_mm, has_glass, has_matboard, matboard_border_cm, glass_type_id, matboard_type_id, assembly_mode, bastidor_variant, bastidor_light_cm, bastidor_secondary_frame_catalog_id, bastidor_support_mm, bastidor_lomo_mm, bastidor_depth_mm",
    )
    .in("id", leadItemIds);

  if (leadItemsError) {
    return serverError("Failed to load quote dependencies.", leadItemsError.message);
  }

  const leadMap = new Map((leadItems ?? []).map((item) => [item.id, item]));

  const frameIds = Array.from(
    new Set(
      [
        ...items.map((item) => item.frame_catalog_id).filter((id): id is string => Boolean(id)),
        ...(leadItems ?? [])
          .map((item) => item.bastidor_secondary_frame_catalog_id)
          .filter((id): id is string => Boolean(id)),
      ],
    ),
  );
  const glassIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.glass_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const matboardIds = Array.from(
    new Set(
      (leadItems ?? [])
        .map((item) => item.matboard_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [frameCatalogItems, glassCatalogItems, matboardCatalogItems] = await Promise.all([
    frameIds.length > 0
      ? supabase
          .from("catalog_items")
          .select("id, unit, display_name, catalog_frame_id")
          .in("catalog_frame_id", frameIds)
      : Promise.resolve({ data: [], error: null }),
    glassIds.length > 0
      ? supabase
          .from("catalog_items")
          .select("id, unit, display_name, glass_type_id")
          .in("glass_type_id", glassIds)
      : Promise.resolve({ data: [], error: null }),
    matboardIds.length > 0
      ? supabase
          .from("catalog_items")
          .select("id, unit, display_name, matboard_type_id")
          .in("matboard_type_id", matboardIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    frameCatalogItems.error ||
    glassCatalogItems.error ||
    matboardCatalogItems.error
  ) {
    return serverError("Failed to map quote materials to catalog items.", {
      frame: frameCatalogItems.error?.message,
      glass: glassCatalogItems.error?.message,
      matboard: matboardCatalogItems.error?.message,
    });
  }

  const frameMap = new Map<string, CatalogItemProjection>();
  const glassMap = new Map<string, CatalogItemProjection>();
  const matboardMap = new Map<string, CatalogItemProjection>();
  const catalogItemById = new Map<string, CatalogItemProjection>();

  for (const row of frameCatalogItems.data ?? []) {
    const projection: CatalogItemProjection = {
      id: row.id,
      unit: row.unit,
      display_name: row.display_name,
    };

    if (row.catalog_frame_id) {
      frameMap.set(row.catalog_frame_id, projection);
    }

    catalogItemById.set(row.id, projection);
  }

  for (const row of glassCatalogItems.data ?? []) {
    const projection: CatalogItemProjection = {
      id: row.id,
      unit: row.unit,
      display_name: row.display_name,
    };

    if (row.glass_type_id) {
      glassMap.set(row.glass_type_id, projection);
    }

    catalogItemById.set(row.id, projection);
  }

  for (const row of matboardCatalogItems.data ?? []) {
    const projection: CatalogItemProjection = {
      id: row.id,
      unit: row.unit,
      display_name: row.display_name,
    };

    if (row.matboard_type_id) {
      matboardMap.set(row.matboard_type_id, projection);
    }

    catalogItemById.set(row.id, projection);
  }

  const requiredByCatalogItem = new Map<string, number>();

  for (const quoteItem of items) {
    if (!quoteItem.lead_item_id) {
      return badRequest(`Quote item ${quoteItem.id} has no lead item linked.`);
    }

    const leadItem = leadMap.get(quoteItem.lead_item_id);

    if (!leadItem) {
      return badRequest(`Lead item ${quoteItem.lead_item_id} referenced by quote is missing.`);
    }

    if (!quoteItem.frame_catalog_id) {
      return badRequest(`Quote item ${quoteItem.id} has no frame_catalog_id.`);
    }

    const frameCatalogItem = frameMap.get(quoteItem.frame_catalog_id);

    if (!frameCatalogItem) {
      return badRequest(
        `No catalog item mapping found for frame ${quoteItem.frame_catalog_id}.`,
      );
    }

    const bastidor = buildBastidorSnapshot(leadItem);

    if (leadItem.assembly_mode === "bastidor" && !bastidor) {
      return badRequest(`Lead item ${leadItem.id} has incomplete bastidor geometry.`);
    }

    const geometry = calculateFrameGeometry({
      widthCm: Number(leadItem.width_cm),
      heightCm: Number(leadItem.height_cm),
      quantity: Number(quoteItem.quantity),
      hasMatboard: Boolean(leadItem.has_matboard),
      matboardBorderCm: leadItem.has_matboard
        ? Number(leadItem.matboard_border_cm ?? 0)
        : undefined,
      frameFaceMm: Number(leadItem.face_mm),
      assemblyMode: leadItem.assembly_mode ?? "normal",
      bastidor,
    });

    requiredByCatalogItem.set(
      frameCatalogItem.id,
      round4((requiredByCatalogItem.get(frameCatalogItem.id) ?? 0) + geometry.requiredMouldingM),
    );

    if (bastidor?.secondaryFrameId) {
      const secondaryFrameCatalogItem = frameMap.get(bastidor.secondaryFrameId);

      if (!secondaryFrameCatalogItem) {
        return badRequest(
          `No catalog item mapping found for frame ${bastidor.secondaryFrameId}.`,
        );
      }

      requiredByCatalogItem.set(
        secondaryFrameCatalogItem.id,
        round4(
          (requiredByCatalogItem.get(secondaryFrameCatalogItem.id) ?? 0) +
            geometry.requiredMouldingM,
        ),
      );
    }

    if (leadItem.has_glass && leadItem.glass_type_id) {
      const glassCatalogItem = glassMap.get(leadItem.glass_type_id);

      if (!glassCatalogItem) {
        return badRequest(
          `No catalog item mapping found for glass ${leadItem.glass_type_id}.`,
        );
      }
      requiredByCatalogItem.set(
        glassCatalogItem.id,
        round4((requiredByCatalogItem.get(glassCatalogItem.id) ?? 0) + geometry.areaM2),
      );
    }

    if (leadItem.has_matboard && leadItem.matboard_type_id) {
      const matboardCatalogItem = matboardMap.get(leadItem.matboard_type_id);

      if (!matboardCatalogItem) {
        return badRequest(
          `No catalog item mapping found for matboard ${leadItem.matboard_type_id}.`,
        );
      }
      requiredByCatalogItem.set(
        matboardCatalogItem.id,
        round4((requiredByCatalogItem.get(matboardCatalogItem.id) ?? 0) + geometry.areaM2),
      );
    }
  }

  const involvedCatalogItemIds = Array.from(requiredByCatalogItem.keys());

  const { data: balances, error: balancesError } =
    involvedCatalogItemIds.length > 0
      ? await supabase
          .from("stock_balances")
          .select("catalog_item_id, on_hand_quantity")
          .in("catalog_item_id", involvedCatalogItemIds)
      : { data: [], error: null };

  if (balancesError) {
    return serverError("Failed to load stock balances.", balancesError.message);
  }

  const balanceByCatalogItem = new Map(
    (balances ?? []).map((row) => [row.catalog_item_id, Number(row.on_hand_quantity)]),
  );

  const resultItems = involvedCatalogItemIds.map((catalogItemId) => {
    const requiredQuantity = round4(requiredByCatalogItem.get(catalogItemId) ?? 0);
    const availableQuantity = round4(balanceByCatalogItem.get(catalogItemId) ?? 0);
    const shortageQuantity = round4(Math.max(requiredQuantity - availableQuantity, 0));
    const itemMeta = catalogItemById.get(catalogItemId);

    return {
      catalogItemId,
      catalogItemName: itemMeta?.display_name ?? null,
      unit: itemMeta?.unit ?? null,
      requiredQuantity,
      availableQuantity,
      shortageQuantity,
      needsPurchase: shortageQuantity > 0,
    };
  });

  return NextResponse.json({
    quoteId,
    hasShortage: resultItems.some((item) => item.needsPurchase),
    items: resultItems,
  });
}
