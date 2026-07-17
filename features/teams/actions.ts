"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import { generateUniqueTeamSlug } from "@/lib/db/slugs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { buildTeamsRedirectPath } from "@/features/teams/list-route-state.mjs"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { createTeamInputSchema } from "@/lib/validation/teams"

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getScopeFromFormData(formData: FormData): {
  scopeLoadMoreMode?: boolean
  scopeOrgId?: string
  scopePage?: number
  scopeTeamId?: string
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  if (!parsedScope.success) {
    return {}
  }

  const scopePageValue = getFormString(formData, "scopePage")
  const parsedScopePage = scopePageValue
    ? Number.parseInt(scopePageValue, 10)
    : Number.NaN
  const scopePage =
    Number.isFinite(parsedScopePage) && parsedScopePage > 1
      ? Math.floor(parsedScopePage)
      : undefined

  return {
    ...parsedScope.data,
    ...(scopePage ? { scopePage } : {}),
    ...(getFormString(formData, "scopeLoadMoreMode") === "1"
      ? { scopeLoadMoreMode: true }
      : {}),
  }
}

async function insertTeamWithUniqueSlug(input: {
  organizationId: string
  name: string
  teamType: string
}): Promise<{
  error: { code?: string; message: string } | null
}> {
  const supabase = await createServerSupabaseClient()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await generateUniqueTeamSlug({
      supabase,
      organizationId: input.organizationId,
      name: input.name,
    })

    const { error } = await supabase.from("teams").insert({
      organization_id: input.organizationId,
      name: input.name,
      slug,
      team_type: input.teamType,
      is_active: true,
    })

    if (!error) {
      return { error: null }
    }

    if (error.code !== "23505") {
      return { error }
    }
  }

  return {
    error: {
      message: "Could not create team after resolving slug collisions.",
    },
  }
}

export async function createTeamAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = createTeamInputSchema.safeParse({
    organizationId: getFormString(formData, "organizationId"),
    name: getFormString(formData, "name"),
    teamType: getFormString(formData, "teamType"),
  })

  if (!parsedInput.success || !scope.scopeOrgId) {
    redirect(
      buildTeamsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.organizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    redirect(
      buildTeamsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: parsedInput.data.organizationId,
    resource: "teams",
  })

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildTeamsRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
      }),
    )
  }

  const { error } = await insertTeamWithUniqueSlug(parsedInput.data)

  if (error) {
    redirect(
      buildTeamsRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/teams")
  redirect(
    buildTeamsRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}
