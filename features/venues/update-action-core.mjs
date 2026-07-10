import { canManageOrganizationOperationsFromAccess } from "../../lib/auth/capability-rules.mjs"
import {
  buildVenueRedirectPath,
  resolveVenueUpdateDecision,
} from "./action-rules.mjs"

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

function isRequiredShortText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 120
}

function getBooleanField(formData, key) {
  return formData.get(key) === "on"
}

function getScopeFromFormData(formData) {
  const scopeOrgId = getTrimmedFormString(formData, "scopeOrgId")
  const scopeTeamId = getTrimmedFormString(formData, "scopeTeamId")

  if (!isUuid(scopeOrgId)) {
    return {}
  }

  return {
    scopeOrgId,
    ...(isUuid(scopeTeamId) ? { scopeTeamId } : {}),
  }
}

function parseUpdateVenueInput(formData) {
  const input = {
    city: getTrimmedFormString(formData, "city"),
    country: getTrimmedFormString(formData, "country"),
    id: getTrimmedFormString(formData, "id"),
    isActive: getBooleanField(formData, "isActive"),
    name: getTrimmedFormString(formData, "name"),
    organizationId: getTrimmedFormString(formData, "organizationId"),
    teamVenueId: getTrimmedFormString(formData, "teamVenueId"),
  }

  if (
    !isUuid(input.id) ||
    !isUuid(input.teamVenueId) ||
    !isUuid(input.organizationId) ||
    !isRequiredShortText(input.name) ||
    !isRequiredShortText(input.country) ||
    !isRequiredShortText(input.city)
  ) {
    return {
      success: false,
    }
  }

  return {
    data: input,
    success: true,
  }
}

export async function runUpdateVenueAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const redirectTo = getFormString(formData, "redirectTo")
  const parsedInput = parseUpdateVenueInput(formData)

  if (!parsedInput.success) {
    dependencies.redirect(
      buildVenueRedirectPath({
        error: "invalid_input",
        ...scope,
        redirectTo,
      }),
    )
    return
  }

  const canManageVenueOrganization = canManageOrganizationOperationsFromAccess({
    context,
    organizationId: parsedInput.data.organizationId,
  })

  if (!canManageVenueOrganization) {
    dependencies.redirect(
      buildVenueRedirectPath({
        error: "forbidden",
        ...scope,
        redirectTo,
      }),
    )
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()

  const [
    { data: activeTeamRow, error: activeTeamError },
    { data: teamVenueRow, error: teamVenueError },
    { data: venueRow, error: venueError },
  ] = await Promise.all([
    scope.scopeOrgId && scope.scopeTeamId
      ? supabase
          .from("teams")
          .select("id")
          .eq("id", scope.scopeTeamId)
          .eq("organization_id", scope.scopeOrgId)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("team_venues")
      .select("id,team_id,venue_id")
      .eq("id", parsedInput.data.teamVenueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("id,organization_id")
      .eq("id", parsedInput.data.id)
      .maybeSingle(),
  ])

  if (activeTeamError || teamVenueError || venueError) {
    dependencies.redirect(
      buildVenueRedirectPath({
        error: "update_failed",
        ...scope,
        redirectTo,
      }),
    )
    return
  }

  const updateDecision = resolveVenueUpdateDecision({
    activeTeamInScope: Boolean(activeTeamRow),
    canManageOrganizationOperations: canManageVenueOrganization,
    organizationId: parsedInput.data.organizationId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
    teamVenue: teamVenueRow,
    teamVenueId: parsedInput.data.teamVenueId,
    venue: venueRow,
    venueId: parsedInput.data.id,
  })

  if (!updateDecision.allowed) {
    dependencies.redirect(
      buildVenueRedirectPath({
        error: updateDecision.error,
        ...scope,
        redirectTo,
      }),
    )
    return
  }

  const { error } = await supabase
    .from("venues")
    .update({
      city: parsedInput.data.city,
      country: parsedInput.data.country,
      is_active: parsedInput.data.isActive,
      name: parsedInput.data.name,
    })
    .eq("id", parsedInput.data.id)
    .eq("organization_id", parsedInput.data.organizationId)

  if (error) {
    dependencies.redirect(
      buildVenueRedirectPath({
        error: "update_failed",
        ...scope,
        redirectTo,
      }),
    )
    return
  }

  const successPath = buildVenueRedirectPath({
    status: "updated",
    cacheTeamVenueId: parsedInput.data.teamVenueId,
    ...scope,
    redirectTo,
  })

  dependencies.revalidatePath("/venues")
  dependencies.revalidatePath(successPath.split("?")[0] ?? "/venues")
  dependencies.redirect(successPath)
}
