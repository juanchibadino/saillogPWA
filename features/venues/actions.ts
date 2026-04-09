"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

function getBooleanField(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export async function createVenueAction(formData: FormData): Promise<void> {
  await requireAuthenticatedAccessContext();

  const parsedInput = createVenueInputSchema.safeParse({
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
  });

  if (!parsedInput.success) {
    redirect("/venues?error=invalid_input");
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
    redirect("/venues?error=create_failed");
  }

  revalidatePath("/venues");
  redirect("/venues?status=created");
}

export async function updateVenueAction(formData: FormData): Promise<void> {
  await requireAuthenticatedAccessContext();

  const parsedInput = updateVenueInputSchema.safeParse({
    id: getFormString(formData, "id"),
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
    isActive: getBooleanField(formData, "isActive"),
  });

  if (!parsedInput.success) {
    redirect("/venues?error=invalid_input");
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
    redirect("/venues?error=update_failed");
  }

  revalidatePath("/venues");
  redirect("/venues?status=updated");
}
