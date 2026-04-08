import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  reason: z.string().trim().max(500).optional(),
});

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
    body = {};
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: quote, error: quoteError }, { data: existingJob, error: existingJobError }] =
    await Promise.all([
      supabase.from("quotes").select("id, lead_id, status").eq("id", quoteId).single(),
      supabase.from("jobs").select("id").eq("quote_id", quoteId).maybeSingle(),
    ]);

  if (quoteError) {
    if (quoteError.code === "PGRST116") {
      return notFound("Quote not found.");
    }

    return serverError("Failed to load quote.", quoteError.message);
  }

  if (existingJobError) {
    return serverError("Failed to verify existing job for this quote.", existingJobError.message);
  }

  if (existingJob) {
    return badRequest("Cannot reject quote because it already has a job.");
  }

  if (quote.status === "quote_approved") {
    return badRequest("Cannot reject an approved quote.");
  }

  if (quote.status === "quote_rejected") {
    return NextResponse.json({ success: true, quoteId, leadId: quote.lead_id, reused: true });
  }

  const [{ error: quoteUpdateError }, { error: leadUpdateError }] = await Promise.all([
    supabase
      .from("quotes")
      .update({ status: "quote_rejected", approved_at: null })
      .eq("id", quoteId),
    supabase
      .from("leads")
      .update({ status: "quote_rejected" })
      .eq("id", quote.lead_id),
  ]);

  if (quoteUpdateError || leadUpdateError) {
    return serverError("Failed to reject quote.", {
      quote: quoteUpdateError?.message,
      lead: leadUpdateError?.message,
    });
  }

  if (parsed.data.reason) {
    const { data: lead, error: leadLoadError } = await supabase
      .from("leads")
      .select("id, notes")
      .eq("id", quote.lead_id)
      .single();

    if (leadLoadError) {
      return serverError("Quote rejected but failed to load lead notes.", leadLoadError.message);
    }

    const stamp = new Date().toISOString();
    const nextNotes = [lead.notes?.trim(), `[${stamp}] quote_rejected: ${parsed.data.reason}`]
      .filter(Boolean)
      .join("\n");

    const { error: notesUpdateError } = await supabase
      .from("leads")
      .update({ notes: nextNotes })
      .eq("id", quote.lead_id);

    if (notesUpdateError) {
      return serverError("Quote rejected but failed to save rejection reason.", notesUpdateError.message);
    }
  }

  return NextResponse.json({ success: true, quoteId, leadId: quote.lead_id, reused: false });
}
