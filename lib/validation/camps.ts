import { z } from "zod"

import { normalizeUsDateInput } from "@/lib/us-date-input"

const requiredShortTextSchema = z.string().trim().min(1).max(120)
const dateInputSchema = z
  .string()
  .trim()
  .refine((value) => normalizeUsDateInput(value) !== null, {
    message: "Use a valid date in MM/DD/YYYY format",
  })
  .transform((value) => normalizeUsDateInput(value) ?? value)
const optionalLongTextSchema = z.string().trim().max(4000)

const baseCampInputSchema = z
  .object({
    teamVenueId: z.string().uuid(),
    name: requiredShortTextSchema,
    campType: z.enum(["training", "regatta", "mixed"]),
    startDate: dateInputSchema,
    endDate: dateInputSchema,
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after start date",
        path: ["endDate"],
      })
    }
  })

export const createCampInputSchema = baseCampInputSchema

export const updateCampInputSchema = baseCampInputSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean(),
})

export const updateCampGoalsInputSchema = z.object({
  campId: z.string().uuid(),
  goals: optionalLongTextSchema,
})

export const deleteCampInputSchema = z.object({
  id: z.string().uuid(),
})

export type CreateCampInput = z.infer<typeof createCampInputSchema>
export type UpdateCampInput = z.infer<typeof updateCampInputSchema>
export type UpdateCampGoalsInput = z.infer<typeof updateCampGoalsInputSchema>
export type DeleteCampInput = z.infer<typeof deleteCampInputSchema>
