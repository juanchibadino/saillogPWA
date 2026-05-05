import { z } from "zod";

export const scopeFormInputSchema = z.object({
  scopeOrgId: z.string().uuid().optional(),
  scopeTeamId: z.string().uuid().optional(),
});

export type ScopeFormInput = z.infer<typeof scopeFormInputSchema>;
