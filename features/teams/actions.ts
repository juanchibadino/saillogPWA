"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import { generateUniqueTeamSlug } from "@/lib/db/slugs"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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

function buildTeamsRedirectPath(input: {
  status?: "created"
  error?:
    | "invalid_input"
    | "forbidden"
    | "create_failed"
    | "plan_limit_reached"
    | "payment_required"
  scopeOrgId?: string
  scopeTeamId?: string
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
  return query.length > 0 ? `/teams?${query}` : "/teams"
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
