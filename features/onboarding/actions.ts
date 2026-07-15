"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { hasAppAccess, requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { generateUniqueOrganizationSlug, generateUniqueTeamSlug } from "@/lib/db/slugs"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"
import {
  onboardingFormInputSchema,
  type OnboardingFormInput,
} from "@/lib/validation/onboarding"
import type { SupabaseClient } from "@supabase/supabase-js"

type DatabaseClient = SupabaseClient<Database>

export type OnboardingSubmitState = {
  error: string | null
}

const INVALID_INPUT_ERROR_MESSAGE =
  "We could not save onboarding because some values were invalid. Review and try again."
const CREATE_FAILED_ERROR_MESSAGE =
  "We could not create your organization and team. Try again in a few seconds."

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function buildUserNameMetadata(input: {
  currentMetadata: unknown
  firstName: string
  lastName: string
}): Record<string, unknown> {
  const currentMetadata = isRecord(input.currentMetadata) ? input.currentMetadata : {}
  const fullName = `${input.firstName} ${input.lastName}`.trim()

  return {
    ...currentMetadata,
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: fullName,
    name: fullName,
  }
}

async function updateAuthUserName(input: {
  supabase: DatabaseClient
  userId: string
  currentMetadata: unknown
  firstName: string
  lastName: string
}): Promise<boolean> {
  const { error } = await input.supabase.auth.admin.updateUserById(input.userId, {
    user_metadata: buildUserNameMetadata({
      currentMetadata: input.currentMetadata,
      firstName: input.firstName,
      lastName: input.lastName,
    }),
  })

  return !error
}

async function saveOnboardingName(input: {
  supabase: DatabaseClient
  userId: string
  email: string
  currentMetadata: unknown
  values: Pick<OnboardingFormInput, "firstName" | "lastName">
}): Promise<boolean> {
  const { error: profileUpsertError } = await input.supabase
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        email: input.email,
        first_name: input.values.firstName,
        last_name: input.values.lastName,
        is_active: true,
        is_profile_complete: false,
        profile_completed_at: null,
      },
      {
        onConflict: "id",
      },
    )

  if (profileUpsertError) {
    return false
  }

  return updateAuthUserName({
    supabase: input.supabase,
    userId: input.userId,
    currentMetadata: input.currentMetadata,
    firstName: input.values.firstName,
    lastName: input.values.lastName,
  })
}

async function createOrganizationWithUniqueSlug(input: {
  supabase: DatabaseClient
  name: string
}): Promise<{
  organizationId: string | null
  error: { code?: string; message: string } | null
}> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await generateUniqueOrganizationSlug({
      supabase: input.supabase,
      name: input.name,
    })

    const { data, error } = await input.supabase
      .from("organizations")
      .insert({
        name: input.name,
        slug,
        is_active: true,
      })
      .select("id")
      .single()

    if (!error && data) {
      return {
        organizationId: data.id,
        error: null,
      }
    }

    if (!error || error.code !== "23505") {
      return {
        organizationId: null,
        error,
      }
    }
  }

  return {
    organizationId: null,
    error: {
      message: "Could not create organization after resolving slug collisions.",
    },
  }
}

async function createTeamWithUniqueSlug(input: {
  supabase: DatabaseClient
  organizationId: string
  name: string
  teamType: "49er" | "Laser" | "Nacra"
}): Promise<{
  teamId: string | null
  error: { code?: string; message: string } | null
}> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await generateUniqueTeamSlug({
      supabase: input.supabase,
      organizationId: input.organizationId,
      name: input.name,
    })

    const { data, error } = await input.supabase
      .from("teams")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        slug,
        team_type: input.teamType,
        is_active: true,
      })
      .select("id")
      .single()

    if (!error && data) {
      return {
        teamId: data.id,
        error: null,
      }
    }

    if (!error || error.code !== "23505") {
      return {
        teamId: null,
        error,
      }
    }
  }

  return {
    teamId: null,
    error: {
      message: "Could not create team after resolving slug collisions.",
    },
  }
}

export async function completeOnboardingAction(
  _previousState: OnboardingSubmitState,
  formData: FormData,
): Promise<OnboardingSubmitState> {
  const context = await requireAuthenticatedAccessContext()
  const hasAnyMembership =
    context.organizationMemberships.length > 0 || context.teamMemberships.length > 0

  if (hasAppAccess(context) || hasAnyMembership) {
    redirect("/dashboard")
  }

  const parsedInput = onboardingFormInputSchema.safeParse({
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    organizationName: getFormString(formData, "organizationName"),
    teamName: getFormString(formData, "teamName"),
    isCoach: getFormString(formData, "isCoach"),
    teamClass: getFormString(formData, "teamClass"),
  })

  if (!parsedInput.success) {
    return {
      error: INVALID_INPUT_ERROR_MESSAGE,
    }
  }

  const resolvedEmail = (context.user.email ?? context.profile?.email ?? "").trim()

  if (resolvedEmail.length === 0) {
    return {
      error: INVALID_INPUT_ERROR_MESSAGE,
    }
  }

  let adminSupabase: ReturnType<typeof createAdminSupabaseClient>

  try {
    adminSupabase = createAdminSupabaseClient()
  } catch {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  const wasNameSaved = await saveOnboardingName({
    supabase: adminSupabase,
    userId: context.user.id,
    email: resolvedEmail,
    currentMetadata: context.user.user_metadata,
    values: {
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
    },
  })

  if (!wasNameSaved) {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  let organizationInsertResult: Awaited<
    ReturnType<typeof createOrganizationWithUniqueSlug>
  >

  try {
    organizationInsertResult = await createOrganizationWithUniqueSlug({
      supabase: adminSupabase,
      name: parsedInput.data.organizationName,
    })
  } catch {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  if (organizationInsertResult.error || !organizationInsertResult.organizationId) {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  const organizationId = organizationInsertResult.organizationId

  const { error: organizationMembershipError } = await adminSupabase
    .from("organization_memberships")
    .upsert(
      {
        organization_id: organizationId,
        profile_id: context.user.id,
        role: "organization_admin",
      },
      {
        onConflict: "organization_id,profile_id,role",
      },
    )

  if (organizationMembershipError) {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  let teamInsertResult: Awaited<ReturnType<typeof createTeamWithUniqueSlug>>

  try {
    teamInsertResult = await createTeamWithUniqueSlug({
      supabase: adminSupabase,
      organizationId,
      name: parsedInput.data.teamName,
      teamType: parsedInput.data.teamClass,
    })
  } catch {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  if (teamInsertResult.error || !teamInsertResult.teamId) {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  const teamId = teamInsertResult.teamId

  if (parsedInput.data.isCoach === "yes") {
    const { error: coachMembershipError } = await adminSupabase
      .from("team_memberships")
      .upsert(
        {
          team_id: teamId,
          profile_id: context.user.id,
          role: "coach",
          is_active: true,
          left_at: null,
        },
        {
          onConflict: "team_id,profile_id,role",
        },
      )

    if (coachMembershipError) {
      return {
        error: CREATE_FAILED_ERROR_MESSAGE,
      }
    }
  }

  const { error: completeProfileError } = await adminSupabase
    .from("profiles")
    .update({
      email: resolvedEmail,
      first_name: parsedInput.data.firstName,
      last_name: parsedInput.data.lastName,
      is_profile_complete: true,
      profile_completed_at: new Date().toISOString(),
    })
    .eq("id", context.user.id)

  if (completeProfileError) {
    return {
      error: CREATE_FAILED_ERROR_MESSAGE,
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/team-home")

  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, organizationId)
  params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, teamId)

  redirect(`/team-home?${params.toString()}`)
}
