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
  createTeamVenueWindPatternInputSchema,
  toggleTeamVenueWindPatternStatusInputSchema,
  updateTeamVenueWindPatternInputSchema,
} from "@/lib/validation/wind-patterns"

type WindPatternsActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeStatus?: string
  scopeYear?: string
}

type ScopedTeamVenue = {
  id: string
  team_id: string
  venue_id: string
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

function getScopeFromFormData(formData: FormData): WindPatternsActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })
  const scopeStatus = getFormString(formData, "scopeStatus")
  const scopeYear = getFormString(formData, "scopeYear")

  if (!parsedScope.success) {
    return { scopeStatus, scopeYear }
  }

  return {
    ...parsedScope.data,
    scopeStatus,
    scopeYear,
  }
}

function buildVenueWindPatternsRedirectPath(input: {
  teamVenueId?: string
  status?: "wind_pattern_created" | "wind_pattern_updated" | "wind_pattern_archived" | "wind_pattern_restored"
  error?:
    | "invalid_input"
    | "forbidden"
    | "wind_pattern_create_failed"
    | "wind_pattern_update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeStatus?: string
  scopeYear?: string
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

  params.set("tab", "wind-patterns")

  if (input.scopeStatus) {
    params.set("statusFilter", input.scopeStatus)
  }

  if (input.scopeYear) {
    params.set("year", input.scopeYear)
  }

  const query = params.toString()
  const basePath = input.teamVenueId ? `/venues/${input.teamVenueId}` : "/venues"
  return query.length > 0 ? `${basePath}?${query}` : basePath
}

async function resolveScopedTeamVenue(input: {
  teamVenueId: string
  scopeOrgId: string
  scopeTeamId: string
}): Promise<ScopedTeamVenue | null> {
  const supabase = await createServerSupabaseClient()
  const { data: teamVenue, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", input.teamVenueId)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenue) {
    return null
  }

  const [
    { data: team, error: teamError },
    { data: venue, error: venueError },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("organization_id")
      .eq("id", teamVenue.team_id)
      .eq("organization_id", input.scopeOrgId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("organization_id")
      .eq("id", teamVenue.venue_id)
      .eq("organization_id", input.scopeOrgId)
      .maybeSingle(),
  ])

  if (teamError || venueError || !team || !venue) {
    return null
  }

  return teamVenue
}

async function resolveScopedWindPattern(input: {
  id: string
  teamVenueId: string
}): Promise<{ id: string; team_venue_id: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("team_venue_wind_patterns")
    .select("id,team_venue_id")
    .eq("id", input.id)
    .eq("team_venue_id", input.teamVenueId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

function revalidateWindPatternSlices(teamVenueId: string): void {
  revalidatePath(`/venues/${teamVenueId}`)
  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-notes")
}

export async function createTeamVenueWindPatternAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const teamVenueId = getFormString(formData, "teamVenueId")
  const parsedInput = createTeamVenueWindPatternInputSchema.safeParse({
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!parsedInput.success || !teamVenueId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
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
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedTeamVenue = await resolveScopedTeamVenue({
    teamVenueId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedTeamVenue) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)
  const { data: existingPatternRows, error: existingPatternError } = await supabase
    .from("team_venue_wind_patterns")
    .select("id,is_active")
    .eq("team_venue_id", teamVenueId)
    .ilike("name", parsedInput.data.name)
    .limit(1)

  if (existingPatternError) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "wind_pattern_create_failed",
        ...scope,
      }),
    )
  }

  const existingPattern = existingPatternRows?.[0]

  if (existingPattern) {
    const { error: updateExistingPatternError } = await supabase
      .from("team_venue_wind_patterns")
      .update({
        name: parsedInput.data.name,
        description: normalizedDescription,
        is_active: true,
      })
      .eq("id", existingPattern.id)

    if (updateExistingPatternError) {
      redirect(
        buildVenueWindPatternsRedirectPath({
          teamVenueId,
          error: "wind_pattern_create_failed",
          ...scope,
        }),
      )
    }
  } else {
    const { error: insertPatternError } = await supabase.from("team_venue_wind_patterns").insert({
      team_venue_id: teamVenueId,
      name: parsedInput.data.name,
      description: normalizedDescription,
      created_by_profile_id: context.profile?.id ?? null,
    })

    if (insertPatternError) {
      redirect(
        buildVenueWindPatternsRedirectPath({
          teamVenueId,
          error: "wind_pattern_create_failed",
          ...scope,
        }),
      )
    }
  }

  revalidateWindPatternSlices(teamVenueId)

  redirect(
    buildVenueWindPatternsRedirectPath({
      teamVenueId,
      status: "wind_pattern_created",
      ...scope,
    }),
  )
}

export async function updateTeamVenueWindPatternAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const teamVenueId = getFormString(formData, "teamVenueId")
  const parsedInput = updateTeamVenueWindPatternInputSchema.safeParse({
    id: getFormString(formData, "id"),
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!parsedInput.success || !teamVenueId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
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
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const [scopedTeamVenue, scopedPattern] = await Promise.all([
    resolveScopedTeamVenue({
      teamVenueId,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    }),
    resolveScopedWindPattern({
      id: parsedInput.data.id,
      teamVenueId,
    }),
  ])

  if (!scopedTeamVenue || !scopedPattern) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updatePatternError } = await supabase
    .from("team_venue_wind_patterns")
    .update({
      name: parsedInput.data.name,
      description: normalizeOptionalText(parsedInput.data.description),
    })
    .eq("id", parsedInput.data.id)

  if (updatePatternError) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "wind_pattern_update_failed",
        ...scope,
      }),
    )
  }

  revalidateWindPatternSlices(teamVenueId)

  redirect(
    buildVenueWindPatternsRedirectPath({
      teamVenueId,
      status: "wind_pattern_updated",
      ...scope,
    }),
  )
}

export async function archiveTeamVenueWindPatternAction(formData: FormData): Promise<void> {
  await setTeamVenueWindPatternStatus({
    formData,
    isActive: false,
    status: "wind_pattern_archived",
  })
}

export async function restoreTeamVenueWindPatternAction(formData: FormData): Promise<void> {
  await setTeamVenueWindPatternStatus({
    formData,
    isActive: true,
    status: "wind_pattern_restored",
  })
}

async function setTeamVenueWindPatternStatus(input: {
  formData: FormData
  isActive: boolean
  status: "wind_pattern_archived" | "wind_pattern_restored"
}): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(input.formData)
  const teamVenueId = getFormString(input.formData, "teamVenueId")
  const parsedInput = toggleTeamVenueWindPatternStatusInputSchema.safeParse({
    id: getFormString(input.formData, "id"),
  })

  if (!parsedInput.success || !teamVenueId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
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
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const [scopedTeamVenue, scopedPattern] = await Promise.all([
    resolveScopedTeamVenue({
      teamVenueId,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    }),
    resolveScopedWindPattern({
      id: parsedInput.data.id,
      teamVenueId,
    }),
  ])

  if (!scopedTeamVenue || !scopedPattern) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updatePatternError } = await supabase
    .from("team_venue_wind_patterns")
    .update({ is_active: input.isActive })
    .eq("id", parsedInput.data.id)

  if (updatePatternError) {
    redirect(
      buildVenueWindPatternsRedirectPath({
        teamVenueId,
        error: "wind_pattern_update_failed",
        ...scope,
      }),
    )
  }

  revalidateWindPatternSlices(teamVenueId)

  redirect(
    buildVenueWindPatternsRedirectPath({
      teamVenueId,
      status: input.status,
      ...scope,
    }),
  )
}
