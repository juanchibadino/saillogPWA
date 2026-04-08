import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, serverError } from "@/lib/http/responses";
import {
  mapPurchaseRecord,
  PURCHASE_RECORD_SELECT,
} from "@/lib/purchases/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { round2, sum } from "@/lib/utils/math";

const PURCHASE_STATUSES = ["draft", "ordered", "received", "cancelled"] as const;
const TAX_MODES = ["without_vat", "with_vat"] as const;

const purchaseItemSchema = z.object({
  catalogItemId: z.string().uuid(),
  description: z.string().max(200).nullable().optional(),
  pieceCount: z.number().int().positive(),
  unitCostNet: z.number().nonnegative(),
  metersPerPiece: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
});

const createPurchaseSchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid(),
  status: z.enum(PURCHASE_STATUSES).optional(),
  orderedAt: z.string().datetime().nullable().optional(),
  receivedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  taxMode: z.enum(TAX_MODES).optional(),
  vatRate: z.number().min(0).max(1).optional(),
  items: z.array(purchaseItemSchema).min(1),
});

type CatalogItemRow = {
  id: string;
  kind: "frame" | "glass" | "matboard";
  unit: "m" | "m2";
  display_name: string;
  catalog_frame_id: string | null;
  active: boolean;
};

function isFrameCatalogItem(
  catalogItem: CatalogItemRow | undefined,
): catalogItem is CatalogItemRow & { kind: "frame"; catalog_frame_id: string } {
  return Boolean(
    catalogItem &&
      catalogItem.kind === "frame" &&
      typeof catalogItem.catalog_frame_id === "string" &&
      catalogItem.catalog_frame_id.length > 0,
  );
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function buildSquareMeters(widthCm: number, heightCm: number): number {
  return round4((widthCm / 100) * (heightCm / 100));
}

async function resolveCatalogItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  itemIds: string[],
): Promise<Map<string, CatalogItemRow>> {
  const uniqueIds = Array.from(new Set(itemIds));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, kind, unit, display_name, catalog_frame_id, active")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Failed to resolve catalog items: ${error.message}`);
  }

  const byId = new Map<string, CatalogItemRow>();

  for (const row of data ?? []) {
    byId.set(row.id, row as CatalogItemRow);
  }

  return byId;
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("purchases")
    .select(PURCHASE_RECORD_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to load purchases.", error.message);
  }

  return NextResponse.json((data ?? []).map((purchase) => mapPurchaseRecord(purchase)));
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

  const parsed = createPurchaseSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("id, name, active")
    .eq("id", parsed.data.supplierId)
    .single();

  if (supplierError || !supplier) {
    return serverError("Failed to load supplier.", supplierError?.message);
  }

  if (!supplier.active) {
    return badRequest("Supplier is not active.");
  }

  let catalogItemsById: Map<string, CatalogItemRow>;

  try {
    catalogItemsById = await resolveCatalogItems(
      supabase,
      parsed.data.items.map((item) => item.catalogItemId),
    );
  } catch (error) {
    return serverError("Failed to resolve purchase items against catalog.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const requestedFrameIds = Array.from(
    new Set(
      parsed.data.items
        .map((item) => catalogItemsById.get(item.catalogItemId))
        .filter(isFrameCatalogItem)
        .map((catalogItem) => catalogItem.catalog_frame_id),
    ),
  );

  let allowedFrameIds = new Set<string>();

  if (requestedFrameIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("catalog_frame_suppliers")
      .select("catalog_frame_id")
      .eq("supplier_id", supplier.id)
      .eq("active", true)
      .in("catalog_frame_id", requestedFrameIds);

    if (linksError) {
      return serverError("Failed to validate supplier compatibility for frame purchases.", {
        message: linksError.message,
      });
    }

    allowedFrameIds = new Set(
      (links ?? [])
        .map((link) => link.catalog_frame_id)
        .filter((id): id is string => Boolean(id)),
    );
  }

  let normalizedItems: Array<{
    catalog_item_id: string;
    catalog_frame_id: string | null;
    description: string | null;
    meters: number;
    meters_per_piece: number | null;
    width_cm: number | null;
    height_cm: number | null;
    quantity: number;
    quantity_base: number;
    unit_cost: number;
    total_cost: number;
  }>;

  try {
    normalizedItems = parsed.data.items.map((item, index) => {
      const catalogItem = catalogItemsById.get(item.catalogItemId);

      if (!catalogItem) {
        throw new Error(`Item ${index + 1}: catalogItemId invalido (${item.catalogItemId}).`);
      }

      if (!catalogItem.active) {
        throw new Error(`Item ${index + 1}: el item de catalogo seleccionado esta inactivo.`);
      }

      const pieceCount = item.pieceCount;
      const unitCost = round4(item.unitCostNet);

      if (!Number.isFinite(pieceCount) || pieceCount <= 0) {
        throw new Error(`Item ${index + 1}: pieceCount debe ser mayor a 0.`);
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error(`Item ${index + 1}: unitCostNet debe ser mayor o igual a 0.`);
      }

      let quantityBase = 0;
      let meters = 0;
      let metersPerPiece: number | null = null;
      let widthCm: number | null = null;
      let heightCm: number | null = null;

      if (catalogItem.kind === "frame") {
        if (!catalogItem.catalog_frame_id) {
          throw new Error(
            `Item ${index + 1}: el item de marco no tiene referencia de perfil en catalogo.`,
          );
        }

        if (!allowedFrameIds.has(catalogItem.catalog_frame_id)) {
          throw new Error(
            `Item ${index + 1}: el proveedor seleccionado no esta habilitado para ese marco.`,
          );
        }

        if (item.metersPerPiece === undefined) {
          throw new Error(`Item ${index + 1}: metersPerPiece es obligatorio para marcos.`);
        }

        if (!Number.isFinite(item.metersPerPiece) || item.metersPerPiece <= 0) {
          throw new Error(`Item ${index + 1}: metersPerPiece debe ser mayor a 0.`);
        }

        metersPerPiece = round4(item.metersPerPiece);
        quantityBase = round4(metersPerPiece * pieceCount);
        meters = quantityBase;
      } else {
        if (item.widthCm === undefined || item.heightCm === undefined) {
          throw new Error(
            `Item ${index + 1}: widthCm y heightCm son obligatorios para vidrio/paspartu.`,
          );
        }

        if (!Number.isFinite(item.widthCm) || item.widthCm <= 0) {
          throw new Error(`Item ${index + 1}: widthCm debe ser mayor a 0.`);
        }

        if (!Number.isFinite(item.heightCm) || item.heightCm <= 0) {
          throw new Error(`Item ${index + 1}: heightCm debe ser mayor a 0.`);
        }

        widthCm = round4(item.widthCm);
        heightCm = round4(item.heightCm);
        const squareMetersPerPiece = buildSquareMeters(widthCm, heightCm);
        quantityBase = round4(squareMetersPerPiece * pieceCount);
      }

      if (!Number.isFinite(quantityBase) || quantityBase <= 0) {
        throw new Error(`Item ${index + 1}: cantidad calculada invalida, revisa medidas y cantidad.`);
      }

      const totalCost = round2(quantityBase * unitCost);

      return {
        catalog_item_id: catalogItem.id,
        catalog_frame_id: catalogItem.catalog_frame_id,
        description: item.description ?? catalogItem.display_name,
        meters,
        meters_per_piece: metersPerPiece,
        width_cm: widthCm,
        height_cm: heightCm,
        quantity: pieceCount,
        quantity_base: quantityBase,
        unit_cost: unitCost,
        total_cost: totalCost,
      };
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid purchase items payload.");
  }

  const vatRate = parsed.data.vatRate ?? 0.21;
  const taxMode = parsed.data.taxMode ?? "without_vat";
  const subtotalNet = round2(sum(normalizedItems.map((item) => Number(item.total_cost))));
  const vatAmount = taxMode === "with_vat" ? round2(subtotalNet * vatRate) : 0;
  const totalGross = round2(subtotalNet + vatAmount);

  const status = parsed.data.status ?? "ordered";
  const receivedAt =
    status === "received"
      ? parsed.data.receivedAt ?? new Date().toISOString()
      : parsed.data.receivedAt ?? null;

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      status,
      ordered_at: parsed.data.orderedAt ?? null,
      received_at: receivedAt,
      total_cost: subtotalNet,
      tax_mode: taxMode,
      vat_rate: vatRate,
      subtotal_net: subtotalNet,
      vat_amount: vatAmount,
      total_gross: totalGross,
      job_id: parsed.data.jobId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    return serverError("Failed to create purchase.", purchaseError?.message);
  }

  const { error: itemsError } = await supabase.from("purchase_items").insert(
    normalizedItems.map((item) => ({
      purchase_id: purchase.id,
      ...item,
    })),
  );

  if (itemsError) {
    return serverError("Purchase created but failed to create purchase items.", itemsError.message);
  }

  if (status === "received") {
    const { error: effectsError } = await supabase.rpc("apply_purchase_received_effects", {
      p_purchase_id: purchase.id,
    });

    if (effectsError) {
      return serverError(
        "Purchase created but failed to apply stock/cost effects for received status.",
        effectsError.message,
      );
    }
  }

  if (parsed.data.jobId) {
    const { error: jobError } = await supabase
      .from("jobs")
      .update({ status: status === "cancelled" ? "purchase_pending" : "ready_for_production" })
      .eq("id", parsed.data.jobId);

    if (jobError) {
      return serverError("Purchase created but failed to update job status.", jobError.message);
    }
  }

  return NextResponse.json({
    success: true,
    purchaseId: purchase.id,
    totalCost: subtotalNet,
    subtotalNet,
    vatAmount,
    totalGross,
    taxMode,
    vatRate,
  });
}
