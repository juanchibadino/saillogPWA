"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createSessionInputSchema,
  updateSessionDetailInputSchema,
  updateSessionInfoInputSchema,
  updateSessionInputSchema,
  updateSessionResultsInputSchema,
  updateSessionSetupInputSchema,
  uploadSessionAssetInputSchema,
} from "@/lib/validation/sessions"
import type { Json } from "@/types/database"

const SESSION_PHOTOS_BUCKET = "session-photos"
const SESSION_FILES_BUCKET = "session-files"
const MAX_ASSET_BYTES = 25 * 1024 * 1024

type SessionActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeCampId?: string
  scopeTab?: string
  scopePage?: number
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getFormFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key)

  if (!(value instanceof File)) {
    return undefined
  }

  return value
}

function getBooleanField(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

function getOptionalIntegerField(formData: FormData, key: string): number | undefined {
  const value = getFormString(formData, key)

  if (!value) {
    return undefined
  }

  const normalized = value.trim()

  if (normalized.length === 0) {
    return undefined
  }

  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseOptionalPage(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.floor(parsed)
}

function normalizeScopeTab(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseOptionalTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseOptionalDurationHours(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().replace(",", ".")

  if (normalized.length === 0) {
    return undefined
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildUtcTimestamp(sessionDate: string, time: string): string {
  return `${sessionDate}T${time}:00.000Z`
}

function addMinutesToIsoTimestamp(isoTimestamp: string, minutes: number): string {
  const date = new Date(isoTimestamp)
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  return date.toISOString()
}

function parseJsonText(value: string | undefined): Json | null {
  const normalized = normalizeOptionalText(value)

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as Json
  } catch {
    return normalized
  }
}

type SessionSetupPayloadEntry = {
  itemId: string
  textValue: string | null
  selectedOptionIds: string[]
}

function parseSessionSetupPayload(value: string): SessionSetupPayloadEntry[] | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) {
    return null
  }

  const entries: SessionSetupPayloadEntry[] = []

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      return null
    }

    const itemId = "itemId" in item ? (item.itemId as string) : undefined
    const textValue = "textValue" in item ? (item.textValue as string | null) : undefined
    const selectedOptionIds =
      "selectedOptionIds" in item ? (item.selectedOptionIds as string[]) : undefined

    if (
      typeof itemId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)
    ) {
      return null
    }

    if (
      textValue !== null &&
      typeof textValue !== "string" &&
      typeof textValue !== "undefined"
    ) {
      return null
    }

    if (!Array.isArray(selectedOptionIds)) {
      return null
    }

    if (
      selectedOptionIds.some(
        (optionId) =>
          typeof optionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            optionId,
          ),
      )
    ) {
      return null
    }

    entries.push({
      itemId,
      textValue: normalizeOptionalText(textValue ?? undefined),
      selectedOptionIds: Array.from(new Set(selectedOptionIds)),
    })
  }

  return entries
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function getAssetBucket(assetType: "photo" | "analytics_file"): string {
  return assetType === "photo" ? SESSION_PHOTOS_BUCKET : SESSION_FILES_BUCKET
}

function buildAssetStoragePath(input: {
  sessionId: string
  assetType: "photo" | "analytics_file"
  fileName: string
}): string {
  const safeName = sanitizeFileName(input.fileName)
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `sessions/${input.sessionId}/${input.assetType}/${timestamp}-${randomPart}-${safeName}`
}

function getScopeFromFormData(formData: FormData): SessionActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const scopeVenueId = getFormString(formData, "scopeVenueId")
  const scopeCampId = getFormString(formData, "scopeCampId")
  const scopeTab = normalizeScopeTab(getFormString(formData, "scopeTab"))
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeVenueId,
      scopeCampId,
      scopeTab,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
    scopeCampId,
    scopeTab,
    scopePage,
  }
}

function buildTeamSessionsRedirectPath(input: {
  status?: "created" | "updated"
  error?: "invalid_input" | "forbidden" | "create_failed" | "update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeCampId?: string
  scopePage?: number
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

  if (input.scopeVenueId) {
    params.set("venue", input.scopeVenueId)
  }

  if (input.scopeCampId) {
    params.set("camp", input.scopeCampId)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(input.scopePage))
  }

  const query = params.toString()
  return query.length > 0 ? `/team-sessions?${query}` : "/team-sessions"
}

function buildSessionDetailRedirectPath(input: {
  sessionId: string
  scopeOrgId?: string
  scopeTeamId?: string
  scopeTab?: string
  status?: "updated" | "info_updated" | "results_updated" | "setup_updated" | "asset_uploaded"
  error?: "invalid_input" | "forbidden" | "update_failed" | "upload_failed"
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

  if (input.scopeTab) {
    params.set("tab", input.scopeTab)
  }

  const query = params.toString()
  const basePath = `/team-sessions/${input.sessionId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}

async function ensureCampBelongsToScope(input: {
  campId: string
  scopeTeamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", input.campId)
    .maybeSingle()

  if (campError || !campRow) {
    return false
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError) {
    return false
  }

  return Boolean(teamVenueRow)
}

async function resolveScopedSessionContext(input: {
  sessionId: string
  scopeOrgId: string
  scopeTeamId: string
}): Promise<
  | {
      session: {
        id: string
        camp_id: string
        net_time_minutes: number | null
      }
      camp: {
        id: string
        team_venue_id: string
      }
      teamVenue: {
        id: string
        team_id: string
        venue_id: string
      }
    }
  | null
> {
  const supabase = await createServerSupabaseClient()

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id,camp_id,net_time_minutes")
    .eq("id", input.sessionId)
    .maybeSingle()

  if (sessionError || !sessionRow) {
    return null
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id")
    .eq("id", sessionRow.camp_id)
    .maybeSingle()

  if (campError || !campRow) {
    return null
  }

  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", campRow.team_venue_id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (teamVenueError || !teamVenueRow) {
    return null
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", teamVenueRow.venue_id)
    .eq("organization_id", input.scopeOrgId)
    .maybeSingle()

  if (venueError || !venueRow) {
    return null
  }

  return {
    session: sessionRow,
    camp: campRow,
    teamVenue: teamVenueRow,
  }
}

function revalidateSessionSlices(input: {
  sessionId: string
  campId?: string
  venueId?: string
}): void {
  revalidatePath("/team-home")
  revalidatePath("/team-sessions")
  revalidatePath(`/team-sessions/${input.sessionId}`)

  if (input.campId) {
    revalidatePath("/team-camps")
    revalidatePath(`/team-camps/${input.campId}`)
  }

  revalidatePath("/venues")

  if (input.venueId) {
    revalidatePath(`/venues/${input.venueId}`)
  }
}

export async function createSessionAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = createSessionInputSchema.safeParse({
    campId: getFormString(formData, "campId"),
    sessionType: getFormString(formData, "sessionType"),
    sessionDate: getFormString(formData, "sessionDate"),
    netTimeMinutes: getOptionalIntegerField(formData, "netTimeMinutes"),
    highlightedByCoach: getBooleanField(formData, "highlightedByCoach"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
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
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: insertError } = await supabase.from("sessions").insert({
    camp_id: parsedInput.data.campId,
    session_type: parsedInput.data.sessionType,
    session_date: parsedInput.data.sessionDate,
    net_time_minutes: parsedInput.data.netTimeMinutes ?? null,
    highlighted_by_coach: parsedInput.data.highlightedByCoach,
  })

  if (insertError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-home")

  redirect(
    buildTeamSessionsRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateSessionAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = updateSessionInputSchema.safeParse({
    id: getFormString(formData, "id"),
    campId: getFormString(formData, "campId"),
    sessionType: getFormString(formData, "sessionType"),
    sessionDate: getFormString(formData, "sessionDate"),
    netTimeMinutes: getOptionalIntegerField(formData, "netTimeMinutes"),
    highlightedByCoach: getBooleanField(formData, "highlightedByCoach"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
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
      buildTeamSessionsRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const campBelongsToScope = await ensureCampBelongsToScope({
    campId: parsedInput.data.campId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!campBelongsToScope) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      camp_id: parsedInput.data.campId,
      session_type: parsedInput.data.sessionType,
      session_date: parsedInput.data.sessionDate,
      net_time_minutes: parsedInput.data.netTimeMinutes ?? null,
      highlighted_by_coach: parsedInput.data.highlightedByCoach,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-sessions")
  revalidatePath("/team-camps")
  revalidatePath("/team-home")

  redirect(
    buildTeamSessionsRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function updateSessionDetailAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "id")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateSessionDetailInputSchema.safeParse({
    id: sessionId,
    sessionType: getFormString(formData, "sessionType"),
    sessionDate: getFormString(formData, "sessionDate"),
    startTime: parseOptionalTime(getFormString(formData, "startTime")),
    totalDurationHours: parseOptionalDurationHours(getFormString(formData, "totalDurationHours")),
  })

  if (!parsedInput.success) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
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
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.id,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.id,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.id,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const dockOutAt = parsedInput.data.startTime
    ? buildUtcTimestamp(parsedInput.data.sessionDate, parsedInput.data.startTime)
    : null
  const nextNetTimeMinutes =
    typeof parsedInput.data.totalDurationHours === "number"
      ? Math.round(parsedInput.data.totalDurationHours * 60)
      : null
  const dockInAt =
    dockOutAt && typeof nextNetTimeMinutes === "number"
      ? addMinutesToIsoTimestamp(dockOutAt, nextNetTimeMinutes)
      : null

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      session_type: parsedInput.data.sessionType,
      session_date: parsedInput.data.sessionDate,
      dock_out_at: dockOutAt,
      dock_in_at: dockInAt,
      net_time_minutes: nextNetTimeMinutes,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.id,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.id,
    campId: scopedSession.camp.id,
    venueId: scopedSession.teamVenue.venue_id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.id,
      status: "updated",
      ...scope,
    }),
  )
}

export async function updateSessionInfoAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateSessionInfoInputSchema.safeParse({
    sessionId,
    bestOfSession: getFormString(formData, "bestOfSession"),
    toWork: getFormString(formData, "toWork"),
    standardMoves: getFormString(formData, "standardMoves"),
    windPatterns: getFormString(formData, "windPatterns"),
    freeNotes: getFormString(formData, "freeNotes"),
  })

  if (!parsedInput.success) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
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
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const bestOfSession = normalizeOptionalText(parsedInput.data.bestOfSession)
  const toWork = normalizeOptionalText(parsedInput.data.toWork)
  const standardMoves = parseJsonText(parsedInput.data.standardMoves)
  const windPatterns = parseJsonText(parsedInput.data.windPatterns)
  const freeNotes = normalizeOptionalText(parsedInput.data.freeNotes)

  const supabase = await createServerSupabaseClient()
  const [reviewMutation, setupMutation] = await Promise.all([
    supabase.from("session_reviews").upsert(
      {
        session_id: parsedInput.data.sessionId,
        best_of_session: bestOfSession,
        to_work: toWork,
        standard_moves: standardMoves,
        wind_patterns: windPatterns,
        reviewed_by_profile_id: context.profile?.id ?? null,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    ),
    supabase.from("session_setups").upsert(
      {
        session_id: parsedInput.data.sessionId,
        free_notes: freeNotes,
        entered_by_profile_id: context.profile?.id ?? null,
      },
      { onConflict: "session_id" },
    ),
  ])

  if (reviewMutation.error || setupMutation.error) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    venueId: scopedSession.teamVenue.venue_id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "info_updated",
      ...scope,
    }),
  )
}

export async function updateSessionResultsAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateSessionResultsInputSchema.safeParse({
    sessionId,
    resultNotes: getFormString(formData, "resultNotes"),
  })

  if (!parsedInput.success) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
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
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resultNotes = normalizeOptionalText(parsedInput.data.resultNotes)
  const supabase = await createServerSupabaseClient()
  const { error: resultError } = await supabase.from("session_regatta_results").upsert(
    {
      session_id: parsedInput.data.sessionId,
      result_notes: resultNotes,
    },
    { onConflict: "session_id" },
  )

  if (resultError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    venueId: scopedSession.teamVenue.venue_id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "results_updated",
      ...scope,
    }),
  )
}

export async function updateSessionSetupAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateSessionSetupInputSchema.safeParse({
    sessionId,
    setupPayload: getFormString(formData, "setupPayload"),
  })

  if (!parsedInput.success) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
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
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const parsedPayload = parseSessionSetupPayload(parsedInput.data.setupPayload)

  if (!parsedPayload) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const payloadByItemId = new Map<string, SessionSetupPayloadEntry>()
  for (const entry of parsedPayload) {
    payloadByItemId.set(entry.itemId, entry)
  }

  const supabase = await createServerSupabaseClient()
  const { data: itemRows, error: itemsError } = await supabase
    .from("team_setup_items")
    .select("id,input_kind")
    .eq("team_id", scope.scopeTeamId)
    .eq("is_active", true)

  if (itemsError || !itemRows) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const itemById = new Map(itemRows.map((row) => [row.id, row]))
  const itemIds = Array.from(itemById.keys())

  if (itemIds.length === 0) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        status: "setup_updated",
        ...scope,
      }),
    )
  }

  if (parsedPayload.some((entry) => !itemById.has(entry.itemId))) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const { data: optionRows, error: optionsError } = await supabase
    .from("team_setup_item_options")
    .select("id,team_setup_item_id")
    .in("team_setup_item_id", itemIds)
    .eq("is_active", true)

  if (optionsError || !optionRows) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const validOptionIdsByItemId = new Map<string, Set<string>>()
  for (const optionRow of optionRows) {
    const optionSet = validOptionIdsByItemId.get(optionRow.team_setup_item_id) ?? new Set<string>()
    optionSet.add(optionRow.id)
    validOptionIdsByItemId.set(optionRow.team_setup_item_id, optionSet)
  }

  for (const itemId of itemIds) {
    const payloadEntry = payloadByItemId.get(itemId) ?? {
      itemId,
      textValue: null,
      selectedOptionIds: [],
    }

    const item = itemById.get(itemId)
    if (!item) {
      continue
    }

    const hasTextValue = Boolean(payloadEntry.textValue)
    const hasSelectedOptions = payloadEntry.selectedOptionIds.length > 0
    const shouldPersist = hasTextValue || hasSelectedOptions

    if (item.input_kind === "text" && hasSelectedOptions) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    if (item.input_kind !== "text" && hasTextValue) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    const validOptionIds = validOptionIdsByItemId.get(itemId) ?? new Set<string>()
    if (payloadEntry.selectedOptionIds.some((optionId) => !validOptionIds.has(optionId))) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    if (item.input_kind === "single_select" && payloadEntry.selectedOptionIds.length > 1) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    if (!shouldPersist) {
      const { data: existingValueRow, error: existingValueError } = await supabase
        .from("session_setup_item_values")
        .select("id")
        .eq("session_id", parsedInput.data.sessionId)
        .eq("team_setup_item_id", itemId)
        .maybeSingle()

      if (existingValueError) {
        redirect(
          buildSessionDetailRedirectPath({
            sessionId: parsedInput.data.sessionId,
            error: "update_failed",
            ...scope,
          }),
        )
      }

      if (existingValueRow) {
        const { error: deleteValueError } = await supabase
          .from("session_setup_item_values")
          .delete()
          .eq("id", existingValueRow.id)

        if (deleteValueError) {
          redirect(
            buildSessionDetailRedirectPath({
              sessionId: parsedInput.data.sessionId,
              error: "update_failed",
              ...scope,
            }),
          )
        }
      }

      continue
    }

    const { data: upsertedValueRow, error: upsertValueError } = await supabase
      .from("session_setup_item_values")
      .upsert(
        {
          session_id: parsedInput.data.sessionId,
          team_setup_item_id: itemId,
          text_value: item.input_kind === "text" ? payloadEntry.textValue : null,
        },
        { onConflict: "session_id,team_setup_item_id" },
      )
      .select("id")
      .single()

    if (upsertValueError || !upsertedValueRow) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "update_failed",
          ...scope,
        }),
      )
    }

    const { error: deleteSelectedOptionsError } = await supabase
      .from("session_setup_item_selected_options")
      .delete()
      .eq("session_setup_item_value_id", upsertedValueRow.id)

    if (deleteSelectedOptionsError) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "update_failed",
          ...scope,
        }),
      )
    }

    if (item.input_kind !== "text" && payloadEntry.selectedOptionIds.length > 0) {
      const { error: insertSelectedOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .insert(
          payloadEntry.selectedOptionIds.map((optionId) => ({
            session_setup_item_value_id: upsertedValueRow.id,
            team_setup_item_option_id: optionId,
          })),
        )

      if (insertSelectedOptionsError) {
        redirect(
          buildSessionDetailRedirectPath({
            sessionId: parsedInput.data.sessionId,
            error: "update_failed",
            ...scope,
          }),
        )
      }
    }
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    venueId: scopedSession.teamVenue.venue_id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_updated",
      ...scope,
    }),
  )
}

export async function uploadSessionAssetAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = uploadSessionAssetInputSchema.safeParse({
    sessionId,
    assetType: getFormString(formData, "assetType"),
  })

  const assetFile = getFormFile(formData, "assetFile")

  if (!parsedInput.success || !assetFile) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (assetFile.size <= 0 || assetFile.size > MAX_ASSET_BYTES) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
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
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const storageBucket = getAssetBucket(parsedInput.data.assetType)
  const storagePath = buildAssetStoragePath({
    sessionId: parsedInput.data.sessionId,
    assetType: parsedInput.data.assetType,
    fileName: assetFile.name,
  })

  let uploadFailed = false

  try {
    const storageAdmin = createAdminSupabaseClient()
    const fileBytes = new Uint8Array(await assetFile.arrayBuffer())
    const { error: storageError } = await storageAdmin.storage
      .from(storageBucket)
      .upload(storagePath, fileBytes, {
        contentType: assetFile.type || undefined,
        upsert: false,
      })

    if (storageError) {
      uploadFailed = true
    }
  } catch {
    uploadFailed = true
  }

  if (uploadFailed) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "upload_failed",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: insertError } = await supabase.from("session_assets").insert({
    session_id: parsedInput.data.sessionId,
    asset_type: parsedInput.data.assetType,
    bucket: storageBucket,
    storage_path: storagePath,
    file_name: assetFile.name,
    mime_type: assetFile.type || null,
    size_bytes: assetFile.size,
    uploaded_by_profile_id: context.profile?.id ?? null,
  })

  if (insertError) {
    try {
      const storageAdmin = createAdminSupabaseClient()
      await storageAdmin.storage.from(storageBucket).remove([storagePath])
    } catch {
      // Best effort cleanup only.
    }

    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "upload_failed",
        ...scope,
      }),
    )
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    venueId: scopedSession.teamVenue.venue_id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
      scopeTab: parsedInput.data.assetType === "photo" ? "images" : "analytics",
      status: "asset_uploaded",
    }),
  )
}
