import { z } from "zod"

const requiredShortTextSchema = z.string().trim().min(1).max(120)
const dateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format")
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

export type CreateCampInput = z.infer<typeof createCampInputSchema>
export type UpdateCampInput = z.infer<typeof updateCampInputSchema>
export type UpdateCampGoalsInput = z.infer<typeof updateCampGoalsInputSchema>
