import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { badRequest, notFound, serverError } from "@/lib/http/responses";
import { updateJobStageSchema } from "@/lib/jobs/stages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; stageId: string }> },
) {
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

  const parsed = updateJobStageSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed.", parsed.error.flatten());
  }

  const { id: jobId, stageId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: stage, error: stageError } = await supabase
    .from("job_stages")
    .select("id, job_id")
    .eq("id", stageId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (stageError) {
    return serverError("Failed to load job stage.", stageError.message);
  }

  if (!stage) {
    return notFound("Job stage not found.");
  }

  const updates: {
    status?: string;
    estimated_minutes?: number | null;
    actual_minutes?: number | null;
  } = {};

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  if (parsed.data.estimatedMinutes !== undefined) {
    updates.estimated_minutes = parsed.data.estimatedMinutes;
  }

  if (parsed.data.actualMinutes !== undefined) {
    updates.actual_minutes = parsed.data.actualMinutes;
  }

  const { data: updatedStage, error: updateError } = await supabase
    .from("job_stages")
    .update(updates)
    .eq("id", stageId)
    .eq("job_id", jobId)
    .select("id, stage_name, status, estimated_minutes, actual_minutes, created_at")
    .single();

  if (updateError) {
    return serverError("Failed to update job stage.", updateError.message);
  }

  return NextResponse.json({
    id: updatedStage.id,
    name: updatedStage.stage_name,
    status: updatedStage.status,
    estimatedMinutes: updatedStage.estimated_minutes,
    actualMinutes: updatedStage.actual_minutes,
    createdAt: updatedStage.created_at,
  });
}
