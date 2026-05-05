import { z } from "zod"

const requiredNameSchema = z.string().trim().min(1).max(80)

const optionalAvatarUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal("")])
  .optional()

export const updateCrewMemberInputSchema = z.object({
  membershipId: z.string().uuid(),
  profileId: z.string().uuid(),
  firstName: requiredNameSchema,
  lastName: requiredNameSchema,
  role: z.enum(["team_admin", "coach", "crew"]),
  teamId: z.string().uuid(),
  avatarUrl: optionalAvatarUrlSchema,
})

export const deleteCrewMemberInputSchema = z.object({
  membershipId: z.string().uuid(),
})

export type UpdateCrewMemberInput = z.infer<typeof updateCrewMemberInputSchema>
export type DeleteCrewMemberInput = z.infer<typeof deleteCrewMemberInputSchema>
