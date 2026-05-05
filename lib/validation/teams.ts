import { z } from "zod"

const requiredShortTextSchema = z.string().trim().min(1).max(120)

export const createTeamInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: requiredShortTextSchema,
  teamType: requiredShortTextSchema,
})

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>
