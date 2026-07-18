"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { wouldRemoveAllAccessAfterUnlink } from "@/features/users/action-rules.mjs"
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
  deleteUserInputSchema,
  unlinkCrewMemberInputSchema,
  updateCrewMemberInputSchema,
} from "@/lib/validation/users"
import type { Database } from "@/types/database"

const PROFILE_AVATARS_BUCKET = "profile-avatars"
const PROFILE_AVATAR_MIME_TYPE = "image/webp"
const MAX_PROFILE_AVATAR_BYTES = 64 * 1024

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getFormFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key)

  if (!(value instanceof File) || value.size <= 0) {
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

function buildInviteEmailMetadata(input: {
  firstName: string
  inviteEmailContext: InviteEmailContext
  lastName: string
  role: string
}): Record<string, string> {
  const nameMetadata = buildUserNameMetadata({
    firstName: input.firstName,
    lastName: input.lastName,
  })
  const teamId = input.inviteEmailContext.teamId ?? ""
  const teamName = input.inviteEmailContext.teamName ?? ""

  return {
    ...nameMetadata,
    invite_name: nameMetadata.full_name,
    invited_role: input.role,
    organization: input.inviteEmailContext.organizationName,
    organization_id: input.inviteEmailContext.organizationId,
    organization_name: input.inviteEmailContext.organizationName,
    invited_organization_id: input.inviteEmailContext.organizationId,
    invited_organization_name: input.inviteEmailContext.organizationName,
    team: teamName,
    team_id: teamId,
    team_name: teamName,
    invited_team_id: teamId,
    invited_team_name: teamName,
  }
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function hasAsciiSignature(
  fileBytes: Uint8Array,
  offset: number,
  signature: string,
): boolean {
  if (fileBytes.length < offset + signature.length) {
    return false
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (fileBytes[offset + index] !== signature.charCodeAt(index)) {
      return false
    }
  }

  return true
}

function hasWebpFileSignature(fileBytes: Uint8Array): boolean {
  return (
    fileBytes.length >= 12 &&
    hasAsciiSignature(fileBytes, 0, "RIFF") &&
    hasAsciiSignature(fileBytes, 8, "WEBP")
  )
}

function buildProfileAvatarStoragePath(input: {
  fileName: string
  profileId: string
}): string {
  const safeName = sanitizeFileName(input.fileName) || "avatar.webp"
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `profiles/${input.profileId}/${timestamp}-${randomPart}-${safeName}`
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

type TeamMembershipScopeLookupRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "id" | "profile_id" | "team_id" | "is_active"
>

type OrganizationMembershipScopeLookupRow = Pick<
  Database["public"]["Tables"]["organization_memberships"]["Row"],
  "id" | "organization_id" | "profile_id"
>

type TeamOrganizationLookupRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "organization_id"
>

type MemberInviteTarget = NonNullable<
  ReturnType<typeof resolveMemberInviteTarget>
>

type InviteEmailContext = {
  organizationId: string
  organizationName: string
  teamId: string | null
  teamName: string | null
}

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
  adminSupabase?: AdminSupabaseClient
  membershipId: string
  scopeOrgId: string
}): Promise<ScopedMembership | null> {
  try {
    const adminSupabase = input.adminSupabase ?? createAdminSupabaseClient()

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

async function getTeamOrganizationById(input: {
  adminSupabase: AdminSupabaseClient
  teamIds: string[]
}): Promise<Map<string, string> | null> {
  const uniqueTeamIds = uniqueIds(input.teamIds)

  if (uniqueTeamIds.length === 0) {
    return new Map()
  }

  const { data, error } = await input.adminSupabase
    .from("teams")
    .select("id,organization_id")
    .in("id", uniqueTeamIds)

  if (error) {
    return null
  }

  const teamRows: TeamOrganizationLookupRow[] = data ?? []
  return new Map(teamRows.map((team) => [team.id, team.organization_id]))
}

async function getActiveTeamMembershipsForProfile(input: {
  adminSupabase: AdminSupabaseClient
  profileId: string
}): Promise<TeamMembershipScopeLookupRow[] | null> {
  const { data, error } = await input.adminSupabase
    .from("team_memberships")
    .select("id,profile_id,team_id,is_active")
    .eq("profile_id", input.profileId)
    .eq("is_active", true)

  if (error) {
    return null
  }

  return data ?? []
}

async function getScopedTeamMembershipsForProfile(input: {
  adminSupabase: AdminSupabaseClient
  profileId: string
  scopeOrgId: string
}): Promise<TeamMembershipScopeLookupRow[] | null> {
  const membershipRows = await getActiveTeamMembershipsForProfile({
    adminSupabase: input.adminSupabase,
    profileId: input.profileId,
  })

  if (!membershipRows) {
    return null
  }

  const teamOrganizationById = await getTeamOrganizationById({
    adminSupabase: input.adminSupabase,
    teamIds: membershipRows.map((membership) => membership.team_id),
  })

  if (!teamOrganizationById) {
    return null
  }

  return membershipRows.filter(
    (membership) => teamOrganizationById.get(membership.team_id) === input.scopeOrgId,
  )
}

async function getOrganizationMembershipsForProfile(input: {
  adminSupabase: AdminSupabaseClient
  profileId: string
}): Promise<OrganizationMembershipScopeLookupRow[] | null> {
  const { data, error } = await input.adminSupabase
    .from("organization_memberships")
    .select("id,organization_id,profile_id")
    .eq("profile_id", input.profileId)

  if (error) {
    return null
  }

  return data ?? []
}

async function wouldUnlinkRemoveAllAccess(input: {
  adminSupabase: AdminSupabaseClient
  membershipIdsToUnlink: string[]
  profileId: string
}): Promise<boolean | null> {
  const [teamMembershipRows, organizationMembershipRows] = await Promise.all([
    getActiveTeamMembershipsForProfile({
      adminSupabase: input.adminSupabase,
      profileId: input.profileId,
    }),
    getOrganizationMembershipsForProfile({
      adminSupabase: input.adminSupabase,
      profileId: input.profileId,
    }),
  ])

  if (!teamMembershipRows || !organizationMembershipRows) {
    return null
  }

  return wouldRemoveAllAccessAfterUnlink({
    activeTeamMembershipIds: teamMembershipRows.map((membership) => membership.id),
    organizationMembershipCount: organizationMembershipRows.length,
    unlinkMembershipIds: input.membershipIdsToUnlink,
  })
}

async function resolveUserDeleteScope(input: {
  adminSupabase: AdminSupabaseClient
  profileId: string
  scopeOrgId: string
}): Promise<{
  hasOutsideActiveAccess: boolean
  hasScopedAccess: boolean
  scopedOrganizationMembershipIds: string[]
  scopedTeamMembershipIds: string[]
} | null> {
  const [teamMembershipRows, organizationMembershipRows] = await Promise.all([
    getActiveTeamMembershipsForProfile({
      adminSupabase: input.adminSupabase,
      profileId: input.profileId,
    }),
    getOrganizationMembershipsForProfile({
      adminSupabase: input.adminSupabase,
      profileId: input.profileId,
    }),
  ])

  if (!teamMembershipRows || !organizationMembershipRows) {
    return null
  }

  const teamOrganizationById = await getTeamOrganizationById({
    adminSupabase: input.adminSupabase,
    teamIds: teamMembershipRows.map((membership) => membership.team_id),
  })

  if (!teamOrganizationById) {
    return null
  }

  const scopedTeamMembershipIds = teamMembershipRows
    .filter(
      (membership) =>
        teamOrganizationById.get(membership.team_id) === input.scopeOrgId,
    )
    .map((membership) => membership.id)
  const outsideTeamMemberships = teamMembershipRows.filter(
    (membership) => teamOrganizationById.get(membership.team_id) !== input.scopeOrgId,
  )
  const scopedOrganizationMembershipIds = organizationMembershipRows
    .filter((membership) => membership.organization_id === input.scopeOrgId)
    .map((membership) => membership.id)
  const outsideOrganizationMemberships = organizationMembershipRows.filter(
    (membership) => membership.organization_id !== input.scopeOrgId,
  )

  return {
    hasOutsideActiveAccess:
      outsideTeamMemberships.length > 0 ||
      outsideOrganizationMemberships.length > 0,
    hasScopedAccess:
      scopedTeamMembershipIds.length > 0 ||
      scopedOrganizationMembershipIds.length > 0,
    scopedOrganizationMembershipIds,
    scopedTeamMembershipIds,
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

async function resolveInviteEmailContext(input: {
  adminSupabase: AdminSupabaseClient
  inviteTarget: MemberInviteTarget
  scopeOrgId: string
}): Promise<InviteEmailContext | null> {
  const { data: organizationRow, error: organizationError } =
    await input.adminSupabase
      .from("organizations")
      .select("id,name")
      .eq("id", input.scopeOrgId)
      .eq("is_active", true)
      .maybeSingle()

  if (organizationError) {
    throw new Error(`Could not load invite organization: ${organizationError.message}`)
  }

  if (!organizationRow) {
    return null
  }

  if (input.inviteTarget.kind === "organization") {
    return {
      organizationId: organizationRow.id,
      organizationName: organizationRow.name,
      teamId: null,
      teamName: null,
    }
  }

  const { data: teamRow, error: teamError } = await input.adminSupabase
    .from("teams")
    .select("id,name,organization_id")
    .eq("id", input.inviteTarget.teamId)
    .eq("organization_id", input.scopeOrgId)
    .eq("is_active", true)
    .maybeSingle()

  if (teamError) {
    throw new Error(`Could not load invite team: ${teamError.message}`)
  }

  if (!teamRow) {
    return null
  }

  return {
    organizationId: organizationRow.id,
    organizationName: organizationRow.name,
    teamId: teamRow.id,
    teamName: teamRow.name,
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
  inviteEmailContext: InviteEmailContext
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
    inviteEmailContext: input.inviteEmailContext,
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

  return callbackUrl.toString()
}

async function sendSupabaseInviteEmail(input: {
  adminSupabase: AdminSupabaseClient
  email: string
  firstName: string
  inviteEmailContext: InviteEmailContext
  lastName: string
  role: string
}): Promise<SupabaseInviteEmailResult | null> {
  const redirectTo = await buildInviteRedirectTo()
  const { data, error } = await input.adminSupabase.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo,
      data: buildInviteEmailMetadata({
        firstName: input.firstName,
        inviteEmailContext: input.inviteEmailContext,
        lastName: input.lastName,
        role: input.role,
      }),
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

async function resolveCrewMemberAvatarUrl(input: {
  adminSupabase: AdminSupabaseClient
  avatarFile: File | undefined
  fallbackAvatarUrl: string | null
  profileId: string
}): Promise<
  | {
      avatarUrl: string | null
      ok: true
    }
  | {
      ok: false
    }
> {
  if (!input.avatarFile) {
    return {
      avatarUrl: input.fallbackAvatarUrl,
      ok: true,
    }
  }

  if (
    input.avatarFile.type !== PROFILE_AVATAR_MIME_TYPE ||
    input.avatarFile.size > MAX_PROFILE_AVATAR_BYTES
  ) {
    return {
      ok: false,
    }
  }

  let fileBytes: Uint8Array

  try {
    fileBytes = new Uint8Array(await input.avatarFile.arrayBuffer())
  } catch {
    return {
      ok: false,
    }
  }

  if (!hasWebpFileSignature(fileBytes)) {
    return {
      ok: false,
    }
  }

  const storagePath = buildProfileAvatarStoragePath({
    fileName: input.avatarFile.name,
    profileId: input.profileId,
  })
  const { error: storageError } = await input.adminSupabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: PROFILE_AVATAR_MIME_TYPE,
      upsert: false,
    })

  if (storageError) {
    return {
      ok: false,
    }
  }

  const { data } = input.adminSupabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .getPublicUrl(storagePath)

  return {
    avatarUrl: data.publicUrl,
    ok: true,
  }
}

export async function createCrewMemberAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const avatarFile = getFormFile(formData, "avatarFile")
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

  let inviteEmailContext: InviteEmailContext | null = null
  try {
    inviteEmailContext = await resolveInviteEmailContext({
      adminSupabase,
      inviteTarget,
      scopeOrgId: scope.scopeOrgId,
    })
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  if (!inviteEmailContext) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const fallbackAvatarUrl = normalizeAvatarUrl(parsedInput.data.avatarUrl)
  let profileResult: EnsureCrewMemberProfileResult | null = null

  try {
    profileResult = await ensureCrewMemberProfile({
      adminSupabase,
      email: parsedInput.data.email,
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
      avatarUrl: fallbackAvatarUrl,
      inviteEmailContext,
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

  const avatarResult = await resolveCrewMemberAvatarUrl({
    adminSupabase,
    avatarFile,
    fallbackAvatarUrl,
    profileId,
  })

  const resolvedAvatarUrl =
    avatarResult.ok === true
      ? avatarResult.avatarUrl
      : await redirectAfterProvisioningFailure("create_failed")
  const syncedProfile = await syncCrewMemberProfile({
    adminSupabase,
    profileId,
    email: parsedInput.data.email,
    firstName: parsedInput.data.firstName,
    lastName: parsedInput.data.lastName,
    avatarUrl: resolvedAvatarUrl,
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
      inviteEmailContext,
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
  const avatarFile = getFormFile(formData, "avatarFile")
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

  const avatarResult = await resolveCrewMemberAvatarUrl({
    adminSupabase,
    avatarFile,
    fallbackAvatarUrl: normalizeAvatarUrl(parsedInput.data.avatarUrl),
    profileId: parsedInput.data.profileId,
  })

  const resolvedAvatarUrl =
    avatarResult.ok === true
      ? avatarResult.avatarUrl
      : redirect(
          buildUsersRedirectPath({
            error: "update_failed",
            ...scope,
          }),
        )

  const syncedProfile = await syncCrewMemberProfile({
    adminSupabase,
    profileId: parsedInput.data.profileId,
    firstName: parsedInput.data.firstName,
    lastName: parsedInput.data.lastName,
    avatarUrl: resolvedAvatarUrl,
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

export async function unlinkCrewMemberAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = unlinkCrewMemberInputSchema.safeParse({
    membershipId: getFormString(formData, "membershipId"),
    profileId: getFormString(formData, "profileId"),
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

  let adminSupabase: AdminSupabaseClient
  try {
    adminSupabase = createAdminSupabaseClient()
  } catch {
    redirect(
      buildUsersRedirectPath({
        error: "unlink_failed",
        ...scope,
      }),
    )
  }

  let membershipIdsToUnlink: string[] = []
  let profileIdToUnlink: string | null = null

  if (parsedInput.data.membershipId) {
    const scopedMembership = await resolveScopedMembership({
      adminSupabase,
      membershipId: parsedInput.data.membershipId,
      scopeOrgId: scope.scopeOrgId,
    })

    if (
      !scopedMembership ||
      (parsedInput.data.profileId &&
        scopedMembership.profile_id !== parsedInput.data.profileId)
    ) {
      redirect(
        buildUsersRedirectPath({
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    membershipIdsToUnlink = [scopedMembership.id]
    profileIdToUnlink = scopedMembership.profile_id
  } else if (parsedInput.data.profileId) {
    const scopedMemberships = await getScopedTeamMembershipsForProfile({
      adminSupabase,
      profileId: parsedInput.data.profileId,
      scopeOrgId: scope.scopeOrgId,
    })

    if (!scopedMemberships || scopedMemberships.length === 0) {
      redirect(
        buildUsersRedirectPath({
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    membershipIdsToUnlink = scopedMemberships.map((membership) => membership.id)
    profileIdToUnlink = parsedInput.data.profileId
  }

  if (membershipIdsToUnlink.length === 0 || !profileIdToUnlink) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const removesAllAccess = await wouldUnlinkRemoveAllAccess({
    adminSupabase,
    membershipIdsToUnlink,
    profileId: profileIdToUnlink,
  })

  if (removesAllAccess === null) {
    redirect(
      buildUsersRedirectPath({
        error: "unlink_failed",
        ...scope,
      }),
    )
  }

  if (removesAllAccess) {
    redirect(
      buildUsersRedirectPath({
        error: "unlink_blocked_last_access",
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
    .in("id", membershipIdsToUnlink)

  if (updateError) {
    redirect(
      buildUsersRedirectPath({
        error: "unlink_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/users")
  revalidatePath("/team-home")

  redirect(
    buildUsersRedirectPath({
      status: "unlinked",
      ...scope,
    }),
  )
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = deleteUserInputSchema.safeParse({
    profileId: getFormString(formData, "profileId"),
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

  const deleteScope = await resolveUserDeleteScope({
    adminSupabase,
    profileId: parsedInput.data.profileId,
    scopeOrgId: scope.scopeOrgId,
  })

  if (!deleteScope) {
    redirect(
      buildUsersRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  if (!deleteScope.hasScopedAccess) {
    redirect(
      buildUsersRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (deleteScope.hasOutsideActiveAccess) {
    redirect(
      buildUsersRedirectPath({
        error: "delete_blocked_linked_elsewhere",
        ...scope,
      }),
    )
  }

  const leftAt = new Date().toISOString()

  if (deleteScope.scopedTeamMembershipIds.length > 0) {
    const { error: teamMembershipUpdateError } = await adminSupabase
      .from("team_memberships")
      .update({
        is_active: false,
        left_at: leftAt,
      })
      .in("id", deleteScope.scopedTeamMembershipIds)

    if (teamMembershipUpdateError) {
      redirect(
        buildUsersRedirectPath({
          error: "delete_failed",
          ...scope,
        }),
      )
    }
  }

  if (deleteScope.scopedOrganizationMembershipIds.length > 0) {
    const { error: organizationMembershipDeleteError } = await adminSupabase
      .from("organization_memberships")
      .delete()
      .in("id", deleteScope.scopedOrganizationMembershipIds)

    if (organizationMembershipDeleteError) {
      redirect(
        buildUsersRedirectPath({
          error: "delete_failed",
          ...scope,
        }),
      )
    }
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      is_active: false,
    })
    .eq("id", parsedInput.data.profileId)

  if (profileUpdateError) {
    redirect(
      buildUsersRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    )
  }

  const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
    parsedInput.data.profileId,
  )

  if (authDeleteError) {
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
