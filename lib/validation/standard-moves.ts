import { z } from "zod"

const standardMoveNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Maximum length is 120 characters")

const standardMoveDescriptionSchema = z
  .string()
  .trim()
  .max(4000, "Maximum length is 4000 characters")
  .optional()

export const createTeamStandardMoveInputSchema = z.object({
  name: standardMoveNameSchema,
  description: standardMoveDescriptionSchema,
})

export const updateTeamStandardMoveInputSchema = z.object({
  id: z.string().uuid(),
  name: standardMoveNameSchema,
  description: standardMoveDescriptionSchema,
})

export const toggleTeamStandardMoveStatusInputSchema = z.object({
  id: z.string().uuid(),
})
