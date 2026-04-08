import { z } from "zod";

export const JOB_STAGE_STATUSES = ["pending", "in_progress", "done"] as const;

export type JobStageStatus = (typeof JOB_STAGE_STATUSES)[number];

export const updateJobStageSchema = z
  .object({
    status: z.enum(JOB_STAGE_STATUSES).optional(),
    estimatedMinutes: z.number().int().min(0).nullable().optional(),
    actualMinutes: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.estimatedMinutes !== undefined ||
      payload.actualMinutes !== undefined,
    { message: "At least one editable field is required." },
  );

export function areAllJobStagesDone(
  stages: Array<{ status: string }>,
): boolean {
  return stages.length > 0 && stages.every((stage) => stage.status === "done");
}
