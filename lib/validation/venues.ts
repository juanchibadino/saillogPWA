import { z } from "zod";

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const optionalShortTextSchema = z
  .string()
  .optional()
  .transform((value) => normalizeOptionalText(value))
  .refine((value) => value === null || value.length <= 120, {
    message: "Must be 120 characters or less",
  });

const optionalLongTextSchema = z
  .string()
  .optional()
  .transform((value) => normalizeOptionalText(value))
  .refine((value) => value === null || value.length <= 2000, {
    message: "Must be 2000 characters or less",
  });

export const createVenueInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  country: optionalShortTextSchema,
  city: optionalShortTextSchema,
  venueType: optionalShortTextSchema,
  notes: optionalLongTextSchema,
});

export const updateVenueInputSchema = createVenueInputSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export type CreateVenueInput = z.infer<typeof createVenueInputSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueInputSchema>;
