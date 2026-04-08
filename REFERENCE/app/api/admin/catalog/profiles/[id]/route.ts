import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { COLOR_GROUPS, isWoodType, normalizeWoodType } from "@/lib/catalog/taxonomy";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { syncFrameReferenceCostMetric } from "@/lib/catalog/cost-metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z
  .object({
    woodType: z.string().trim().min(1).optional(),
    colorGroup: z.enum(COLOR_GROUPS).optional(),
    faceMm: z.number().positive().optional(),
    depthMm: z.number().positive().optional(),
    supportsBastidor: z.boolean().optional(),
    lomoMm: z.number().positive().nullable().optional(),
    publicLabel: z.string().trim().max(120).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    referenceCostPerMeter: z.number().nonnegative().optional(),
    supplierId: z.string().uuid().optional(),
    supplierModelCode: z.string().trim().max(120).nullable().optional(),
    active: z.boolean().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (payload) =>
      payload.woodType !== undefined ||
      payload.colorGroup !== undefined ||
      payload.faceMm !== undefined ||
      payload.depthMm !== undefined ||
      payload.supportsBastidor !== undefined ||
      payload.lomoMm !== undefined ||
      payload.publicLabel !== undefined ||
      payload.sortOrder !== undefined ||
      payload.referenceCostPerMeter !== undefined ||
      payload.supplierId !== undefined ||
      payload.supplierModelCode !== undefined ||
      payload.active !== undefined ||
      payload.isPublic !== undefined,
    { message: "At least one editable field is required." },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("catalog_frames")
    .select("id, face_mm, supports_bastidor, lomo_mm")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    if (existingError?.code === "PGRST116") {
      return notFound("Curated frame not found.");
    }

    return serverError("Failed to load curated frame.", existingError?.message);
  }

  const { data: currentSupplierLink, error: currentSupplierError } = await supabase
    .from("catalog_frame_suppliers")
    .select("supplier_id, supplier_model_code")
    .eq("catalog_frame_id", id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentSupplierError) {
    return serverError("Failed to load current curated frame supplier.", currentSupplierError.message);
  }

  const updates: {
    wood_type?: string;
    color_group?: (typeof COLOR_GROUPS)[number];
    face_mm?: number;
    depth_mm?: number;
    supports_bastidor?: boolean;
    lomo_mm?: number | null;
    public_label?: string | null;
    sort_order?: number;
    active?: boolean;
    is_public?: boolean;
  } = {};

  if (parsed.data.woodType !== undefined) {
    const normalizedWoodType = normalizeWoodType(parsed.data.woodType);

    if (!isWoodType(normalizedWoodType)) {
      return badRequest("Invalid woodType. Allowed: pino, marupa, kiri, tiza.");
    }

    updates.wood_type = normalizedWoodType;
  }

  if (parsed.data.colorGroup !== undefined) {
    updates.color_group = parsed.data.colorGroup;
  }

  if (parsed.data.faceMm !== undefined) {
    updates.face_mm = parsed.data.faceMm;
  }

  if (parsed.data.depthMm !== undefined) {
    updates.depth_mm = parsed.data.depthMm;
  }

  if (parsed.data.supportsBastidor !== undefined) {
    updates.supports_bastidor = parsed.data.supportsBastidor;
  }

  if (parsed.data.lomoMm !== undefined) {
    updates.lomo_mm = parsed.data.lomoMm;
  }

  if (parsed.data.publicLabel !== undefined) {
    updates.public_label = parsed.data.publicLabel;
  }

  if (parsed.data.sortOrder !== undefined) {
    updates.sort_order = parsed.data.sortOrder;
  }

  if (parsed.data.active !== undefined) {
    updates.active = parsed.data.active;
  }

  if (parsed.data.isPublic !== undefined) {
    updates.is_public = parsed.data.isPublic;
  }

  const nextFaceMm = parsed.data.faceMm ?? Number(existing.face_mm);
  const nextSupportsBastidor =
    parsed.data.supportsBastidor ?? Boolean(existing.supports_bastidor);
  const nextLomoMm =
    parsed.data.lomoMm !== undefined
      ? parsed.data.lomoMm
      : existing.lomo_mm === null || existing.lomo_mm === undefined
        ? null
        : Number(existing.lomo_mm);

  if (nextSupportsBastidor && (nextLomoMm === null || nextLomoMm >= nextFaceMm)) {
    return badRequest("Lomo must be greater than 0 and smaller than faceMm for bastidor frames.");
  }

  if (!nextSupportsBastidor) {
    updates.lomo_mm = null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("catalog_frames")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return serverError("Failed to update curated frame.", updateError.message);
    }
  }

  if (parsed.data.referenceCostPerMeter !== undefined) {
    try {
      await syncFrameReferenceCostMetric(
        supabase,
        id,
        parsed.data.referenceCostPerMeter,
      );
    } catch (error) {
      return serverError(
        "Failed to update curated frame reference cost.",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  const shouldUpdateSupplier =
    parsed.data.supplierId !== undefined ||
    parsed.data.supplierModelCode !== undefined;

  if (shouldUpdateSupplier) {
    const supplierId = parsed.data.supplierId ?? currentSupplierLink?.supplier_id ?? null;

    if (!supplierId) {
      return badRequest("Supplier is required for curated frames.");
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .eq("active", true)
      .single();

    if (supplierError || !supplier) {
      return badRequest("Supplier not found or inactive.");
    }

    const supplierModelCode =
      parsed.data.supplierModelCode !== undefined
        ? parsed.data.supplierModelCode
        : currentSupplierLink?.supplier_model_code ?? null;

    const { error: deleteLinksError } = await supabase
      .from("catalog_frame_suppliers")
      .delete()
      .eq("catalog_frame_id", id);

    if (deleteLinksError) {
      return serverError(
        "Failed to replace curated frame supplier links.",
        deleteLinksError.message,
      );
    }

    const { error: insertLinkError } = await supabase
      .from("catalog_frame_suppliers")
      .insert({
        catalog_frame_id: id,
        supplier_id: supplierId,
        supplier_model_code: supplierModelCode,
        last_cost_per_meter: null,
        active: true,
      });

    if (insertLinkError) {
      return serverError("Failed to save curated frame supplier link.", insertLinkError.message);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("catalog_frames")
    .select("id")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    if (existingError?.code === "PGRST116") {
      return notFound("Curated frame not found.");
    }

    return serverError("Failed to load curated frame.", existingError?.message);
  }

  const [leadItemsRef, quoteItemsRef, jobItemsRef, purchaseItemsRef] = await Promise.all([
    supabase.from("lead_items").select("id", { count: "exact", head: true }).eq("frame_catalog_id", id),
    supabase.from("quote_items").select("id", { count: "exact", head: true }).eq("frame_catalog_id", id),
    supabase.from("job_items").select("id", { count: "exact", head: true }).eq("frame_catalog_id", id),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("catalog_frame_id", id),
  ]);

  if (leadItemsRef.error || quoteItemsRef.error || jobItemsRef.error || purchaseItemsRef.error) {
    return serverError("Failed to validate curated frame references before delete.", {
      leadItems: leadItemsRef.error?.message,
      quoteItems: quoteItemsRef.error?.message,
      jobItems: jobItemsRef.error?.message,
      purchaseItems: purchaseItemsRef.error?.message,
    });
  }

  const hasRefs =
    (leadItemsRef.count ?? 0) > 0 ||
    (quoteItemsRef.count ?? 0) > 0 ||
    (jobItemsRef.count ?? 0) > 0 ||
    (purchaseItemsRef.count ?? 0) > 0;

  if (hasRefs) {
    return badRequest(
      "Cannot delete curated frame because it is already used in leads/quotes/jobs/purchases.",
      {
        leadItems: leadItemsRef.count ?? 0,
        quoteItems: quoteItemsRef.count ?? 0,
        jobItems: jobItemsRef.count ?? 0,
        purchaseItems: purchaseItemsRef.count ?? 0,
      },
    );
  }

  const { error: deleteError } = await supabase
    .from("catalog_frames")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return serverError("Failed to delete curated frame.", deleteError.message);
  }

  return NextResponse.json({ success: true });
}
