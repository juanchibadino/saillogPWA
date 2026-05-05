import { z } from "zod";

export const createTeamVenueLinkInputSchema = z.object({
  venueId: z.string().uuid(),
});

export type CreateTeamVenueLinkInput = z.infer<typeof createTeamVenueLinkInputSchema>;
