"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { isSuperAdmin } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { createOrganizationInputSchema } from "@/lib/validation/organizations"
import { generateUniqueOrganizationSlug } from "@/lib/db/slugs"

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

function buildOrganizationsRedirectPath(input: {
  status?: "created"
  error?: "invalid_input" | "forbidden" | "create_failed"
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
  return query.length > 0 ? `/organizations?${query}` : "/organizations"
}

async function insertOrganizationWithUniqueSlug(input: {
  name: string
  avatarUrl?: string
}): Promise<{
  error: { code?: string; message: string } | null
}> {
  const supabase = await createServerSupabaseClient()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await generateUniqueOrganizationSlug({
      supabase,
      name: input.name,
    })

    const { error } = await supabase.from("organizations").insert({
      name: input.name,
      slug,
      avatar_url: input.avatarUrl ?? null,
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
      message: "Could not create organization after resolving slug collisions.",
    },
  }
}

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = createOrganizationInputSchema.safeParse({
    name: getFormString(formData, "name"),
    avatarUrl: getFormString(formData, "avatarUrl"),
  })

  if (!parsedInput.success) {
    redirect(
      buildOrganizationsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (!isSuperAdmin(context)) {
    redirect(
      buildOrganizationsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const { error } = await insertOrganizationWithUniqueSlug({
    name: parsedInput.data.name,
    avatarUrl: parsedInput.data.avatarUrl,
  })

  if (error) {
    redirect(
      buildOrganizationsRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/organizations")
  redirect(
    buildOrganizationsRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}
