import { z } from "zod"

export const createOrganizationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
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

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>
