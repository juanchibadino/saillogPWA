"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  deleteCrewMemberInputSchema,
  updateCrewMemberInputSchema,
} from "@/lib/validation/users"

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
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })
  const scopeUsersTeamId = getFormString(formData, "scopeUsersTeamId")

  if (!parsedScope.success) {
    return {
      scopeUsersTeamId,
    }
  }

  return {
    ...parsedScope.data,
    scopeUsersTeamId,
  }
}

function normalizeAvatarUrl(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildUsersRedirectPath(input: {
  status?: "updated" | "deleted"
  error?: "invalid_input" | "forbidden" | "update_failed" | "delete_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeUsersTeamId?: string
}): string {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId)
  }

  if (input.scopeUsersTeamId) {
    params.set("team", input.scopeUsersTeamId)
  }

  const query = params.toString()
  return query.length > 0 ? `/users?${query}` : "/users"
}

type ScopedMembership = {
  id: string
  profile_id: string
  team_id: string
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

  let adminSupabase: ReturnType<typeof createAdminSupabaseClient>
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

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      first_name: parsedInput.data.firstName,
      last_name: parsedInput.data.lastName,
      photo_url: normalizeAvatarUrl(parsedInput.data.avatarUrl),
    })
    .eq("id", parsedInput.data.profileId)

  if (profileUpdateError) {
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

  let adminSupabase: ReturnType<typeof createAdminSupabaseClient>
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
