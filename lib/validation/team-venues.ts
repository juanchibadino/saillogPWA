import { z } from "zod";

export const createTeamVenueLinkInputSchema = z.object({
  venueId: z.string().uuid(),
});

const requiredShortTextSchema = z.string().trim().min(1).max(120);

export const createAndLinkTeamVenueInputSchema = z.object({
  name: requiredShortTextSchema,
  country: requiredShortTextSchema,
  city: requiredShortTextSchema,
});

export const updateTeamVenueInputSchema = z.object({
  teamVenueId: z.string().uuid(),
  name: requiredShortTextSchema,
  country: requiredShortTextSchema,
  city: requiredShortTextSchema,
});

export const deleteTeamVenueInputSchema = z.object({
  teamVenueId: z.string().uuid(),
});

export type CreateTeamVenueLinkInput = z.infer<typeof createTeamVenueLinkInputSchema>;
export type CreateAndLinkTeamVenueInput = z.infer<
  typeof createAndLinkTeamVenueInputSchema
>;
export type UpdateTeamVenueInput = z.infer<typeof updateTeamVenueInputSchema>;
export type DeleteTeamVenueInput = z.infer<typeof deleteTeamVenueInputSchema>;
