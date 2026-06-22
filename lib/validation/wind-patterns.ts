import { z } from "zod"

const windPatternNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Maximum length is 120 characters")

const windPatternDescriptionSchema = z
  .string()
  .trim()
  .max(4000, "Maximum length is 4000 characters")
  .optional()

export const createTeamVenueWindPatternInputSchema = z.object({
  name: windPatternNameSchema,
  description: windPatternDescriptionSchema,
})

export const updateTeamVenueWindPatternInputSchema = z.object({
  id: z.string().uuid(),
  name: windPatternNameSchema,
  description: windPatternDescriptionSchema,
})

export const toggleTeamVenueWindPatternStatusInputSchema = z.object({
  id: z.string().uuid(),
})
