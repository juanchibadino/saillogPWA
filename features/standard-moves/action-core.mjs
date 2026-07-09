import { canManageTeamSessionsFromAccess } from "../../lib/auth/capability-rules.mjs"
import {
  buildTeamStandardMovesRedirectPath,
  normalizeRequestedPage,
} from "./list-route-state.mjs"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getFormString(formData, key) {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getTrimmedFormString(formData, key) {
  return getFormString(formData, key)?.trim()
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function isRequiredStandardMoveName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 120
}

function isOptionalStandardMoveDescription(value) {
  return typeof value === "undefined" || value.length <= 4000
}

function getScopeFromFormData(formData) {
  const scopeOrgId = getTrimmedFormString(formData, "scopeOrgId")
  const scopeTeamId = getTrimmedFormString(formData, "scopeTeamId")
  const scopeStatus = getTrimmedFormString(formData, "scopeStatus")
  const scopePage = normalizeRequestedPage(getTrimmedFormString(formData, "scopePage"))
  const scopeLoadMore =
    scopePage > 1 && getTrimmedFormString(formData, "scopeLoadMore") === "1"

  if (!isUuid(scopeOrgId)) {
    return {
      scopeLoadMore,
      scopePage,
      scopeStatus,
    }
  }

  return {
    scopeLoadMore,
    scopeOrgId,
    scopePage,
    scopeStatus,
    ...(isUuid(scopeTeamId) ? { scopeTeamId } : {}),
  }
}

function parseCreateInput(formData) {
  const input = {
    description: getFormString(formData, "description"),
    name: getTrimmedFormString(formData, "name"),
  }

  if (
    !isRequiredStandardMoveName(input.name) ||
    !isOptionalStandardMoveDescription(input.description)
  ) {
    return { success: false }
  }

  return {
    data: input,
    success: true,
  }
}

function parseUpdateInput(formData) {
  const input = {
    description: getFormString(formData, "description"),
    id: getTrimmedFormString(formData, "id"),
    name: getTrimmedFormString(formData, "name"),
  }

  if (
    !isUuid(input.id) ||
    !isRequiredStandardMoveName(input.name) ||
    !isOptionalStandardMoveDescription(input.description)
  ) {
    return { success: false }
  }

  return {
    data: input,
    success: true,
  }
}

function parseToggleInput(formData) {
  const id = getTrimmedFormString(formData, "id")

  if (!isUuid(id)) {
    return { success: false }
  }

  return {
    data: { id },
    success: true,
  }
}

function canManageStandardMoves(input) {
  return canManageTeamSessionsFromAccess({
    context: input.context,
    organizationId: input.scopeOrgId,
    teamId: input.scopeTeamId,
  })
}

async function resolveTeamOrganizationId(input) {
  const { data, error } = await input.supabase
    .from("teams")
    .select("organization_id")
    .eq("id", input.scopeTeamId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.organization_id
}

async function resolveScopedStandardMove(input) {
  const { data, error } = await input.supabase
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

function revalidateStandardMoveSlices(dependencies) {
  dependencies.revalidatePath("/team-standard-moves")
  dependencies.revalidatePath("/team-sessions")
  dependencies.revalidatePath("/team-camps")
  dependencies.revalidatePath("/team-notes")
}

function redirectWith(dependencies, input) {
  dependencies.redirect(buildTeamStandardMovesRedirectPath(input))
}

async function ensureValidWriteScope(input) {
  const resolvedOrganizationId = await resolveTeamOrganizationId({
    scopeTeamId: input.scope.scopeTeamId,
    supabase: input.supabase,
  })

  return (
    typeof resolvedOrganizationId === "string" &&
    resolvedOrganizationId === input.scope.scopeOrgId
  )
}

export async function runCreateTeamStandardMoveAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = parseCreateInput(formData)

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageStandardMoves({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const hasValidScope = await ensureValidWriteScope({ scope, supabase })

  if (!hasValidScope) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)
  const { data: existingMoveRows, error: existingMoveError } = await supabase
    .from("team_standard_moves")
    .select("id,is_active")
    .eq("team_id", scope.scopeTeamId)
    .ilike("name", parsedInput.data.name)
    .limit(1)

  if (existingMoveError) {
    redirectWith(dependencies, {
      error: "create_failed",
      ...scope,
    })
    return
  }

  const existingMove = existingMoveRows?.[0]

  if (existingMove) {
    const { error } = await supabase
      .from("team_standard_moves")
      .update({
        description: normalizedDescription,
        is_active: true,
        name: parsedInput.data.name,
      })
      .eq("id", existingMove.id)

    if (error) {
      redirectWith(dependencies, {
        error: "create_failed",
        ...scope,
      })
      return
    }
  } else {
    const { error } = await supabase.from("team_standard_moves").insert({
      created_by_profile_id: context.profile?.id ?? null,
      description: normalizedDescription,
      name: parsedInput.data.name,
      team_id: scope.scopeTeamId,
    })

    if (error) {
      redirectWith(dependencies, {
        error: "create_failed",
        ...scope,
      })
      return
    }
  }

  revalidateStandardMoveSlices(dependencies)
  redirectWith(dependencies, {
    status: "created",
    ...scope,
  })
}

export async function runUpdateTeamStandardMoveAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = parseUpdateInput(formData)

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageStandardMoves({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const hasValidScope = await ensureValidWriteScope({ scope, supabase })

  if (!hasValidScope) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const scopedMove = await resolveScopedStandardMove({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
    supabase,
  })

  if (!scopedMove) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const { error } = await supabase
    .from("team_standard_moves")
    .update({
      description: normalizeOptionalText(parsedInput.data.description),
      name: parsedInput.data.name,
    })
    .eq("id", parsedInput.data.id)

  if (error) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  revalidateStandardMoveSlices(dependencies)
  redirectWith(dependencies, {
    status: "updated",
    ...scope,
  })
}

export async function runToggleTeamStandardMoveStatusAction(
  formData,
  dependencies,
  input,
) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = parseToggleInput(formData)

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageStandardMoves({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const hasValidScope = await ensureValidWriteScope({ scope, supabase })

  if (!hasValidScope) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const scopedMove = await resolveScopedStandardMove({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
    supabase,
  })

  if (!scopedMove) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const { error } = await supabase
    .from("team_standard_moves")
    .update({ is_active: input.isActive })
    .eq("id", parsedInput.data.id)

  if (error) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  revalidateStandardMoveSlices(dependencies)
  redirectWith(dependencies, {
    status: input.status,
    ...scope,
  })
}

export async function runArchiveTeamStandardMoveAction(formData, dependencies) {
  await runToggleTeamStandardMoveStatusAction(formData, dependencies, {
    isActive: false,
    status: "archived",
  })
}

export async function runRestoreTeamStandardMoveAction(formData, dependencies) {
  await runToggleTeamStandardMoveStatusAction(formData, dependencies, {
    isActive: true,
    status: "restored",
  })
}
