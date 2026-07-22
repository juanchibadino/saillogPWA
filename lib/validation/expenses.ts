import { z } from "zod"

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Currency must be a 3-letter code")

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)

const optionalUuidSchema = z
  .union([z.string().uuid(), z.literal(""), z.undefined(), z.null()])
  .transform((value) => (typeof value === "string" && value.length > 0 ? value : null))

export const expenseTypeSchema = z.enum([
  "meals",
  "accommodation",
  "transport",
  "fuel",
  "marina_fees",
  "race_fees",
  "supplies",
  "gear",
  "coaching",
  "other",
])

export const expenseVisibilityScopeSchema = z.enum(["mine", "team"])

export const createTeamExpenseInputSchema = z.object({
  teamId: z.string().uuid(),
  teamVenueId: z.string().uuid(),
  assignedToProfileId: z.string().uuid().optional(),
  campId: optionalUuidSchema,
  expenseDate: dateSchema,
  vendor: z.string().trim().min(1).max(160),
  expenseType: expenseTypeSchema,
  description: z.string().trim().max(1000).optional(),
  amountLocal: z.coerce.number().positive().max(999999999.99),
  currencyCode: currencyCodeSchema,
})

export const updateTeamExpenseInputSchema = createTeamExpenseInputSchema.extend({
  expenseId: z.string().uuid(),
})

export const deleteTeamExpenseInputSchema = z.object({
  expenseId: z.string().uuid(),
})

export const expenseRateInputSchema = z.object({
  amountLocal: z.coerce.number().positive().max(999999999.99),
  currencyCode: currencyCodeSchema,
  expenseDate: dateSchema,
  organizationCurrencyCode: currencyCodeSchema,
})

export type CreateTeamExpenseInput = z.infer<typeof createTeamExpenseInputSchema>
export type UpdateTeamExpenseInput = z.infer<typeof updateTeamExpenseInputSchema>
export type DeleteTeamExpenseInput = z.infer<typeof deleteTeamExpenseInputSchema>
export type ExpenseRateInput = z.infer<typeof expenseRateInputSchema>
