import { z } from "zod"

const requiredNameSchema = z.string().trim().min(1).max(120)
const requiredEmailSchema = z.string().trim().email().max(320).toLowerCase()
const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Currency must be a 3-letter code")
const optionalAvatarUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal("")])
  .optional()

export const updateUserSettingsInputSchema = z.object({
  firstName: requiredNameSchema.max(80),
  lastName: requiredNameSchema.max(80),
  email: requiredEmailSchema,
  avatarUrl: optionalAvatarUrlSchema,
})

export const updateOrganizationSettingsInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: requiredNameSchema,
  defaultCurrencyCode: currencyCodeSchema,
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
      "Avatar URL must start with http://, https://, or /",
    ),
})

export const updateTeamSettingsInputSchema = z.object({
  organizationId: z.string().uuid(),
  teamId: z.string().uuid(),
  name: requiredNameSchema,
  teamType: requiredNameSchema,
  expensesShowTeamTotals: z.boolean(),
})

export const updateNotificationSettingsInputSchema = z.object({
  emailNotificationsEnabled: z.boolean(),
})

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsInputSchema>
export type UpdateOrganizationSettingsInput = z.infer<
  typeof updateOrganizationSettingsInputSchema
>
export type UpdateTeamSettingsInput = z.infer<typeof updateTeamSettingsInputSchema>
export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsInputSchema
>
