"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import { canManageOrganizationOperations } from "@/lib/auth/capabilities";
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements";
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scopeFormInputSchema } from "@/lib/validation/navigation";
import {
  createVenueInputSchema,
  updateVenueInputSchema,
} from "@/lib/validation/venues";

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

function getSafeVenueRedirectTarget(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  if (!value.startsWith("/")) {
    return null
  }

  if (!value.startsWith("/venues")) {
    return null
  }

  return value
}

function getBooleanField(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
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

function buildVenueRedirectPath(input: {
  status?: "created" | "updated";
  error?:
    | "invalid_input"
    | "forbidden"
    | "create_failed"
    | "update_failed"
    | "plan_limit_reached"
    | "payment_required";
  scopeOrgId?: string;
  scopeTeamId?: string;
  redirectTo?: string;
}): string {
  const basePath = getSafeVenueRedirectTarget(input.redirectTo) ?? "/venues"
  const [pathname, queryString = ""] = basePath.split("?")
  const params = new URLSearchParams();
  const existingParams = new URLSearchParams(queryString)

  for (const [key, value] of existingParams.entries()) {
    params.set(key, value)
  }

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.error) {
    params.set("error", input.error);
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId);
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId);
  }

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname
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
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);
  const redirectTo = getFormString(formData, "redirectTo")

  const parsedInput = updateVenueInputSchema.safeParse({
    id: getFormString(formData, "id"),
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
    isActive: getBooleanField(formData, "isActive"),
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

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("venues")
    .update({
      organization_id: parsedInput.data.organizationId,
      name: parsedInput.data.name,
      country: parsedInput.data.country,
      city: parsedInput.data.city,
      is_active: parsedInput.data.isActive,
    })
    .eq("id", parsedInput.data.id);

  if (error) {
    redirect(
      buildVenueRedirectPath({
        error: "update_failed",
        ...scope,
        redirectTo,
      }),
    );
  }

  const successPath = buildVenueRedirectPath({
    status: "updated",
    ...scope,
    redirectTo,
  })

  revalidatePath("/venues");
  revalidatePath(successPath.split("?")[0] ?? "/venues")
  redirect(successPath)
}
