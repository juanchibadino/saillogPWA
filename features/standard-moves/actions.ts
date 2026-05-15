"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createTeamStandardMoveInputSchema,
  toggleTeamStandardMoveStatusInputSchema,
  updateTeamStandardMoveInputSchema,
} from "@/lib/validation/standard-moves"

type StandardMovesActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeStatus?: string
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function getScopeFromFormData(formData: FormData): StandardMovesActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })
  const scopeStatus = getFormString(formData, "scopeStatus")

  if (!parsedScope.success) {
    return { scopeStatus }
  }

  return {
    ...parsedScope.data,
    scopeStatus,
  }
}

function buildTeamStandardMovesRedirectPath(input: {
  status?: "created" | "updated" | "archived" | "restored"
  error?: "invalid_input" | "forbidden" | "create_failed" | "update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeStatus?: string
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

  if (input.scopeStatus) {
    params.set("statusFilter", input.scopeStatus)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-standard-moves?${query}` : "/team-standard-moves"
}

async function resolveTeamOrganizationId(teamId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    return null
  }

  return teamRow?.organization_id ?? null
}

async function resolveScopedStandardMove(input: {
  id: string
  scopeTeamId: string
}): Promise<{ id: string; team_id: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("team_standard_moves")
    .select("id,team_id")
    .eq("id", input.id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

function revalidateStandardMoveSlices(): void {
  revalidatePath("/team-standard-moves")
  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-notes")
}

export async function createTeamStandardMoveAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = createTeamStandardMoveInputSchema.safeParse({
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)
  const { data: existingMoveRows, error: existingMoveError } = await supabase
    .from("team_standard_moves")
    .select("id,is_active")
    .eq("team_id", scope.scopeTeamId)
    .ilike("name", parsedInput.data.name)
    .limit(1)

  if (existingMoveError) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  const existingMove = existingMoveRows?.[0]

  if (existingMove) {
    const { error: updateExistingMoveError } = await supabase
      .from("team_standard_moves")
      .update({
        name: parsedInput.data.name,
        description: normalizedDescription,
        is_active: true,
      })
      .eq("id", existingMove.id)

    if (updateExistingMoveError) {
      redirect(
        buildTeamStandardMovesRedirectPath({
          error: "create_failed",
          ...scope,
        }),
      )
    }
  } else {
    const { error: insertMoveError } = await supabase.from("team_standard_moves").insert({
      team_id: scope.scopeTeamId,
      name: parsedInput.data.name,
      description: normalizedDescription,
      created_by_profile_id: context.profile?.id ?? null,
    })

    if (insertMoveError) {
      redirect(
        buildTeamStandardMovesRedirectPath({
          error: "create_failed",
          ...scope,
        }),
      )
    }
  }

  revalidateStandardMoveSlices()

  redirect(
    buildTeamStandardMovesRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateTeamStandardMoveAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = updateTeamStandardMoveInputSchema.safeParse({
    id: getFormString(formData, "id"),
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedMove = await resolveScopedStandardMove({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedMove) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updateMoveError } = await supabase
    .from("team_standard_moves")
    .update({
      name: parsedInput.data.name,
      description: normalizeOptionalText(parsedInput.data.description),
    })
    .eq("id", parsedInput.data.id)

  if (updateMoveError) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateStandardMoveSlices()

  redirect(
    buildTeamStandardMovesRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function archiveTeamStandardMoveAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = toggleTeamStandardMoveStatusInputSchema.safeParse({
    id: getFormString(formData, "id"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedMove = await resolveScopedStandardMove({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedMove) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: archiveMoveError } = await supabase
    .from("team_standard_moves")
    .update({ is_active: false })
    .eq("id", parsedInput.data.id)

  if (archiveMoveError) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateStandardMoveSlices()

  redirect(
    buildTeamStandardMovesRedirectPath({
      status: "archived",
      ...scope,
    }),
  )
}

export async function restoreTeamStandardMoveAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = toggleTeamStandardMoveStatusInputSchema.safeParse({
    id: getFormString(formData, "id"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedMove = await resolveScopedStandardMove({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedMove) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: restoreMoveError } = await supabase
    .from("team_standard_moves")
    .update({ is_active: true })
    .eq("id", parsedInput.data.id)

  if (restoreMoveError) {
    redirect(
      buildTeamStandardMovesRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateStandardMoveSlices()

  redirect(
    buildTeamStandardMovesRedirectPath({
      status: "restored",
      ...scope,
    }),
  )
}
