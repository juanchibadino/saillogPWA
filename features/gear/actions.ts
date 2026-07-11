"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  runCreateGearItemAction,
  runRetireGearItemAction,
  runUpdateGearItemAction,
} from "@/features/gear/action-core.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const gearActionDependencies = {
  createServerSupabaseClient,
  redirect,
  requireAuthenticatedAccessContext,
  revalidatePath,
}

export async function createGearItemAction(formData: FormData): Promise<void> {
  await runCreateGearItemAction(formData, gearActionDependencies)
}

export async function updateGearItemAction(formData: FormData): Promise<void> {
  await runUpdateGearItemAction(formData, gearActionDependencies)
}

export async function retireGearItemAction(formData: FormData): Promise<void> {
  await runRetireGearItemAction(formData, gearActionDependencies)
}
