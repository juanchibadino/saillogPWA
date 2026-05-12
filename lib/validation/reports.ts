import { z } from "zod"

export const reportYearSchema = z.coerce.number().int().min(2000).max(2100)

export const reportRedirectToSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith("/"), {
    message: "Redirect target must be an internal path",
  })

export const createTeamVenueReportInputSchema = z.object({
  teamVenueId: z.string().uuid(),
  year: reportYearSchema,
  reportName: z.string().trim().max(200).optional(),
  campIds: z.array(z.string().uuid()).min(1).max(50),
  redirectTo: reportRedirectToSchema,
})

export type CreateTeamVenueReportInput = z.infer<typeof createTeamVenueReportInputSchema>
