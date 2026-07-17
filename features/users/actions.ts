"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { resolveMemberInviteTarget } from "@/features/users/invite-rules.mjs"
import {
  buildUsersRedirectPath as buildUsersListRedirectPath,
} from "@/features/users/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { resolveCurrentRequestOrigin } from "@/lib/http/request-origin"
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
  redirectTo?: string
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
  const redirectToValue = getFormString(formData, "redirectTo")
  const redirectTo =
    redirectToValue === "/team-home" || redirectToValue === "/users"
      ? redirectToValue
      : undefined

  if (!parsedScope.success) {
    return {
      scopeUsersTeamId,
      scopePage,
      scopeLoadMoreMode,
      redirectTo,
    }
  }

  return {
    ...parsedScope.data,
    scopeUsersTeamId,
    scopePage,
    scopeLoadMoreMode,
    redirectTo,
  }
}

function buildMemberMutationRedirectPath(input: {
  error?: string
  redirectTo?: string
  scopeLoadMoreMode?: boolean
  scopeOrgId?: string
  scopePage?: number
  scopeTeamId?: string
  scopeUsersTeamId?: string
  status?: string
}): string {
  if (input.redirectTo !== "/team-home") {
    return buildUsersListRedirectPath(input)
  }

  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-home?${query}` : "/team-home"
}

function buildUsersRedirectPath(
  input: Parameters<typeof buildMemberMutationRedirectPath>[0],
): string {
  return buildMemberMutationRedirectPath(input)
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
  "id" | "email" | "first_seen_at"
>

type MembershipLookupRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "id" | "role" | "is_active"
>

type EnsureCrewMemberProfileResult =
  | {
      cleanupAuthUserId: string | null
      profileId: string
      shouldSendInviteEmail: boolean
      status: "ok"
    }
  | {
      error: "create_failed" | "invite_email_failed"
      status: "error"
    }

type SupabaseInviteEmailResult = {
  userId: string | null
}

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
    .select("id,email,first_seen_at")
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
  role: string
}): Promise<EnsureCrewMemberProfileResult> {
  const existingProfile = await getProfileByEmail({
    adminSupabase: input.adminSupabase,
    email: input.email,
  })

  if (existingProfile) {
    return {
      cleanupAuthUserId: null,
      profileId: existingProfile.id,
      shouldSendInviteEmail: !existingProfile.first_seen_at,
      status: "ok",
    }
  }

  const inviteResult = await sendSupabaseInviteEmail({
    adminSupabase: input.adminSupabase,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
  })

  if (!inviteResult?.userId) {
    return {
      error: "invite_email_failed",
      status: "error",
    }
  }

  const { error: profileUpsertError } = await input.adminSupabase
    .from("profiles")
    .upsert(
      {
        id: inviteResult.userId,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        first_seen_at: null,
        photo_url: input.avatarUrl,
        is_active: true,
      },
      {
        onConflict: "id",
      },
    )

  if (profileUpsertError) {
    await cleanupInvitedAuthUser({
      adminSupabase: input.adminSupabase,
      authUserId: inviteResult.userId,
    })

    return {
      error: "create_failed",
      status: "error",
    }
  }

  return {
    cleanupAuthUserId: inviteResult.userId,
    profileId: inviteResult.userId,
    shouldSendInviteEmail: false,
    status: "ok",
  }
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

async function getOrganizationMembershipForProfile(input: {
  adminSupabase: AdminSupabaseClient
  organizationId: string
  profileId: string
}): Promise<{ id: string } | null> {
  const { data, error } = await input.adminSupabase
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("profile_id", input.profileId)
    .eq("role", "organization_admin")
    .maybeSingle()

  if (error) {
    return null
  }

  return data
}

async function buildInviteRedirectTo(): Promise<string> {
  const origin = await resolveCurrentRequestOrigin()
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", "/post-auth")

  return callbackUrl.toString()
}

async function sendSupabaseInviteEmail(input: {
  adminSupabase: AdminSupabaseClient
  email: string
  firstName: string
  lastName: string
  role: string
}): Promise<SupabaseInviteEmailResult | null> {
  const redirectTo = await buildInviteRedirectTo()
  const { data, error } = await input.adminSupabase.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo,
      data: {
        ...buildUserNameMetadata({
          firstName: input.firstName,
          lastName: input.lastName,
        }),
        invited_role: input.role,
      },
    },
  )

  if (error) {
    return null
  }

  return {
    userId: data.user?.id ?? null,
  }
}

async function cleanupInvitedAuthUser(input: {
  adminSupabase: AdminSupabaseClient
  authUserId: string | null
}): Promise<void> {
  if (!input.authUserId) {
    return
  }

  await input.adminSupabase.auth.admin.deleteUser(input.authUserId)
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

  const inviteTarget = resolveMemberInviteTarget({
    role: parsedInput.data.role,
    teamId: parsedInput.data.teamId,
  })

  if (!inviteTarget) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (inviteTarget.kind === "team") {
    const validTargetTeam = await isValidTargetTeam({
      scopeOrgId: scope.scopeOrgId,
      teamId: inviteTarget.teamId,
    })

    if (!validTargetTeam) {
      redirect(
        buildUsersRedirectPath({
          error: "invalid_input",
          ...scope,
        }),
      )
    }
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
  let profileResult: EnsureCrewMemberProfileResult | null = null

  try {
    profileResult = await ensureCrewMemberProfile({
      adminSupabase,
      email: parsedInput.data.email,
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
      avatarUrl,
      role: parsedInput.data.role,
    })
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  if (!profileResult || profileResult.status === "error") {
    redirect(
      buildUsersRedirectPath({
        error: profileResult?.status === "error" ? profileResult.error : "create_failed",
        ...scope,
      }),
    )
  }

  const profileId = profileResult.profileId
  const cleanupAuthUserId = profileResult.cleanupAuthUserId
  async function redirectAfterProvisioningFailure(error: string): Promise<never> {
    await cleanupInvitedAuthUser({
      adminSupabase,
      authUserId: cleanupAuthUserId,
    })

    redirect(
      buildUsersRedirectPath({
        error,
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
    await redirectAfterProvisioningFailure("create_failed")
  }

  if (inviteTarget.kind === "organization") {
    const existingOrganizationMembership = await getOrganizationMembershipForProfile({
      adminSupabase,
      organizationId: scope.scopeOrgId,
      profileId,
    })

    if (existingOrganizationMembership) {
      await redirectAfterProvisioningFailure("member_exists")
    }

    const { error: organizationMembershipInsertError } = await adminSupabase
      .from("organization_memberships")
      .insert({
        organization_id: scope.scopeOrgId,
        profile_id: profileId,
        role: "organization_admin",
      })

    if (organizationMembershipInsertError) {
      await redirectAfterProvisioningFailure("create_failed")
    }
  } else {
    const existingMemberships = await getTeamMembershipsForProfile({
      adminSupabase,
      teamId: inviteTarget.teamId,
      profileId,
    })

    if (!existingMemberships) {
      await redirectAfterProvisioningFailure("create_failed")
    }

    const resolvedMemberships = existingMemberships ?? []
    const activeMembership = resolvedMemberships.find(
      (membership) => membership.is_active,
    )

    if (activeMembership) {
      await redirectAfterProvisioningFailure("member_exists")
    }

    const reusableMembership = resolvedMemberships.find(
      (membership) =>
        !membership.is_active && membership.role === inviteTarget.teamRole,
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
        await redirectAfterProvisioningFailure("create_failed")
      }
    } else {
      const { error: membershipInsertError } = await adminSupabase
        .from("team_memberships")
        .insert({
          team_id: inviteTarget.teamId,
          profile_id: profileId,
          role: inviteTarget.teamRole,
          is_active: true,
          joined_at: joinedAt,
          left_at: null,
        })

      if (membershipInsertError) {
        await redirectAfterProvisioningFailure("create_failed")
      }
    }
  }

  revalidatePath("/users")
  revalidatePath("/team-home")

  if (profileResult.shouldSendInviteEmail) {
    const inviteEmailResult = await sendSupabaseInviteEmail({
      adminSupabase,
      email: parsedInput.data.email,
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
      role: parsedInput.data.role,
    })

    if (!inviteEmailResult) {
      redirect(
        buildUsersRedirectPath({
          error: "invite_email_failed",
          ...scope,
        }),
      )
    }
  }

  redirect(
    buildUsersRedirectPath({
      status: "invited",
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
