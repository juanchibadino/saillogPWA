import { z } from "zod"
import type { Json } from "@/types/database"

const dateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format")

const optionalTrimmedTextSchema = z
  .string()
  .trim()
  .max(4000, "Maximum length is 4000 characters")
  .optional()

const hhmmTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use a valid time in HH:MM format")
  .refine((value) => {
    const [hourPart, minutePart] = value.split(":")
    const hour = Number.parseInt(hourPart, 10)
    const minute = Number.parseInt(minutePart, 10)

    return (
      Number.isFinite(hour) &&
      Number.isFinite(minute) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    )
  }, "Use a valid 24-hour time")

const baseSessionInputSchema = z.object({
  campId: z.string().uuid(),
  sessionType: z.enum(["training", "regatta"]),
  sessionDate: dateInputSchema,
  netTimeMinutes: z.number().int().min(0).max(24 * 60).optional(),
  highlightedByCoach: z.coerce.boolean(),
})

export const createSessionInputSchema = baseSessionInputSchema.extend({
  dockOutTime: hhmmTimeSchema,
})

export const updateSessionInputSchema = baseSessionInputSchema.extend({
  id: z.string().uuid(),
})

export const deleteSessionInputSchema = z.object({
  id: z.string().uuid(),
})

export const updateSessionDetailInputSchema = z.object({
  id: z.string().uuid(),
  sessionType: z.enum(["training", "regatta"]),
  sessionDate: dateInputSchema,
  startTime: hhmmTimeSchema,
  totalDurationHours: z
    .number()
    .min(0.25, "Total duration must be at least 15 minutes")
    .max(24, "Total duration must be 24 hours or less")
    .refine((value) => {
      const minutes = value * 60
      return Number.isInteger(minutes) && minutes % 15 === 0
    }, "Total duration must use 15-minute increments"),
})

export const updateSessionInfoInputSchema = z.object({
  sessionId: z.string().uuid(),
  bestOfSession: optionalTrimmedTextSchema,
  toWork: optionalTrimmedTextSchema,
  freeNotes: optionalTrimmedTextSchema,
  standardMoveIds: z.array(z.string().uuid()).max(200).optional().default([]),
  windPatternIds: z.array(z.string().uuid()).max(200).optional().default([]),
})

export const updateSessionResultsInputSchema = z.object({
  sessionId: z.string().uuid(),
  resultNotes: optionalTrimmedTextSchema,
})

export const updateSessionGoalsInputSchema = z.object({
  sessionId: z.string().uuid(),
  goals: z.string().trim().max(4000, "Maximum length is 4000 characters"),
})

export const updateSessionSetupInputSchema = z.object({
  sessionId: z.string().uuid(),
  setupPayload: z.string().trim().min(2).max(200000),
  orderedItemIdsPayload: z.string().trim().min(2).max(200000).optional(),
})

export const createTeamSetupMetricInputSchema = z.object({
  sessionId: z.string().uuid(),
  inputKind: z.enum(["single_select", "multi_select", "text"]),
  label: z.string().trim().min(1).max(120),
  options: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
})

export const updateTeamSetupMetricInputSchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().uuid(),
  inputKind: z.enum(["single_select", "multi_select", "text"]),
  label: z.string().trim().min(1).max(120),
  options: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
})

export const deleteTeamSetupMetricInputSchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().uuid(),
})

export const reorderTeamSetupMetricsInputSchema = z.object({
  sessionId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()).min(1).max(500),
})

export const uploadSessionAssetInputSchema = z.object({
  sessionId: z.string().uuid(),
  assetType: z.enum(["photo", "analytics_file"]),
})

export const deleteSessionAssetInputSchema = z.object({
  sessionId: z.string().uuid(),
  assetId: z.string().uuid(),
})

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>
export type DeleteSessionInput = z.infer<typeof deleteSessionInputSchema>
export type UpdateSessionDetailInput = z.infer<typeof updateSessionDetailInputSchema>
export type UpdateSessionInfoInput = z.infer<typeof updateSessionInfoInputSchema>
export type UpdateSessionResultsInput = z.infer<typeof updateSessionResultsInputSchema>
export type UpdateSessionGoalsInput = z.infer<typeof updateSessionGoalsInputSchema>
export type UpdateSessionSetupInput = z.infer<typeof updateSessionSetupInputSchema>
export type CreateTeamSetupMetricInput = z.infer<typeof createTeamSetupMetricInputSchema>
export type UpdateTeamSetupMetricInput = z.infer<typeof updateTeamSetupMetricInputSchema>
export type DeleteTeamSetupMetricInput = z.infer<typeof deleteTeamSetupMetricInputSchema>
export type ReorderTeamSetupMetricsInput = z.infer<typeof reorderTeamSetupMetricsInputSchema>
export type UploadSessionAssetInput = z.infer<typeof uploadSessionAssetInputSchema>
export type DeleteSessionAssetInput = z.infer<typeof deleteSessionAssetInputSchema>

export type SessionInfoJsonText = Json | null
