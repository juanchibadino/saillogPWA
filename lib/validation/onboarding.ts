import { z } from "zod"

const requiredShortTextSchema = z.string().trim().min(1).max(120)

export const onboardingFormInputSchema = z.object({
  firstName: requiredShortTextSchema,
  lastName: requiredShortTextSchema,
  organizationName: requiredShortTextSchema,
  teamName: requiredShortTextSchema,
  isCoach: z.enum(["yes", "no"]),
  teamClass: z.enum(["49er", "Laser", "Nacra"]),
})

export type OnboardingFormInput = z.infer<typeof onboardingFormInputSchema>
