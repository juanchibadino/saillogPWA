"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { buildUsersRedirectPath } from "@/features/users/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createCrewMemberInputSchema,
  deleteCrewMemberInputSchema,
  updateCrewMemberInputSchema,
} from "@/lib/validation/users"
import type { Database } from "@/types/database"

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getScopeFromFormData(formData: FormData): {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeUsersTeamId?: string
  scopePage?: number
  scopeLoadMoreMode?: boolean
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })
  const scopeUsersTeamId = getFormString(formData, "scopeUsersTeamId")
  const scopePageValue = getFormString(formData, "scopePage")
  const parsedScopePage = scopePageValue
    ? Number.parseInt(scopePageValue, 10)
    : 1
  const scopePage =
    Number.isFinite(parsedScopePage) && parsedScopePage > 1
      ? Math.floor(parsedScopePage)
      : undefined
  const scopeLoadMoreMode = getFormString(formData, "scopeLoadMoreMode") === "1"

  if (!parsedScope.success) {
    return {
      scopeUsersTeamId,
      scopePage,
      scopeLoadMoreMode,
    }
  }

  return {
    ...parsedScope.data,
    scopeUsersTeamId,
    scopePage,
    scopeLoadMoreMode,
  }
}

function normalizeAvatarUrl(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildUserNameMetadata(input: {
  firstName: string
  lastName: string
}): Record<string, string> {
  const fullName = `${input.firstName} ${input.lastName}`.trim()

  return {
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: fullName,
    name: fullName,
  }
}

type ScopedMembership = {
  id: string
  profile_id: string
  team_id: string
}

type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>

type ProfileLookupRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "email"
>

type MembershipLookupRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "id" | "role" | "is_active"
>

async function resolveScopedMembership(input: {
  membershipId: string
  scopeOrgId: string
}): Promise<ScopedMembership | null> {
  try {
    const adminSupabase = createAdminSupabaseClient()

    const { data: membershipRow, error: membershipError } = await adminSupabase
      .from("team_memberships")
      .select("id,profile_id,team_id")
      .eq("id", input.membershipId)
      .eq("is_active", true)
      .maybeSingle()

    if (membershipError || !membershipRow) {
      return null
    }

    const { data: teamRow, error: teamError } = await adminSupabase
      .from("teams")
      .select("id")
      .eq("id", membershipRow.team_id)
      .eq("organization_id", input.scopeOrgId)
      .eq("is_active", true)
      .maybeSingle()

    if (teamError || !teamRow) {
      return null
    }

    return membershipRow
  } catch {
    return null
  }
}

async function isValidTargetTeam(input: {
  scopeOrgId: string
  teamId: string
}): Promise<boolean> {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data: teamRow, error: teamError } = await adminSupabase
      .from("teams")
      .select("id")
      .eq("id", input.teamId)
      .eq("organization_id", input.scopeOrgId)
      .eq("is_active", true)
      .maybeSingle()

    if (teamError) {
      return false
    }

    return Boolean(teamRow)
  } catch {
    return false
  }
}

async function getProfileByEmail(input: {
  adminSupabase: AdminSupabaseClient
  email: string
}): Promise<ProfileLookupRow | null> {
  const { data, error } = await input.adminSupabase
    .from("profiles")
    .select("id,email")
    .ilike("email", input.email)
    .limit(20)

  if (error) {
    throw new Error(`Could not look up member profile: ${error.message}`)
  }

  return (
    (data ?? []).find(
      (profile) => (profile.email ?? "").trim().toLowerCase() === input.email,
    ) ?? null
  )
}

async function ensureCrewMemberProfile(input: {
  adminSupabase: AdminSupabaseClient
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}): Promise<string | null> {
  const existingProfile = await getProfileByEmail({
    adminSupabase: input.adminSupabase,
    email: input.email,
  })

  if (existingProfile) {
    return existingProfile.id
  }

  const { data, error } = await input.adminSupabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: buildUserNameMetadata({
      firstName: input.firstName,
      lastName: input.lastName,
    }),
  })

  if (error || !data.user) {
    return null
  }

  const { error: profileUpsertError } = await input.adminSupabase
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        photo_url: input.avatarUrl,
        is_active: true,
      },
      {
        onConflict: "id",
      },
    )

  if (profileUpsertError) {
    return null
  }

  return data.user.id
}

async function syncCrewMemberProfile(input: {
  adminSupabase: AdminSupabaseClient
  profileId: string
  email?: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}): Promise<boolean> {
  const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
    first_name: input.firstName,
    last_name: input.lastName,
    photo_url: input.avatarUrl,
    is_active: true,
  }

  if (input.email) {
    profileUpdate.email = input.email
  }

  const { error: profileUpdateError } = await input.adminSupabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", input.profileId)

  if (profileUpdateError) {
    return false
  }

  const { error: authUpdateError } =
    await input.adminSupabase.auth.admin.updateUserById(input.profileId, {
      user_metadata: buildUserNameMetadata({
        firstName: input.firstName,
        lastName: input.lastName,
      }),
    })

  return !authUpdateError
}

async function getTeamMembershipsForProfile(input: {
  adminSupabase: AdminSupabaseClient
  teamId: string
  profileId: string
}): Promise<MembershipLookupRow[] | null> {
  const { data, error } = await input.adminSupabase
    .from("team_memberships")
    .select("id,role,is_active")
    .eq("team_id", input.teamId)
    .eq("profile_id", input.profileId)

  if (error) {
    return null
  }

  return data ?? []
}

export async function createCrewMemberAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = createCrewMemberInputSchema.safeParse({
    email: getFormString(formData, "email"),
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    role: getFormString(formData, "role"),
    teamId: getFormString(formData, "teamId"),
    avatarUrl: getFormString(formData, "avatarUrl"),
  })

  if (!parsedInput.success || !scope.scopeOrgId) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!canManageOrganizationOperations(context, scope.scopeOrgId)) {
    redirect(
      buildUsersRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const validTargetTeam = await isValidTargetTeam({
    scopeOrgId: scope.scopeOrgId,
    teamId: parsedInput.data.teamId,
  })

  if (!validTargetTeam) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  let adminSupabase: AdminSupabaseClient
  try {
    adminSupabase = createAdminSupabaseClient()
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  const avatarUrl = normalizeAvatarUrl(parsedInput.data.avatarUrl)
  let profileId: string | null = null

  try {
    profileId = await ensureCrewMemberProfile({
      adminSupabase,
      email: parsedInput.data.email,
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
      avatarUrl,
    })
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  if (!profileId) {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  const syncedProfile = await syncCrewMemberProfile({
    adminSupabase,
    profileId,
    email: parsedInput.data.email,
    firstName: parsedInput.data.firstName,
    lastName: parsedInput.data.lastName,
    avatarUrl,
  })

  if (!syncedProfile) {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  const existingMemberships = await getTeamMembershipsForProfile({
    adminSupabase,
    teamId: parsedInput.data.teamId,
    profileId,
  })

  if (!existingMemberships) {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  const activeMembership = existingMemberships.find(
    (membership) => membership.is_active,
  )

  if (activeMembership) {
    redirect(
      buildUsersRedirectPath({
        error: "member_exists",
        ...scope,
      }),
    )
  }

  const reusableMembership = existingMemberships.find(
    (membership) =>
      !membership.is_active && membership.role === parsedInput.data.role,
  )
  const joinedAt = new Date().toISOString()

  if (reusableMembership) {
    const { error: membershipUpdateError } = await adminSupabase
      .from("team_memberships")
      .update({
        is_active: true,
        joined_at: joinedAt,
        left_at: null,
      })
      .eq("id", reusableMembership.id)

    if (membershipUpdateError) {
      redirect(
        buildUsersRedirectPath({
          error: "create_failed",
          ...scope,
        }),
      )
    }
  } else {
    const { error: membershipInsertError } = await adminSupabase
      .from("team_memberships")
      .insert({
        team_id: parsedInput.data.teamId,
        profile_id: profileId,
        role: parsedInput.data.role,
        is_active: true,
        joined_at: joinedAt,
        left_at: null,
      })

    if (membershipInsertError) {
      redirect(
        buildUsersRedirectPath({
          error: "create_failed",
          ...scope,
        }),
      )
    }
  }

  revalidatePath("/users")
  revalidatePath("/team-home")

  redirect(
    buildUsersRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateCrewMemberAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = updateCrewMemberInputSchema.safeParse({
    membershipId: getFormString(formData, "membershipId"),
    profileId: getFormString(formData, "profileId"),
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    role: getFormString(formData, "role"),
    teamId: getFormString(formData, "teamId"),
    avatarUrl: getFormString(formData, "avatarUrl"),
  })

  if (!parsedInput.success || !scope.scopeOrgId) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!canManageOrganizationOperations(context, scope.scopeOrgId)) {
    redirect(
      buildUsersRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedMembership = await resolveScopedMembership({
    membershipId: parsedInput.data.membershipId,
    scopeOrgId: scope.scopeOrgId,
  })

  if (!scopedMembership || scopedMembership.profile_id !== parsedInput.data.profileId) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const validTargetTeam = await isValidTargetTeam({
    scopeOrgId: scope.scopeOrgId,
    teamId: parsedInput.data.teamId,
  })

  if (!validTargetTeam) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  let adminSupabase: AdminSupabaseClient
  try {
    adminSupabase = createAdminSupabaseClient()
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const syncedProfile = await syncCrewMemberProfile({
    adminSupabase,
    profileId: parsedInput.data.profileId,
    firstName: parsedInput.data.firstName,
    lastName: parsedInput.data.lastName,
    avatarUrl: normalizeAvatarUrl(parsedInput.data.avatarUrl),
  })

  if (!syncedProfile) {
    redirect(
      buildUsersRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error: membershipUpdateError } = await adminSupabase
    .from("team_memberships")
    .update({
      team_id: parsedInput.data.teamId,
      role: parsedInput.data.role,
    })
    .eq("id", parsedInput.data.membershipId)

  if (membershipUpdateError) {
    redirect(
      buildUsersRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/users")
  revalidatePath("/team-home")

  redirect(
    buildUsersRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function deleteCrewMemberAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = deleteCrewMemberInputSchema.safeParse({
    membershipId: getFormString(formData, "membershipId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!canManageOrganizationOperations(context, scope.scopeOrgId)) {
    redirect(
      buildUsersRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedMembership = await resolveScopedMembership({
    membershipId: parsedInput.data.membershipId,
    scopeOrgId: scope.scopeOrgId,
  })

  if (!scopedMembership) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  let adminSupabase: AdminSupabaseClient
  try {
    adminSupabase = createAdminSupabaseClient()
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  const { error: updateError } = await adminSupabase
    .from("team_memberships")
    .update({
      is_active: false,
      left_at: new Date().toISOString(),
    })
    .eq("id", parsedInput.data.membershipId)

  if (updateError) {
    redirect(
      buildUsersRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/users")
  revalidatePath("/team-home")

  redirect(
    buildUsersRedirectPath({
      status: "deleted",
      ...scope,
    }),
  )
}
