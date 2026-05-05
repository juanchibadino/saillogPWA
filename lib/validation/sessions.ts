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

export const createSessionInputSchema = baseSessionInputSchema

export const updateSessionInputSchema = baseSessionInputSchema.extend({
  id: z.string().uuid(),
})

export const updateSessionDetailInputSchema = z
  .object({
    id: z.string().uuid(),
    sessionType: z.enum(["training", "regatta"]),
    sessionDate: dateInputSchema,
    startTime: hhmmTimeSchema.optional(),
    totalDurationHours: z.number().positive().max(24).optional(),
  })
  .superRefine((value, context) => {
    const hasStart = typeof value.startTime === "string" && value.startTime.length > 0
    const hasDuration = typeof value.totalDurationHours === "number"

    if (hasDuration && !hasStart) {
      context.addIssue({
        code: "custom",
        message: "Start time is required when total duration is provided",
        path: ["startTime"],
      })
    }
  })

export const updateSessionInfoInputSchema = z.object({
  sessionId: z.string().uuid(),
  bestOfSession: optionalTrimmedTextSchema,
  toWork: optionalTrimmedTextSchema,
  standardMoves: optionalTrimmedTextSchema,
  windPatterns: optionalTrimmedTextSchema,
  freeNotes: optionalTrimmedTextSchema,
})

export const updateSessionResultsInputSchema = z.object({
  sessionId: z.string().uuid(),
  resultNotes: optionalTrimmedTextSchema,
})

export const updateSessionSetupInputSchema = z.object({
  sessionId: z.string().uuid(),
  setupPayload: z.string().trim().min(2).max(200000),
})

export const uploadSessionAssetInputSchema = z.object({
  sessionId: z.string().uuid(),
  assetType: z.enum(["photo", "analytics_file"]),
})

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>
export type UpdateSessionDetailInput = z.infer<typeof updateSessionDetailInputSchema>
export type UpdateSessionInfoInput = z.infer<typeof updateSessionInfoInputSchema>
export type UpdateSessionResultsInput = z.infer<typeof updateSessionResultsInputSchema>
export type UpdateSessionSetupInput = z.infer<typeof updateSessionSetupInputSchema>
export type UploadSessionAssetInput = z.infer<typeof uploadSessionAssetInputSchema>

export type SessionInfoJsonText = Json | null
