"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { generateStandardMoveNameFromDescription } from "@/lib/standard-moves"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { updateSessionGearUsageInputSchema } from "@/lib/validation/gear"
import {
  createTeamSetupMetricInputSchema,
  deleteTeamSetupMetricInputSchema,
  createSessionInputSchema,
  reorderTeamSetupMetricsInputSchema,
  updateTeamSetupMetricInputSchema,
  updateSessionDetailInputSchema,
  updateSessionInfoInputSchema,
  updateSessionInputSchema,
  updateSessionGoalsInputSchema,
  updateSessionResultsInputSchema,
  updateSessionSetupInputSchema,
  uploadSessionAssetInputSchema,
} from "@/lib/validation/sessions"
import type { SessionDetailInfo } from "@/features/sessions/detail-types"
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

function getFormStringArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string")
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

function formatSessionInfoJsonNote(value: Json | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string") {
    return normalizeOptionalText(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatSessionInfoJsonNote(item))
      .filter((item): item is string => item !== null)

    return items.length > 0 ? items.join(", ") : null
  }

  const objectEntries = Object.entries(value)
    .map(([key, nestedValue]) => {
      const nestedText = formatSessionInfoJsonNote(nestedValue)
      return nestedText ? `${key}: ${nestedText}` : null
    })
    .filter((item): item is string => item !== null)

  return objectEntries.length > 0 ? objectEntries.join(" | ") : null
}

type SessionSetupPayloadEntry = {
  itemId: string
  textValue: string | null
  selectedOptions: Array<{
    optionId: string
    allocationPercent: number | null
  }>
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
    const selectedOptionsRaw =
      "selectedOptions" in item
        ? (item.selectedOptions as Array<{ optionId: string; allocationPercent?: number | null }>)
        : undefined
    const selectedOptionIdsRaw =
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

    if (
      !Array.isArray(selectedOptionsRaw) &&
      !Array.isArray(selectedOptionIdsRaw)
    ) {
      return null
    }
    const selectedOptions =
      Array.isArray(selectedOptionsRaw)
        ? selectedOptionsRaw
        : (selectedOptionIdsRaw ?? []).map((optionId) => ({
            optionId,
            allocationPercent: null,
          }))

    if (
      selectedOptions.some((selectedOption) => {
        if (!selectedOption || typeof selectedOption !== "object") {
          return true
        }

        if (
          typeof selectedOption.optionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            selectedOption.optionId,
          )
        ) {
          return true
        }

        if (
          selectedOption.allocationPercent !== undefined &&
          selectedOption.allocationPercent !== null &&
          (typeof selectedOption.allocationPercent !== "number" ||
            !Number.isInteger(selectedOption.allocationPercent))
        ) {
          return true
        }

        return false
      })
    ) {
      return null
    }

    const uniqueSelectedOptions: Array<{
      optionId: string
      allocationPercent: number | null
    }> = []
    const existingOptionIds = new Set<string>()

    for (const selectedOption of selectedOptions) {
      if (existingOptionIds.has(selectedOption.optionId)) {
        continue
      }

      existingOptionIds.add(selectedOption.optionId)
      uniqueSelectedOptions.push({
        optionId: selectedOption.optionId,
        allocationPercent:
          typeof selectedOption.allocationPercent === "number"
            ? selectedOption.allocationPercent
            : null,
      })
    }

    entries.push({
      itemId,
      textValue: normalizeOptionalText(textValue ?? undefined),
      selectedOptions: uniqueSelectedOptions,
    })
  }

  return entries
}

async function persistBoatSetupMetricOrder(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  teamId: string
  orderedItemIds: string[]
}): Promise<{ error: "invalid_input" | "update_failed" } | { error: null }> {
  const { data: teamSetupItems, error: teamSetupItemsError } = await input.supabase
    .from("team_setup_items")
    .select("id,metric_group,is_fixed,is_active,position")
    .eq("team_id", input.teamId)

  if (teamSetupItemsError || !teamSetupItems) {
    return { error: "update_failed" }
  }

  const activeBoatItems = teamSetupItems.filter(
    (item) => item.is_active && item.metric_group === "boat" && !item.is_fixed,
  )

  if (activeBoatItems.length !== input.orderedItemIds.length) {
    return { error: "invalid_input" }
  }

  const activeBoatIdSet = new Set(activeBoatItems.map((item) => item.id))
  const orderedItemIdSet = new Set(input.orderedItemIds)

  if (
    orderedItemIdSet.size !== input.orderedItemIds.length ||
    orderedItemIdSet.size !== activeBoatItems.length ||
    input.orderedItemIds.some((itemId) => !activeBoatIdSet.has(itemId))
  ) {
    return { error: "invalid_input" }
  }

  const maxPosition = Math.max(0, ...teamSetupItems.map((item) => item.position))
  const maxWeatherPosition = Math.max(
    0,
    ...teamSetupItems
      .filter((item) => item.metric_group === "weather" && item.is_active)
      .map((item) => item.position),
  )
  const temporaryBasePosition = maxPosition + 1000
  const finalBasePosition = maxWeatherPosition + 1

  for (let index = 0; index < input.orderedItemIds.length; index += 1) {
    const itemId = input.orderedItemIds[index]
    const { error: temporaryPositionError } = await input.supabase
      .from("team_setup_items")
      .update({ position: temporaryBasePosition + index })
      .eq("id", itemId)
      .eq("team_id", input.teamId)

    if (temporaryPositionError) {
      return { error: "update_failed" }
    }
  }

  for (let index = 0; index < input.orderedItemIds.length; index += 1) {
    const itemId = input.orderedItemIds[index]
    const { error: finalPositionError } = await input.supabase
      .from("team_setup_items")
      .update({ position: finalBasePosition + index })
      .eq("id", itemId)
      .eq("team_id", input.teamId)

    if (finalPositionError) {
      return { error: "update_failed" }
    }
  }

  return { error: null }
}

function normalizeTeamSetupMetricLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized.length > 0 ? normalized : "Setup metric"
}

function normalizeTeamSetupMetricOptions(values: string[]): string[] {
  const uniqueOptions = new Set<string>()

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ")

    if (normalized.length === 0) {
      continue
    }

    uniqueOptions.add(normalized)
  }

  return [...uniqueOptions]
}

function buildSetupMetricKeyBase(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (normalized.length === 0) {
    return "setup_metric"
  }

  if (/^[a-z]/.test(normalized)) {
    return normalized
  }

  return `setup_${normalized}`
}

async function generateUniqueTeamSetupMetricKey(input: {
  teamId: string
  label: string
}): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const keyBase = buildSetupMetricKeyBase(input.label)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix =
      attempt === 0
        ? ""
        : `_${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`
    const candidateKey = `${keyBase}${suffix}`

    const { data: existingRow, error: existingRowError } = await supabase
      .from("team_setup_items")
      .select("id")
      .eq("team_id", input.teamId)
      .eq("key", candidateKey)
      .maybeSingle()

    if (!existingRowError && !existingRow) {
      return candidateKey
    }
  }

  return `${keyBase}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
}

function distributeEqualIntegerPercentages(count: number, total = 100): number[] {
  if (count <= 0) {
    return []
  }

  const baseValue = Math.floor(total / count)
  const remainder = total - baseValue * count

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? baseValue + 1 : baseValue,
  )
}

function normalizeTwsSelectedOptions(input: {
  selectedOptions: Array<{ optionId: string; allocationPercent: number | null }>
}): Array<{ optionId: string; allocationPercent: number }> | null {
  const selectedOptions = input.selectedOptions

  if (selectedOptions.length === 0) {
    return []
  }

  if (selectedOptions.length === 1) {
    return [{ optionId: selectedOptions[0].optionId, allocationPercent: 100 }]
  }

  const allMissingAllocation = selectedOptions.every(
    (selectedOption) => selectedOption.allocationPercent === null,
  )

  if (allMissingAllocation) {
    return selectedOptions.map((selectedOption, index) => ({
      optionId: selectedOption.optionId,
      allocationPercent: distributeEqualIntegerPercentages(selectedOptions.length)[index] ?? 0,
    }))
  }

  if (
    selectedOptions.some(
      (selectedOption) =>
        selectedOption.allocationPercent === null ||
        selectedOption.allocationPercent < 0 ||
        selectedOption.allocationPercent > 100,
    )
  ) {
    return null
  }

  const sum = selectedOptions.reduce(
    (total, selectedOption) => total + (selectedOption.allocationPercent ?? 0),
    0,
  )

  if (sum !== 100) {
    return null
  }

  return selectedOptions.map((selectedOption) => ({
    optionId: selectedOption.optionId,
    allocationPercent: selectedOption.allocationPercent ?? 0,
  }))
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
  error?:
    | "invalid_input"
    | "forbidden"
    | "create_failed"
    | "update_failed"
    | "plan_limit_reached"
    | "payment_required"
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
  status?:
    | "updated"
    | "info_updated"
    | "goals_updated"
    | "results_updated"
    | "setup_updated"
    | "setup_metric_created"
    | "setup_metric_updated"
    | "setup_metric_deleted"
    | "setup_metrics_reordered"
    | "asset_uploaded"
    | "gear_updated"
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
  teamVenueId?: string
}): void {
  revalidatePath("/team-home")
  revalidatePath("/team-sessions")
  revalidatePath("/team-gear")
  revalidatePath("/team-notes")
  revalidatePath("/team-standard-moves")
  revalidatePath(`/team-sessions/${input.sessionId}`)

  if (input.campId) {
    revalidatePath("/team-camps")
    revalidatePath(`/team-camps/${input.campId}`)
  }

  revalidatePath("/venues")

  if (input.teamVenueId) {
    revalidatePath(`/venues/${input.teamVenueId}`)
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

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: resolvedOrganizationId,
    resource: "sessions",
  })

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: entitlementDecision.reason,
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
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.id,
      status: "updated",
      ...scope,
    }),
  )
}

type SessionInfoActionError = "invalid_input" | "forbidden" | "update_failed"

type SessionInfoAvailableStandardMove = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

type SessionInfoActionSnapshot = {
  info: SessionDetailInfo
  availableStandardMoves: SessionInfoAvailableStandardMove[]
  linkedStandardMoveIds: string[]
}

export type UpdateSessionInfoActionResult =
  | ({ ok: true } & SessionInfoActionSnapshot)
  | {
      ok: false
      error: SessionInfoActionError
      message: string
    }

type UpdateSessionInfoMutationResult =
  | ({ ok: true; sessionId: string; scope: SessionActionScope } & SessionInfoActionSnapshot)
  | {
      ok: false
      error: SessionInfoActionError
      message: string
      sessionId?: string
      scope: SessionActionScope
    }

const SESSION_INFO_ERROR_MESSAGES: Record<SessionInfoActionError, string> = {
  invalid_input: "The submitted data is invalid. Review the form and try again.",
  forbidden: "You do not have permission to manage this session in the active scope.",
  update_failed: "Could not update this session. Confirm your permissions and try again.",
}

function buildSessionInfoActionError(input: {
  error: SessionInfoActionError
  scope: SessionActionScope
  sessionId?: string
}): UpdateSessionInfoMutationResult {
  return {
    ok: false,
    error: input.error,
    message: SESSION_INFO_ERROR_MESSAGES[input.error],
    scope: input.scope,
    sessionId: input.sessionId,
  }
}

async function updateSessionInfoMutation(formData: FormData): Promise<UpdateSessionInfoMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildSessionInfoActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const parsedInput = updateSessionInfoInputSchema.safeParse({
    sessionId,
    bestOfSession: getFormString(formData, "bestOfSession"),
    toWork: getFormString(formData, "toWork"),
    windPatterns: getFormString(formData, "windPatterns"),
    freeNotes: getFormString(formData, "freeNotes"),
    standardMoveIds: getFormStringArray(formData, "standardMoveId"),
    newStandardMoveName: getFormString(formData, "newStandardMoveName"),
    newStandardMoveDescription: getFormString(formData, "newStandardMoveDescription"),
  })

  if (!parsedInput.success) {
    return buildSessionInfoActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    return buildSessionInfoActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    return buildSessionInfoActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const bestOfSession = normalizeOptionalText(parsedInput.data.bestOfSession)
  const toWork = normalizeOptionalText(parsedInput.data.toWork)
  const windPatterns = parseJsonText(parsedInput.data.windPatterns)
  const freeNotes = normalizeOptionalText(parsedInput.data.freeNotes)
  const selectedStandardMoveIds = [...new Set(parsedInput.data.standardMoveIds)]
  const newStandardMoveName = normalizeOptionalText(parsedInput.data.newStandardMoveName)
  const newStandardMoveDescription = normalizeOptionalText(
    parsedInput.data.newStandardMoveDescription,
  )
  const hasQuickCreateInput = Boolean(newStandardMoveName || newStandardMoveDescription)

  const supabase = await createServerSupabaseClient()
  const [reviewMutation, setupMutation] = await Promise.all([
    supabase.from("session_reviews").upsert(
      {
        session_id: parsedInput.data.sessionId,
        best_of_session: bestOfSession,
        to_work: toWork,
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
    return buildSessionInfoActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  let quickCreatedStandardMoveId: string | null = null

  if (hasQuickCreateInput && !newStandardMoveDescription) {
    return buildSessionInfoActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  if (newStandardMoveDescription && scope.scopeTeamId) {
    const resolvedStandardMoveName =
      newStandardMoveName ?? generateStandardMoveNameFromDescription(newStandardMoveDescription)
    const { data: existingMoveRows, error: existingMoveError } = await supabase
      .from("team_standard_moves")
      .select("id,is_active")
      .eq("team_id", scope.scopeTeamId)
      .ilike("name", resolvedStandardMoveName)
      .limit(1)

    if (existingMoveError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    const existingMove = existingMoveRows?.[0]

    if (existingMove) {
      quickCreatedStandardMoveId = existingMove.id

      if (!existingMove.is_active) {
        const { error: reactivateMoveError } = await supabase
          .from("team_standard_moves")
          .update({
            is_active: true,
            description: newStandardMoveDescription ?? undefined,
          })
          .eq("id", existingMove.id)

        if (reactivateMoveError) {
          return buildSessionInfoActionError({
            error: "update_failed",
            scope,
            sessionId: parsedInput.data.sessionId,
          })
        }
      }
    } else {
      const { data: insertedMove, error: createMoveError } = await supabase
        .from("team_standard_moves")
        .insert({
          team_id: scope.scopeTeamId,
          name: resolvedStandardMoveName,
          description: newStandardMoveDescription,
          created_by_profile_id: context.profile?.id ?? null,
        })
        .select("id")
        .single()

      if (createMoveError || !insertedMove) {
        return buildSessionInfoActionError({
          error: "update_failed",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      quickCreatedStandardMoveId = insertedMove.id
    }
  }

  const desiredStandardMoveIds = new Set<string>(selectedStandardMoveIds)

  if (quickCreatedStandardMoveId) {
    desiredStandardMoveIds.add(quickCreatedStandardMoveId)
  }

  const desiredStandardMoveIdList = [...desiredStandardMoveIds]

  const { data: existingSessionStandardMoves, error: existingSessionStandardMovesError } =
    await supabase
      .from("session_standard_moves")
      .select("id,team_standard_move_id")
      .eq("session_id", parsedInput.data.sessionId)

  if (existingSessionStandardMovesError) {
    return buildSessionInfoActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const existingMoveRows = existingSessionStandardMoves ?? []
  const existingMoveIds = new Set(existingMoveRows.map((row) => row.team_standard_move_id))

  const moveIdsToInsert = desiredStandardMoveIdList.filter((moveId) => !existingMoveIds.has(moveId))
  const rowIdsToDelete = existingMoveRows
    .filter((row) => !desiredStandardMoveIds.has(row.team_standard_move_id))
    .map((row) => row.id)

  if (moveIdsToInsert.length > 0 && scope.scopeTeamId) {
    const { data: activeMovesToInsert, error: activeMovesToInsertError } = await supabase
      .from("team_standard_moves")
      .select("id")
      .eq("team_id", scope.scopeTeamId)
      .eq("is_active", true)
      .in("id", moveIdsToInsert)

    if (activeMovesToInsertError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    if ((activeMovesToInsert ?? []).length !== moveIdsToInsert.length) {
      return buildSessionInfoActionError({
        error: "invalid_input",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    const { error: insertSessionStandardMovesError } = await supabase
      .from("session_standard_moves")
      .insert(
        moveIdsToInsert.map((moveId) => ({
          session_id: parsedInput.data.sessionId,
          team_standard_move_id: moveId,
          created_by_profile_id: context.profile?.id ?? null,
        })),
      )

    if (insertSessionStandardMovesError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }
  }

  if (rowIdsToDelete.length > 0) {
    const { error: deleteSessionStandardMovesError } = await supabase
      .from("session_standard_moves")
      .delete()
      .in("id", rowIdsToDelete)

    if (deleteSessionStandardMovesError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }
  }

  const { data: teamStandardMovesData, error: teamStandardMovesError } = await supabase
    .from("team_standard_moves")
    .select("id,name,description,is_active")
    .eq("team_id", scope.scopeTeamId)
    .order("name", { ascending: true })

  if (teamStandardMovesError) {
    return buildSessionInfoActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const availableStandardMoves = (teamStandardMovesData ?? []).map((standardMove) => ({
    id: standardMove.id,
    name: standardMove.name,
    description: standardMove.description,
    isActive: standardMove.is_active,
  }))
  const standardMoveById = new Map(
    availableStandardMoves.map((standardMove) => [standardMove.id, standardMove]),
  )
  const linkedStandardMoveIds = desiredStandardMoveIdList.filter((standardMoveId) =>
    standardMoveById.has(standardMoveId),
  )
  const standardMoves = linkedStandardMoveIds
    .map((standardMoveId) => standardMoveById.get(standardMoveId)?.name ?? null)
    .filter((standardMoveName): standardMoveName is string => standardMoveName !== null)
    .sort((left, right) => left.localeCompare(right))

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
    info: {
      bestOfSession,
      toWork,
      standardMoves,
      windPatterns: formatSessionInfoJsonNote(windPatterns),
      freeNotes,
    },
    availableStandardMoves,
    linkedStandardMoveIds,
  }
}

export async function saveSessionInfoAction(
  formData: FormData,
): Promise<UpdateSessionInfoActionResult> {
  const result = await updateSessionInfoMutation(formData)

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  return {
    ok: true,
    info: result.info,
    availableStandardMoves: result.availableStandardMoves,
    linkedStandardMoveIds: result.linkedStandardMoveIds,
  }
}

export async function updateSessionInfoAction(formData: FormData): Promise<void> {
  const result = await updateSessionInfoMutation(formData)

  if (!result.ok) {
    if (!result.sessionId) {
      redirect(
        buildTeamSessionsRedirectPath({
          error: result.error,
          ...result.scope,
        }),
      )
    }

    redirect(
      buildSessionDetailRedirectPath({
        sessionId: result.sessionId,
        error: result.error,
        ...result.scope,
      }),
    )
  }

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: result.sessionId,
      status: "info_updated",
      ...result.scope,
    }),
  )
}

export async function updateSessionGoalsAction(formData: FormData): Promise<void> {
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

  const parsedInput = updateSessionGoalsInputSchema.safeParse({
    sessionId,
    goals: getFormString(formData, "goals") ?? "",
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

  const normalizedGoals = parsedInput.data.goals.trim()
  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      goals: normalizedGoals.length > 0 ? normalizedGoals : null,
    })
    .eq("id", parsedInput.data.sessionId)

  if (updateError) {
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
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "goals_updated",
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
    teamVenueId: scopedSession.teamVenue.id,
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
    orderedItemIdsPayload: getFormString(formData, "orderedItemIdsPayload"),
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
  const orderedItemIds =
    typeof parsedInput.data.orderedItemIdsPayload === "string"
      ? parseStringArrayPayload(parsedInput.data.orderedItemIdsPayload)
      : undefined

  if (!parsedPayload || orderedItemIds === null) {
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
    .select("id,key,input_kind,metric_group,is_fixed")
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
      selectedOptions: [],
    }

    const item = itemById.get(itemId)
    if (!item) {
      continue
    }

    const hasTextValue = Boolean(payloadEntry.textValue)
    const hasSelectedOptions = payloadEntry.selectedOptions.length > 0
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
    if (
      payloadEntry.selectedOptions.some((selectedOption) => !validOptionIds.has(selectedOption.optionId))
    ) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }

    if (item.input_kind === "single_select" && payloadEntry.selectedOptions.length > 1) {
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

    const normalizedSelectedOptions =
      item.key === "tws"
        ? normalizeTwsSelectedOptions({
            selectedOptions: payloadEntry.selectedOptions,
          })
        : payloadEntry.selectedOptions.map((selectedOption) => ({
            optionId: selectedOption.optionId,
            allocationPercent: null,
          }))

    if (!normalizedSelectedOptions) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
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

    if (item.input_kind !== "text" && normalizedSelectedOptions.length > 0) {
      const { error: insertSelectedOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .insert(
          normalizedSelectedOptions.map((selectedOption) => ({
            session_setup_item_value_id: upsertedValueRow.id,
            team_setup_item_option_id: selectedOption.optionId,
            allocation_percent:
              item.key === "tws" ? selectedOption.allocationPercent : null,
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

  if (orderedItemIds) {
    const reorderResult = await persistBoatSetupMetricOrder({
      supabase,
      teamId: scope.scopeTeamId,
      orderedItemIds,
    })

    if (reorderResult.error) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: reorderResult.error,
          ...scope,
        }),
      )
    }
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_updated",
      ...scope,
    }),
  )
}

function parseStringArrayPayload(value: string | undefined): string[] | null {
  if (!value) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    return null
  }

  return parsed
}

async function ensureCanManageScopedSessionSetup(input: {
  scope: SessionActionScope
  sessionId: string
}) {
  const context = await requireAuthenticatedAccessContext()

  if (!input.scope.scopeOrgId || !input.scope.scopeTeamId) {
    return null
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: input.scope.scopeOrgId,
      teamId: input.scope.scopeTeamId,
    })
  ) {
    return null
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: input.sessionId,
    scopeOrgId: input.scope.scopeOrgId,
    scopeTeamId: input.scope.scopeTeamId,
  })

  return scopedSession
}

export async function createTeamSetupMetricAction(formData: FormData): Promise<void> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const parsedOptions = parseStringArrayPayload(getFormString(formData, "optionsPayload"))

  if (!sessionId || !parsedOptions) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = createTeamSetupMetricInputSchema.safeParse({
    sessionId,
    inputKind: getFormString(formData, "inputKind"),
    label: getFormString(formData, "label"),
    options: parsedOptions,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
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

  const normalizedLabel = normalizeTeamSetupMetricLabel(parsedInput.data.label)
  const normalizedOptions = normalizeTeamSetupMetricOptions(parsedInput.data.options)

  if (parsedInput.data.inputKind === "text" && normalizedOptions.length > 0) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.inputKind !== "text" && normalizedOptions.length === 0) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("team_setup_items")
    .select("position")
    .eq("team_id", scope.scopeTeamId)
    .eq("is_active", true)

  if (existingRowsError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const nextPosition =
    Math.max(0, ...(existingRows ?? []).map((row) => row.position)) + 1
  const metricKey = await generateUniqueTeamSetupMetricKey({
    teamId: scope.scopeTeamId,
    label: normalizedLabel,
  })

  const { data: insertedItem, error: insertItemError } = await supabase
    .from("team_setup_items")
    .insert({
      team_id: scope.scopeTeamId,
      team_type_setup_item_id: null,
      key: metricKey,
      label: normalizedLabel,
      input_kind: parsedInput.data.inputKind,
      metric_group: "boat",
      is_fixed: false,
      position: nextPosition,
      is_active: true,
    })
    .select("id")
    .single()

  if (insertItemError || !insertedItem) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.inputKind !== "text" && normalizedOptions.length > 0) {
    const { error: insertOptionsError } = await supabase
      .from("team_setup_item_options")
      .insert(
        normalizedOptions.map((optionValue, index) => ({
          team_setup_item_id: insertedItem.id,
          team_type_setup_item_option_id: null,
          value: optionValue,
          label: optionValue,
          position: index + 1,
          is_active: true,
        })),
      )

    if (insertOptionsError) {
      await supabase.from("team_setup_items").delete().eq("id", insertedItem.id)

      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "update_failed",
          ...scope,
        }),
      )
    }
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_metric_created",
      ...scope,
    }),
  )
}

export async function updateTeamSetupMetricAction(formData: FormData): Promise<void> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const parsedOptions = parseStringArrayPayload(getFormString(formData, "optionsPayload"))

  if (!sessionId || !parsedOptions) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateTeamSetupMetricInputSchema.safeParse({
    sessionId,
    itemId: getFormString(formData, "itemId"),
    inputKind: getFormString(formData, "inputKind"),
    label: getFormString(formData, "label"),
    options: parsedOptions,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
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

  const normalizedLabel = normalizeTeamSetupMetricLabel(parsedInput.data.label)
  const normalizedOptions = normalizeTeamSetupMetricOptions(parsedInput.data.options)

  if (parsedInput.data.inputKind === "text" && normalizedOptions.length > 0) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.inputKind !== "text" && normalizedOptions.length === 0) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: itemRow, error: itemRowError } = await supabase
    .from("team_setup_items")
    .select("id,metric_group,is_fixed")
    .eq("id", parsedInput.data.itemId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (itemRowError || !itemRow || itemRow.metric_group !== "boat" || itemRow.is_fixed) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const { error: updateItemError } = await supabase
    .from("team_setup_items")
    .update({
      label: normalizedLabel,
      input_kind: parsedInput.data.inputKind,
      metric_group: "boat",
      is_fixed: false,
    })
    .eq("id", parsedInput.data.itemId)

  if (updateItemError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error: deactivateOptionsError } = await supabase
    .from("team_setup_item_options")
    .update({ is_active: false })
    .eq("team_setup_item_id", parsedInput.data.itemId)

  if (deactivateOptionsError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.inputKind !== "text" && normalizedOptions.length > 0) {
    for (let index = 0; index < normalizedOptions.length; index += 1) {
      const optionValue = normalizedOptions[index]
      const { error: upsertOptionError } = await supabase
        .from("team_setup_item_options")
        .upsert(
          {
            team_setup_item_id: parsedInput.data.itemId,
            team_type_setup_item_option_id: null,
            value: optionValue,
            label: optionValue,
            position: index + 1,
            is_active: true,
          },
          { onConflict: "team_setup_item_id,value" },
        )

      if (upsertOptionError) {
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
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_metric_updated",
      ...scope,
    }),
  )
}

export async function deleteTeamSetupMetricAction(formData: FormData): Promise<void> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  const parsedInput = deleteTeamSetupMetricInputSchema.safeParse({
    sessionId,
    itemId: getFormString(formData, "itemId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: sessionId ?? "",
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
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

  const supabase = await createServerSupabaseClient()
  const { data: itemRow, error: itemRowError } = await supabase
    .from("team_setup_items")
    .select("id,metric_group,is_fixed")
    .eq("id", parsedInput.data.itemId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (itemRowError || !itemRow || itemRow.metric_group !== "boat" || itemRow.is_fixed) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const { error: deactivateItemError } = await supabase
    .from("team_setup_items")
    .update({ is_active: false })
    .eq("id", parsedInput.data.itemId)

  const { error: deactivateOptionsError } = await supabase
    .from("team_setup_item_options")
    .update({ is_active: false })
    .eq("team_setup_item_id", parsedInput.data.itemId)

  if (deactivateItemError || deactivateOptionsError) {
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
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_metric_deleted",
      ...scope,
    }),
  )
}

export async function reorderTeamSetupMetricsAction(formData: FormData): Promise<void> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const orderedItemIds = parseStringArrayPayload(getFormString(formData, "orderedItemIdsPayload"))

  const parsedInput = reorderTeamSetupMetricsInputSchema.safeParse({
    sessionId,
    orderedItemIds,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: sessionId ?? "",
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
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

  const supabase = await createServerSupabaseClient()
  const reorderResult = await persistBoatSetupMetricOrder({
    supabase,
    teamId: scope.scopeTeamId,
    orderedItemIds: parsedInput.data.orderedItemIds,
  })

  if (reorderResult.error) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: reorderResult.error,
        ...scope,
      }),
    )
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "setup_metrics_reordered",
      ...scope,
    }),
  )
}

export async function updateSessionGearUsageAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const uniqueGearItemIds = [...new Set(getFormStringArray(formData, "gearItemIds"))]

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamSessionsRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const parsedInput = updateSessionGearUsageInputSchema.safeParse({
    sessionId,
    gearItemIds: uniqueGearItemIds,
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

  const supabase = await createServerSupabaseClient()

  if (parsedInput.data.gearItemIds.length > 0) {
    const { data: scopedGearRows, error: scopedGearError } = await supabase
      .from("gear_items")
      .select("id")
      .eq("team_id", scope.scopeTeamId)
      .in("id", parsedInput.data.gearItemIds)

    if (scopedGearError) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "update_failed",
          ...scope,
        }),
      )
    }

    if (!scopedGearRows || scopedGearRows.length !== parsedInput.data.gearItemIds.length) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "invalid_input",
          ...scope,
        }),
      )
    }
  }

  const { error: deleteUsageError } = await supabase
    .from("session_gear_usage")
    .delete()
    .eq("session_id", parsedInput.data.sessionId)

  if (deleteUsageError) {
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.gearItemIds.length > 0) {
    const { error: insertUsageError } = await supabase.from("session_gear_usage").insert(
      parsedInput.data.gearItemIds.map((gearItemId) => ({
        session_id: parsedInput.data.sessionId,
        gear_item_id: gearItemId,
        linked_by_profile_id: context.profile?.id ?? null,
      })),
    )

    if (insertUsageError) {
      redirect(
        buildSessionDetailRedirectPath({
          sessionId: parsedInput.data.sessionId,
          error: "update_failed",
          ...scope,
        }),
      )
    }
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "gear_updated",
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
    teamVenueId: scopedSession.teamVenue.id,
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
