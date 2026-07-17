import { z } from "zod"

const requiredNameSchema = z.string().trim().min(1).max(80)
const requiredEmailSchema = z.string().trim().email().max(320).toLowerCase()

const optionalAvatarUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal("")])
  .optional()
const optionalTeamIdSchema = z.union([z.string().uuid(), z.literal("")]).optional()

const inviteRoleSchema = z.enum([
  "organization_admin",
  "team_admin",
  "coach",
  "crew",
])
const teamRoleSchema = z.enum(["team_admin", "coach", "crew"])

export const createCrewMemberInputSchema = z
  .object({
    email: requiredEmailSchema,
    firstName: requiredNameSchema,
    lastName: requiredNameSchema,
    role: inviteRoleSchema,
    teamId: optionalTeamIdSchema,
    avatarUrl: optionalAvatarUrlSchema,
  })
  .superRefine((value, context) => {
    if (value.role === "organization_admin") {
      return
    }

    if (!value.teamId) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Team is required for team member invites.",
      })
    }
  })

export const updateCrewMemberInputSchema = z.object({
  membershipId: z.string().uuid(),
  profileId: z.string().uuid(),
  firstName: requiredNameSchema,
  lastName: requiredNameSchema,
  role: teamRoleSchema,
  teamId: z.string().uuid(),
  avatarUrl: optionalAvatarUrlSchema,
})

export const unlinkCrewMemberInputSchema = z
  .object({
    membershipId: z.string().uuid().optional(),
    profileId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (!value.membershipId && !value.profileId) {
      context.addIssue({
        code: "custom",
        path: ["membershipId"],
        message: "A membership or profile is required to unlink a member.",
      })
    }
  })

export const deleteUserInputSchema = z.object({
  profileId: z.string().uuid(),
})

export type CreateCrewMemberInput = z.infer<typeof createCrewMemberInputSchema>
export type UpdateCrewMemberInput = z.infer<typeof updateCrewMemberInputSchema>
export type UnlinkCrewMemberInput = z.infer<typeof unlinkCrewMemberInputSchema>
export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>
