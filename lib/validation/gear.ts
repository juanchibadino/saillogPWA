import { z } from "zod"

const optionalTrimmedIdentifierSchema = z
  .string()
  .trim()
  .max(120, "Maximum length is 120 characters")
  .optional()

export const gearAlertRuleInputSchema = z.object({
  metric: z.enum(["usage_count", "usage_minutes"]),
  severity: z.enum(["warning", "critical"]),
  thresholdValue: z.number().int().positive(),
  isRefurbishedRule: z.coerce.boolean(),
})

const baseGearItemInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Maximum length is 120 characters"),
  gearType: z.enum([
    "sails",
    "spars_and_foils",
    "running_rigging",
    "hardware_and_fittings",
  ]),
  serialNumber: optionalTrimmedIdentifierSchema,
  barcode: optionalTrimmedIdentifierSchema,
  status: z.enum(["active_regatta", "active_training", "retired_spare", "on_repair"]),
  condition: z.enum(["new", "used", "refurbished"]),
  alertRules: z.array(gearAlertRuleInputSchema).max(40, "Maximum number of rules exceeded"),
})

export const createGearItemInputSchema = baseGearItemInputSchema

export const updateGearItemInputSchema = baseGearItemInputSchema.extend({
  id: z.string().uuid(),
})

export const updateSessionGearUsageInputSchema = z.object({
  sessionId: z.string().uuid(),
  gearItemIds: z.array(z.string().uuid()).max(200),
})

export type GearAlertRuleInput = z.infer<typeof gearAlertRuleInputSchema>
export type CreateGearItemInput = z.infer<typeof createGearItemInputSchema>
export type UpdateGearItemInput = z.infer<typeof updateGearItemInputSchema>
export type UpdateSessionGearUsageInput = z.infer<typeof updateSessionGearUsageInputSchema>
