import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  isPublic: z.boolean(),
  publicLabel: z.string().trim().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function POST(
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

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

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

  const { error: updateError } = await supabase
    .from("catalog_frames")
    .update({
      is_public: parsed.data.isPublic,
      public_label: parsed.data.publicLabel ?? null,
      sort_order: parsed.data.sortOrder ?? 0,
    })
    .eq("id", id);

  if (updateError) {
    return serverError("Failed to update curated frame visibility.", updateError.message);
  }

  return NextResponse.json({ success: true });
}
