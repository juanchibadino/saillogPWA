import { z } from "zod";

const requiredShortTextSchema = z.string().trim().min(1).max(120);

export const createVenueInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  country: requiredShortTextSchema,
  city: requiredShortTextSchema,
});

export const updateVenueInputSchema = createVenueInputSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export type CreateVenueInput = z.infer<typeof createVenueInputSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueInputSchema>;
