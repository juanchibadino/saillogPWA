"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  runArchiveTeamStandardMoveAction,
  runCreateTeamStandardMoveAction,
  runRestoreTeamStandardMoveAction,
  runUpdateTeamStandardMoveAction,
} from "@/features/standard-moves/action-core.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const standardMoveActionDependencies = {
  createServerSupabaseClient,
  redirect,
  requireAuthenticatedAccessContext,
  revalidatePath,
}

export async function createTeamStandardMoveAction(formData: FormData): Promise<void> {
  await runCreateTeamStandardMoveAction(formData, standardMoveActionDependencies)
}

export async function updateTeamStandardMoveAction(formData: FormData): Promise<void> {
  await runUpdateTeamStandardMoveAction(formData, standardMoveActionDependencies)
}

export async function archiveTeamStandardMoveAction(formData: FormData): Promise<void> {
  await runArchiveTeamStandardMoveAction(formData, standardMoveActionDependencies)
}

export async function restoreTeamStandardMoveAction(formData: FormData): Promise<void> {
  await runRestoreTeamStandardMoveAction(formData, standardMoveActionDependencies)
}
