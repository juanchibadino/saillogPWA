"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import { canManageOrganizationOperations } from "@/lib/auth/capabilities";
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements";
import { buildVenueRedirectPath } from "@/features/venues/action-rules.mjs";
import { runUpdateVenueAction } from "@/features/venues/update-action-core.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scopeFormInputSchema } from "@/lib/validation/navigation";
import { createVenueInputSchema } from "@/lib/validation/venues";

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

function getScopeFromFormData(formData: FormData): {
  scopeOrgId?: string;
  scopeTeamId?: string;
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  });

  if (!parsedScope.success) {
    return {};
  }

  return parsedScope.data;
}

export async function createVenueAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);
  const redirectTo = getFormString(formData, "redirectTo")

  const parsedInput = createVenueInputSchema.safeParse({
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
  });

  if (!parsedInput.success) {
    redirect(
      buildVenueRedirectPath({
        error: "invalid_input",
        ...scope,
        redirectTo,
      }),
    );
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    redirect(
      buildVenueRedirectPath({
        error: "forbidden",
        ...scope,
        redirectTo,
      }),
    );
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: parsedInput.data.organizationId,
    resource: "venues",
  });

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildVenueRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
        redirectTo,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("venues").insert({
    organization_id: parsedInput.data.organizationId,
    name: parsedInput.data.name,
    country: parsedInput.data.country,
    city: parsedInput.data.city,
    is_active: true,
  });

  if (error) {
    redirect(
      buildVenueRedirectPath({
        error: "create_failed",
        ...scope,
        redirectTo,
      }),
    );
  }

  revalidatePath("/venues");
  redirect(
    buildVenueRedirectPath({
      status: "created",
      ...scope,
      redirectTo,
    }),
  );
}

export async function updateVenueAction(formData: FormData): Promise<void> {
  await runUpdateVenueAction(formData, {
    createServerSupabaseClient,
    redirect,
    requireAuthenticatedAccessContext,
    revalidatePath,
  });
}
