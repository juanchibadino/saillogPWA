"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { canUpdateTeamSettings } from "@/features/settings/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageOrganizationOperations,
  canManageTeamFinance,
} from "@/lib/auth/capabilities"
import { resolveCurrentRequestOrigin } from "@/lib/http/request-origin"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  updateOrganizationSettingsInputSchema,
  updateTeamSettingsInputSchema,
  updateUserSettingsInputSchema,
} from "@/lib/validation/settings"
import type { Database } from "@/types/database"

const PROFILE_AVATARS_BUCKET = "profile-avatars"
const ORGANIZATION_AVATARS_BUCKET = "organization-avatars"
const AVATAR_MIME_TYPE = "image/webp"
const MAX_AVATAR_BYTES = 64 * 1024

type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>

type SettingsStatus =
  | "email_confirmed"
  | "email_verification_sent"
  | "organization_updated"
  | "team_updated"
  | "user_updated"

type SettingsError =
  | "email_update_failed"
  | "forbidden"
  | "invalid_input"
  | "update_failed"

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getFormCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
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
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  if (!parsedScope.success) {
    return {}
  }

  return parsedScope.data
}

function buildSettingsRedirectPath(input: {
  error?: SettingsError
  scopeOrgId?: string
  scopeTeamId?: string
  status?: SettingsStatus
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

  const query = params.toString()
  return query.length > 0 ? `/settings?${query}` : "/settings"
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

function buildOrganizationAvatarStoragePath(input: {
  fileName: string
  organizationId: string
}): string {
  const safeName = sanitizeFileName(input.fileName) || "avatar.webp"
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `organizations/${input.organizationId}/${timestamp}-${randomPart}-${safeName}`
}

async function resolveUploadedAvatarUrl(input: {
  adminSupabase: AdminSupabaseClient
  avatarFile: File | undefined
  bucketName: string
  fallbackAvatarUrl: string | null
  storagePath: string | null
}): Promise<{ avatarUrl: string | null; ok: true } | { ok: false }> {
  if (!input.avatarFile) {
    return {
      avatarUrl: input.fallbackAvatarUrl,
      ok: true,
    }
  }

  if (
    !input.storagePath ||
    input.avatarFile.type !== AVATAR_MIME_TYPE ||
    input.avatarFile.size > MAX_AVATAR_BYTES
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

  const { error: storageError } = await input.adminSupabase.storage
    .from(input.bucketName)
    .upload(input.storagePath, fileBytes, {
      contentType: AVATAR_MIME_TYPE,
      upsert: false,
    })

  if (storageError) {
    return {
      ok: false,
    }
  }

  const { data } = input.adminSupabase.storage
    .from(input.bucketName)
    .getPublicUrl(input.storagePath)

  return {
    avatarUrl: data.publicUrl,
    ok: true,
  }
}

async function buildEmailChangeRedirectTo(scope: {
  scopeOrgId?: string
  scopeTeamId?: string
}): Promise<string> {
  const origin = await resolveCurrentRequestOrigin()
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set(
    "next",
    buildSettingsRedirectPath({
      status: "email_confirmed",
      ...scope,
    }),
  )

  return callbackUrl.toString()
}

function revalidateSettingsSurfaces(): void {
  revalidatePath("/", "layout")
  revalidatePath("/settings")
  revalidatePath("/team-home")
  revalidatePath("/teams")
  revalidatePath("/organizations")
}

export async function updateUserSettingsAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const avatarFile = getFormFile(formData, "avatarFile")
  const parsedInput = updateUserSettingsInputSchema.safeParse({
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    email: getFormString(formData, "email"),
    avatarUrl: getFormString(formData, "avatarUrl"),
  })

  if (!parsedInput.success) {
    redirect(
      buildSettingsRedirectPath({
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
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const fallbackAvatarUrl = normalizeAvatarUrl(parsedInput.data.avatarUrl)
  const avatarResult = await resolveUploadedAvatarUrl({
    adminSupabase,
    avatarFile,
    bucketName: PROFILE_AVATARS_BUCKET,
    fallbackAvatarUrl,
    storagePath: avatarFile
      ? buildProfileAvatarStoragePath({
          fileName: avatarFile.name,
          profileId: context.user.id,
        })
      : null,
  })

  if (!avatarResult.ok) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
    first_name: parsedInput.data.firstName,
    last_name: parsedInput.data.lastName,
    photo_url: avatarResult.avatarUrl,
    is_active: true,
  }
  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", context.user.id)

  if (profileUpdateError) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error: metadataUpdateError } =
    await adminSupabase.auth.admin.updateUserById(context.user.id, {
      user_metadata: buildUserNameMetadata({
        firstName: parsedInput.data.firstName,
        lastName: parsedInput.data.lastName,
      }),
    })

  if (metadataUpdateError) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const currentEmail = (context.user.email ?? "").trim().toLowerCase()
  const shouldUpdateEmail =
    parsedInput.data.email.length > 0 && parsedInput.data.email !== currentEmail

  if (shouldUpdateEmail) {
    const supabase = await createServerSupabaseClient()
    const { error: emailUpdateError } = await supabase.auth.updateUser(
      {
        email: parsedInput.data.email,
      },
      {
        emailRedirectTo: await buildEmailChangeRedirectTo(scope),
      },
    )

    if (emailUpdateError) {
      redirect(
        buildSettingsRedirectPath({
          error: "email_update_failed",
          ...scope,
        }),
      )
    }
  }

  revalidateSettingsSurfaces()
  redirect(
    buildSettingsRedirectPath({
      status: shouldUpdateEmail ? "email_verification_sent" : "user_updated",
      ...scope,
    }),
  )
}

export async function updateOrganizationSettingsAction(
  formData: FormData,
): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const avatarFile = getFormFile(formData, "avatarFile")
  const parsedInput = updateOrganizationSettingsInputSchema.safeParse({
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    defaultCurrencyCode: getFormString(formData, "defaultCurrencyCode"),
    avatarUrl: getFormString(formData, "avatarUrl"),
  })

  if (
    !parsedInput.success ||
    !scope.scopeOrgId ||
    parsedInput.data.organizationId !== scope.scopeOrgId
  ) {
    redirect(
      buildSettingsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    redirect(
      buildSettingsRedirectPath({
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
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const fallbackAvatarUrl = normalizeAvatarUrl(parsedInput.data.avatarUrl)
  const avatarResult = await resolveUploadedAvatarUrl({
    adminSupabase,
    avatarFile,
    bucketName: ORGANIZATION_AVATARS_BUCKET,
    fallbackAvatarUrl,
    storagePath: avatarFile
      ? buildOrganizationAvatarStoragePath({
          fileName: avatarFile.name,
          organizationId: parsedInput.data.organizationId,
        })
      : null,
  })

  if (!avatarResult.ok) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error } = await adminSupabase
    .from("organizations")
    .update({
      avatar_url: avatarResult.avatarUrl,
      default_currency_code: parsedInput.data.defaultCurrencyCode,
      name: parsedInput.data.name,
    })
    .eq("id", parsedInput.data.organizationId)
    .eq("is_active", true)

  if (error) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateSettingsSurfaces()
  redirect(
    buildSettingsRedirectPath({
      status: "organization_updated",
      ...scope,
    }),
  )
}

export async function updateTeamSettingsAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = updateTeamSettingsInputSchema.safeParse({
    organizationId: getFormString(formData, "organizationId"),
    teamId: getFormString(formData, "teamId"),
    name: getFormString(formData, "name"),
    teamType: getFormString(formData, "teamType"),
    expensesShowTeamTotals: getFormCheckbox(formData, "expensesShowTeamTotals"),
  })

  if (
    !parsedInput.success ||
    !scope.scopeOrgId ||
    !scope.scopeTeamId ||
    parsedInput.data.organizationId !== scope.scopeOrgId ||
    parsedInput.data.teamId !== scope.scopeTeamId
  ) {
    redirect(
      buildSettingsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const canUpdateExpenseVisibility = canManageTeamFinance({
    context,
    organizationId: parsedInput.data.organizationId,
    teamId: parsedInput.data.teamId,
  })

  if (
    !canUpdateTeamSettings({
      context,
      organizationId: parsedInput.data.organizationId,
      teamId: parsedInput.data.teamId,
    })
  ) {
    redirect(
      buildSettingsRedirectPath({
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
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { data: existingTeam, error: existingTeamError } = await adminSupabase
    .from("teams")
    .select("id,expenses_show_team_totals")
    .eq("id", parsedInput.data.teamId)
    .eq("organization_id", parsedInput.data.organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (existingTeamError || !existingTeam) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error } = await adminSupabase
    .from("teams")
    .update({
      expenses_show_team_totals: canUpdateExpenseVisibility
        ? parsedInput.data.expensesShowTeamTotals
        : existingTeam.expenses_show_team_totals,
      name: parsedInput.data.name,
      team_type: parsedInput.data.teamType,
    })
    .eq("id", parsedInput.data.teamId)
    .eq("organization_id", parsedInput.data.organizationId)
    .eq("is_active", true)

  if (error) {
    redirect(
      buildSettingsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateSettingsSurfaces()
  redirect(
    buildSettingsRedirectPath({
      status: "team_updated",
      ...scope,
    }),
  )
}
