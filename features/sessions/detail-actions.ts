"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  buildTeamSessionsRedirectPath,
  resolveHighlightFilter,
} from "@/features/sessions/list-route-state.mjs"
import {
  logSessionDetailTiming,
  startSessionDetailTiming,
  type SessionDetailTimingStatus,
} from "@/features/sessions/detail-timing"
import { getSessionDetailInfoTabData } from "@/features/sessions/detail-data"
import {
  buildScopedNotificationHref,
  buildSessionReviewFieldLabel,
  buildSessionUpdateMessage,
  formatActorName,
  formatSessionLabel,
  NOTIFICATION_EVENT_TYPES,
  shouldNotifyTextAdded,
} from "@/features/notifications/core.mjs"
import {
  createGearAlertNotificationsForActiveTeamMembers,
  createNotificationsForActiveTeamMembers,
} from "@/features/notifications/server"
import { resolveOrganizationSessionAssetUploadEntitlement } from "@/lib/billing/entitlements"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  assertValidVakarosCsvFileName,
  parseVakarosCsv,
} from "@/features/sessions/vakaros-parser.mjs"
import { normalizeVakarosSavedTrimInput } from "@/features/sessions/vakaros-saved-trims.mjs"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { updateSessionGearUsageInputSchema } from "@/lib/validation/gear"
import { createTeamStandardMoveInputSchema } from "@/lib/validation/standard-moves"
import { createTeamVenueWindPatternInputSchema } from "@/lib/validation/wind-patterns"
import {
  createTeamSetupMetricInputSchema,
  deleteSessionAssetInputSchema,
  deleteTeamSetupMetricInputSchema,
  reorderTeamSetupMetricsInputSchema,
  updateTeamSetupMetricInputSchema,
  updateSessionDetailInputSchema,
  updateSessionInfoInputSchema,
  updateSessionGoalsInputSchema,
  updateSessionResultsInputSchema,
  updateSessionSetupInputSchema,
  uploadSessionGpsFileInputSchema,
  uploadSessionAssetInputSchema,
  deleteSessionVakarosTrimInputSchema,
  saveSessionVakarosTrimInputSchema,
} from "@/lib/validation/sessions"
import type {
  SessionDetailInfoTabData,
  SessionSetupDialogItem,
  SessionDetailVakarosSavedTrim,
} from "@/features/sessions/detail-types"
import type { Database, Json } from "@/types/database"

const SESSION_PHOTOS_BUCKET = "session-photos"
const SESSION_FILES_BUCKET = "session-files"
const SESSION_GPS_FILES_BUCKET = "session-gps-files"
const MAX_ASSET_BYTES = 25 * 1024 * 1024
const MAX_PHOTO_ASSET_BYTES = 2 * 1024 * 1024
const MAX_PHOTO_THUMBNAIL_BYTES = 256 * 1024
const COMPRESSED_PHOTO_MIME_TYPE = "image/webp"
const ANALYTICS_FILE_MIME_TYPE = "application/pdf"
const GPS_FILE_MIME_TYPE = "text/csv"

type SessionActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeVenueId?: string
  scopeCampId?: string
  scopeHighlight?: "yes" | "no"
  scopeTab?: string
  scopePage?: number
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>
type TeamGearAlertRow =
  Database["public"]["Functions"]["get_team_gear_alert_rows"]["Returns"][number]

function logSessionActionTiming(input: {
  error?: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  outcome: string
  phase: string
  scope: SessionActionScope
  sessionId?: string | null
  startedAt: number
  status: SessionDetailTimingStatus
}): void {
  logSessionDetailTiming({
    route: "/team-sessions/[id]",
    phase: input.phase,
    startedAt: input.startedAt,
    sessionId: input.sessionId,
    activeTeamId: input.scope.scopeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: {
      activeOrganizationId: input.scope.scopeOrgId ?? null,
      outcome: input.outcome,
      ...input.metadata,
    },
  })
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

type SessionSetupPayloadEntry = {
  itemId: string
  textValue: string | null
  selectedOptions: Array<{
    optionId: string
    allocationPercent: number | null
  }>
}

type SessionSetupAtomicValueInput = {
  team_setup_item_id: string
  text_value: string | null
  selected_options: Array<{
    team_setup_item_option_id: string
    allocation_percent: number | null
  }>
}

type TeamSetupItemMutationRow = Pick<
  Database["public"]["Tables"]["team_setup_items"]["Row"],
  "id" | "key" | "input_kind" | "metric_group" | "is_fixed" | "is_required"
>

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

async function persistSetupMetricOrder(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  teamId: string
  metricGroup: Database["public"]["Enums"]["setup_metric_group"]
  orderedItemIds: string[]
}): Promise<{ error: "invalid_input" | "update_failed" } | { error: null }> {
  const { data: currentRows, error: currentRowsError } = await input.supabase
    .from("team_setup_items")
    .select("id,position")
    .eq("team_id", input.teamId)
    .eq("metric_group", input.metricGroup)
    .eq("is_active", true)
    .eq("is_fixed", false)
    .eq("is_required", false)
    .order("position", { ascending: true })

  if (currentRowsError || !currentRows) {
    return { error: "update_failed" }
  }

  const currentItemIds = currentRows.map((row) => row.id)
  const orderedItemIdSet = new Set(input.orderedItemIds)

  if (
    orderedItemIdSet.size !== input.orderedItemIds.length ||
    currentItemIds.length !== input.orderedItemIds.length ||
    currentItemIds.some((itemId) => !orderedItemIdSet.has(itemId))
  ) {
    return { error: "invalid_input" }
  }

  if (currentItemIds.every((itemId, index) => itemId === input.orderedItemIds[index])) {
    return { error: null }
  }

  const { data: allPositionRows, error: allPositionRowsError } = await input.supabase
    .from("team_setup_items")
    .select("position")
    .eq("team_id", input.teamId)

  if (allPositionRowsError || !allPositionRows) {
    return { error: "update_failed" }
  }

  const temporaryBasePosition =
    Math.max(0, ...allPositionRows.map((row) => row.position)) + 1000
  const finalPositions = currentRows.map((row) => row.position)

  for (let index = 0; index < input.orderedItemIds.length; index += 1) {
    const { error: temporaryUpdateError } = await input.supabase
      .from("team_setup_items")
      .update({ position: temporaryBasePosition + index })
      .eq("team_id", input.teamId)
      .eq("id", input.orderedItemIds[index])

    if (temporaryUpdateError) {
      return { error: "update_failed" }
    }
  }

  for (let index = 0; index < input.orderedItemIds.length; index += 1) {
    const { error: finalUpdateError } = await input.supabase
      .from("team_setup_items")
      .update({ position: finalPositions[index] ?? index + 1 })
      .eq("team_id", input.teamId)
      .eq("id", input.orderedItemIds[index])

    if (finalUpdateError) {
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

async function sessionHasSavedTwsSelection(input: {
  sessionId: string
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  teamId: string
}): Promise<boolean | null> {
  const { data: twsItem, error: twsItemError } = await input.supabase
    .from("team_setup_items")
    .select("id,input_kind")
    .eq("team_id", input.teamId)
    .eq("key", "tws")
    .eq("metric_group", "weather")
    .eq("is_active", true)
    .maybeSingle()

  if (twsItemError) {
    return null
  }

  if (!twsItem || twsItem.input_kind !== "multi_select") {
    return false
  }

  const { data: valueRow, error: valueRowError } = await input.supabase
    .from("session_setup_item_values")
    .select("id")
    .eq("session_id", input.sessionId)
    .eq("team_setup_item_id", twsItem.id)
    .maybeSingle()

  if (valueRowError) {
    return null
  }

  if (!valueRow) {
    return false
  }

  const { data: selectedRows, error: selectedRowsError } = await input.supabase
    .from("session_setup_item_selected_options")
    .select("team_setup_item_option_id")
    .eq("session_setup_item_value_id", valueRow.id)

  if (selectedRowsError) {
    return null
  }

  const selectedOptionIds = [
    ...new Set((selectedRows ?? []).map((row) => row.team_setup_item_option_id)),
  ]

  if (selectedOptionIds.length === 0) {
    return false
  }

  const { data: activeSelectedOptionRows, error: activeSelectedOptionRowsError } =
    await input.supabase
      .from("team_setup_item_options")
      .select("id")
      .eq("team_setup_item_id", twsItem.id)
      .eq("is_active", true)
      .in("id", selectedOptionIds)

  if (activeSelectedOptionRowsError) {
    return null
  }

  return (activeSelectedOptionRows ?? []).length > 0
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function getAssetBucket(assetType: "photo" | "analytics_file"): string {
  return assetType === "photo" ? SESSION_PHOTOS_BUCKET : SESSION_FILES_BUCKET
}

function buildGpsFileStorageBasePath(input: {
  sessionId: string
  fileName: string
}): string {
  const safeName = sanitizeFileName(input.fileName.replace(/\.csv$/i, ""))
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `sessions/${input.sessionId}/gps_file/${timestamp}-${randomPart}-${safeName}`
}

function buildGpsFileArtifactStoragePaths(input: {
  basePath: string
}): {
  series1HzStoragePath: string
  summaryStoragePath: string
  trackGeojsonStoragePath: string
} {
  return {
    series1HzStoragePath: `${input.basePath}/series_1hz.csv`,
    summaryStoragePath: `${input.basePath}/summary.csv`,
    trackGeojsonStoragePath: `${input.basePath}/track.geojson`,
  }
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

function buildAssetThumbnailStoragePath(storagePath: string): string {
  const lastSlashIndex = storagePath.lastIndexOf("/")
  const extensionIndex = storagePath.lastIndexOf(".")

  if (extensionIndex > lastSlashIndex) {
    return `${storagePath.slice(0, extensionIndex)}.thumb.webp`
  }

  return `${storagePath}.thumb.webp`
}

function hasPdfFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(".pdf")
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

function hasPdfFileSignature(fileBytes: Uint8Array): boolean {
  return hasAsciiSignature(fileBytes, 0, "%PDF-")
}

function hasValidSessionAssetFileSignature(input: {
  assetType: "photo" | "analytics_file"
  fileBytes: Uint8Array
}): boolean {
  if (input.assetType === "photo") {
    return hasWebpFileSignature(input.fileBytes)
  }

  return hasPdfFileSignature(input.fileBytes)
}

function getScopeFromFormData(formData: FormData): SessionActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const scopeVenueId = getFormString(formData, "scopeVenueId")
  const scopeCampId = getFormString(formData, "scopeCampId")
  const scopeHighlight = resolveHighlightFilter(
    getFormString(formData, "scopeHighlight"),
  )
  const scopeTab = normalizeScopeTab(getFormString(formData, "scopeTab"))
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeVenueId,
      scopeCampId,
      scopeHighlight,
      scopeTab,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
    scopeCampId,
    scopeHighlight,
    scopeTab,
    scopePage,
  }
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
  error?:
    | "invalid_input"
    | "forbidden"
    | "tws_required"
    | "update_failed"
    | "upload_failed"
    | "plan_limit_reached"
    | "payment_required"
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

async function resolveScopedSessionContext(input: {
  sessionId: string
  scopeOrgId: string
  scopeTeamId: string
}): Promise<
  | {
      session: {
        id: string
        camp_id: string
        session_date: string
        dock_out_at: string | null
        net_time_minutes: number | null
        goals: string | null
      }
      camp: {
        id: string
        end_date: string
        start_date: string
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
    .select("id,camp_id,session_date,dock_out_at,net_time_minutes,goals")
    .eq("id", input.sessionId)
    .maybeSingle()

  if (sessionError || !sessionRow) {
    return null
  }

  const { data: campRow, error: campError } = await supabase
    .from("camps")
    .select("id,team_venue_id,start_date,end_date")
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

function revalidateSessionSetupSlices(input: { sessionId: string }): void {
  revalidatePath(`/team-sessions/${input.sessionId}`)
}

export async function updateSessionDetailAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "id")
  const logTiming = (
    status: SessionDetailTimingStatus,
    outcome: string,
    error?: string,
  ) => {
    logSessionActionTiming({
      phase: "save_session_metadata",
      startedAt,
      scope,
      sessionId,
      status,
      outcome,
      error,
    })
  }

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming("error", "invalid_input")
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
    logTiming("error", "invalid_input")
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
    logTiming("error", "forbidden")
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
    logTiming("error", "forbidden")
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.id,
        error: "forbidden",
        ...scope,
      }),
    )
  }

  if (
    parsedInput.data.sessionDate < scopedSession.camp.start_date ||
    parsedInput.data.sessionDate > scopedSession.camp.end_date
  ) {
    logTiming("error", "invalid_input")
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.id,
        error: "invalid_input",
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
    logTiming("error", "update_failed", updateError.message)
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

  logTiming("success", "updated")
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

type SessionInfoAvailableWindPattern = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

type SessionInfoActionSnapshot = SessionDetailInfoTabData

export type UpdateSessionInfoActionResult =
  | ({ ok: true } & SessionInfoActionSnapshot)
  | {
      ok: false
      error: SessionInfoActionError
      message: string
    }

type CreateSessionStandardMoveActionError = "invalid_input" | "forbidden" | "create_failed"
type CreateSessionWindPatternActionError = "invalid_input" | "forbidden" | "create_failed"

export type CreateSessionStandardMoveActionResult =
  | {
      ok: true
      standardMove: SessionInfoAvailableStandardMove
      availableStandardMoves: SessionInfoAvailableStandardMove[]
    }
  | {
      ok: false
      error: CreateSessionStandardMoveActionError
      message: string
    }

export type CreateSessionWindPatternActionResult =
  | {
      ok: true
      windPattern: SessionInfoAvailableWindPattern
      availableWindPatterns: SessionInfoAvailableWindPattern[]
    }
  | {
      ok: false
      error: CreateSessionWindPatternActionError
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

const CREATE_SESSION_STANDARD_MOVE_ERROR_MESSAGES: Record<
  CreateSessionStandardMoveActionError,
  string
> = {
  invalid_input: "The submitted standard move data is invalid. Review the form and try again.",
  forbidden: "You do not have permission to manage this session in the active scope.",
  create_failed: "Could not create standard move. Confirm permissions and uniqueness of the name.",
}

const CREATE_SESSION_WIND_PATTERN_ERROR_MESSAGES: Record<
  CreateSessionWindPatternActionError,
  string
> = {
  invalid_input: "The submitted wind pattern data is invalid. Review the form and try again.",
  forbidden: "You do not have permission to manage this session in the active scope.",
  create_failed: "Could not create wind pattern. Confirm permissions and uniqueness of the name.",
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

function buildCreateSessionStandardMoveActionError(
  error: CreateSessionStandardMoveActionError,
): CreateSessionStandardMoveActionResult {
  return {
    ok: false,
    error,
    message: CREATE_SESSION_STANDARD_MOVE_ERROR_MESSAGES[error],
  }
}

function buildCreateSessionWindPatternActionError(
  error: CreateSessionWindPatternActionError,
): CreateSessionWindPatternActionResult {
  return {
    ok: false,
    error,
    message: CREATE_SESSION_WIND_PATTERN_ERROR_MESSAGES[error],
  }
}

export async function createSessionStandardMoveAction(
  formData: FormData,
): Promise<CreateSessionStandardMoveActionResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const parsedInput = createTeamStandardMoveInputSchema.safeParse({
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId || !parsedInput.success) {
    return buildCreateSessionStandardMoveActionError("invalid_input")
  }

  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)

  if (!normalizedDescription) {
    return buildCreateSessionStandardMoveActionError("invalid_input")
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    return buildCreateSessionStandardMoveActionError("forbidden")
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    return buildCreateSessionStandardMoveActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: existingMoveRows, error: existingMoveError } = await supabase
    .from("team_standard_moves")
    .select("id")
    .eq("team_id", scope.scopeTeamId)
    .ilike("name", parsedInput.data.name)
    .limit(1)

  if (existingMoveError) {
    return buildCreateSessionStandardMoveActionError("create_failed")
  }

  const existingMove = existingMoveRows?.[0]
  const moveMutation = existingMove
    ? await supabase
        .from("team_standard_moves")
        .update({
          name: parsedInput.data.name,
          description: normalizedDescription,
          is_active: true,
        })
        .eq("id", existingMove.id)
        .select("id,name,description,is_active")
        .single()
    : await supabase
        .from("team_standard_moves")
        .insert({
          team_id: scope.scopeTeamId,
          name: parsedInput.data.name,
          description: normalizedDescription,
          created_by_profile_id: context.profile?.id ?? null,
        })
        .select("id,name,description,is_active")
        .single()

  if (moveMutation.error || !moveMutation.data) {
    return buildCreateSessionStandardMoveActionError("create_failed")
  }

  const standardMove = {
    id: moveMutation.data.id,
    name: moveMutation.data.name,
    description: moveMutation.data.description,
    isActive: moveMutation.data.is_active,
  }

  revalidateSessionSlices({
    sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    standardMove,
    availableStandardMoves: [standardMove],
  }
}

export async function createSessionWindPatternAction(
  formData: FormData,
): Promise<CreateSessionWindPatternActionResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const parsedInput = createTeamVenueWindPatternInputSchema.safeParse({
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
  })

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId || !parsedInput.success) {
    return buildCreateSessionWindPatternActionError("invalid_input")
  }

  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)

  if (!normalizedDescription) {
    return buildCreateSessionWindPatternActionError("invalid_input")
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    return buildCreateSessionWindPatternActionError("forbidden")
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    return buildCreateSessionWindPatternActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: existingPatternRows, error: existingPatternError } = await supabase
    .from("team_venue_wind_patterns")
    .select("id")
    .eq("team_venue_id", scopedSession.teamVenue.id)
    .ilike("name", parsedInput.data.name)
    .limit(1)

  if (existingPatternError) {
    return buildCreateSessionWindPatternActionError("create_failed")
  }

  const existingPattern = existingPatternRows?.[0]
  const patternMutation = existingPattern
    ? await supabase
        .from("team_venue_wind_patterns")
        .update({
          name: parsedInput.data.name,
          description: normalizedDescription,
          is_active: true,
        })
        .eq("id", existingPattern.id)
        .select("id,name,description,is_active")
        .single()
    : await supabase
        .from("team_venue_wind_patterns")
        .insert({
          team_venue_id: scopedSession.teamVenue.id,
          name: parsedInput.data.name,
          description: normalizedDescription,
          created_by_profile_id: context.profile?.id ?? null,
        })
        .select("id,name,description,is_active")
        .single()

  if (patternMutation.error || !patternMutation.data) {
    return buildCreateSessionWindPatternActionError("create_failed")
  }

  const windPattern = {
    id: patternMutation.data.id,
    name: patternMutation.data.name,
    description: patternMutation.data.description,
    isActive: patternMutation.data.is_active,
  }

  revalidateSessionSlices({
    sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    windPattern,
    availableWindPatterns: [windPattern],
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
    freeNotes: getFormString(formData, "freeNotes"),
    standardMoveIds: getFormStringArray(formData, "standardMoveId"),
    windPatternIds: getFormStringArray(formData, "windPatternId"),
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
  const freeNotes = normalizeOptionalText(parsedInput.data.freeNotes)
  const selectedStandardMoveIds = [...new Set(parsedInput.data.standardMoveIds)]
  const selectedWindPatternIds = [...new Set(parsedInput.data.windPatternIds)]

  const supabase = await createServerSupabaseClient()
  const { data: existingReviewRow, error: existingReviewError } = await supabase
    .from("session_reviews")
    .select("best_of_session,to_work")
    .eq("session_id", parsedInput.data.sessionId)
    .maybeSingle()

  if (existingReviewError) {
    console.error("Failed to load session notification state", existingReviewError)
  }

  const [reviewMutation, setupMutation] = await Promise.all([
    supabase.from("session_reviews").upsert(
      {
        session_id: parsedInput.data.sessionId,
        best_of_session: bestOfSession,
        to_work: toWork,
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

  const desiredStandardMoveIds = new Set<string>(selectedStandardMoveIds)
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

  const desiredWindPatternIds = new Set<string>(selectedWindPatternIds)
  const desiredWindPatternIdList = [...desiredWindPatternIds]

  const { data: existingSessionWindPatterns, error: existingSessionWindPatternsError } =
    await supabase
      .from("session_wind_patterns")
      .select("id,team_venue_wind_pattern_id")
      .eq("session_id", parsedInput.data.sessionId)

  if (existingSessionWindPatternsError) {
    return buildSessionInfoActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const existingWindPatternRows = existingSessionWindPatterns ?? []
  const existingWindPatternIds = new Set(
    existingWindPatternRows.map((row) => row.team_venue_wind_pattern_id),
  )

  const windPatternIdsToInsert = desiredWindPatternIdList.filter(
    (windPatternId) => !existingWindPatternIds.has(windPatternId),
  )
  const windPatternRowIdsToDelete = existingWindPatternRows
    .filter((row) => !desiredWindPatternIds.has(row.team_venue_wind_pattern_id))
    .map((row) => row.id)

  if (windPatternIdsToInsert.length > 0) {
    const { data: activePatternsToInsert, error: activePatternsToInsertError } = await supabase
      .from("team_venue_wind_patterns")
      .select("id")
      .eq("team_venue_id", scopedSession.teamVenue.id)
      .eq("is_active", true)
      .in("id", windPatternIdsToInsert)

    if (activePatternsToInsertError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    if ((activePatternsToInsert ?? []).length !== windPatternIdsToInsert.length) {
      return buildSessionInfoActionError({
        error: "invalid_input",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    const { error: insertSessionWindPatternsError } = await supabase
      .from("session_wind_patterns")
      .insert(
        windPatternIdsToInsert.map((windPatternId) => ({
          session_id: parsedInput.data.sessionId,
          team_venue_wind_pattern_id: windPatternId,
          created_by_profile_id: context.profile?.id ?? null,
        })),
      )

    if (insertSessionWindPatternsError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }
  }

  if (windPatternRowIdsToDelete.length > 0) {
    const { error: deleteSessionWindPatternsError } = await supabase
      .from("session_wind_patterns")
      .delete()
      .in("id", windPatternRowIdsToDelete)

    if (deleteSessionWindPatternsError) {
      return buildSessionInfoActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  let infoSnapshot: SessionDetailInfoTabData

  try {
    infoSnapshot = await getSessionDetailInfoTabData({
      activeOrganizationId: scope.scopeOrgId,
      activeTeamId: scope.scopeTeamId,
      sessionId: parsedInput.data.sessionId,
      teamVenueId: scopedSession.teamVenue.id,
    })
  } catch {
    return buildSessionInfoActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  if (!existingReviewError) {
    const bestAdded = shouldNotifyTextAdded(
      existingReviewRow?.best_of_session,
      bestOfSession,
    )
    const toWorkAdded = shouldNotifyTextAdded(existingReviewRow?.to_work, toWork)

    if (bestAdded || toWorkAdded) {
      const actorName = formatActorName({
        firstName: context.profile?.first_name,
        lastName: context.profile?.last_name,
        email: context.user.email ?? null,
      })
      const fieldLabel = buildSessionReviewFieldLabel({ bestAdded, toWorkAdded })
      const sessionLabel = formatSessionLabel({
        sessionDate: scopedSession.session.session_date,
        dockOutAt: scopedSession.session.dock_out_at,
      })

      await createNotificationsForActiveTeamMembers({
        excludeProfileId: context.user.id,
        actorProfileId: context.user.id,
        teamId: scope.scopeTeamId,
        eventType: NOTIFICATION_EVENT_TYPES.SESSION_REVIEW_ADDED,
        message: buildSessionUpdateMessage({
          actorName,
          fieldLabel,
          sessionLabel,
        }),
        targetHref: buildScopedNotificationHref({
          pathname: `/team-sessions/${parsedInput.data.sessionId}`,
          orgId: scope.scopeOrgId,
          teamId: scope.scopeTeamId,
          tab: "info",
        }),
        metadata: {
          sessionId: parsedInput.data.sessionId,
          campId: scopedSession.camp.id,
          fields: {
            bestAdded,
            toWorkAdded,
          },
        },
      })
    }
  }

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
    ...infoSnapshot,
  }
}

export async function saveSessionInfoAction(
  formData: FormData,
): Promise<UpdateSessionInfoActionResult> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const result = await updateSessionInfoMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_info",
      startedAt,
      scope,
      sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
    })

    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  logSessionActionTiming({
    phase: "save_session_info",
    startedAt,
    scope,
    sessionId,
    status: "success",
    outcome: "saved",
    metadata: {
      standardMoveCount: result.linkedStandardMoveIds.length,
      windPatternCount: result.linkedWindPatternIds.length,
    },
  })

  return {
    ok: true,
    info: result.info,
    availableStandardMoves: result.availableStandardMoves,
    linkedStandardMoveIds: result.linkedStandardMoveIds,
    standardMoveCatalogPage: result.standardMoveCatalogPage,
    availableWindPatterns: result.availableWindPatterns,
    linkedWindPatternIds: result.linkedWindPatternIds,
    windPatternCatalogPage: result.windPatternCatalogPage,
  }
}

export async function updateSessionInfoAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const result = await updateSessionInfoMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_info",
      startedAt,
      scope,
      sessionId: result.sessionId ?? submittedSessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
    })

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

  logSessionActionTiming({
    phase: "save_session_info",
    startedAt,
    scope,
    sessionId: result.sessionId,
    status: "success",
    outcome: "saved",
    metadata: {
      standardMoveCount: result.linkedStandardMoveIds.length,
      windPatternCount: result.linkedWindPatternIds.length,
    },
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: result.sessionId,
      status: "info_updated",
      ...result.scope,
    }),
  )
}

export async function updateSessionGoalsAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const logTiming = (
    status: SessionDetailTimingStatus,
    outcome: string,
    error?: string,
  ) => {
    logSessionActionTiming({
      phase: "save_session_goals",
      startedAt,
      scope,
      sessionId,
      status,
      outcome,
      error,
    })
  }

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming("error", "invalid_input")
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
    logTiming("error", "invalid_input")
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
    logTiming("error", "forbidden")
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
    logTiming("error", "forbidden")
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
    logTiming("error", "update_failed", updateError.message)
    redirect(
      buildSessionDetailRedirectPath({
        sessionId: parsedInput.data.sessionId,
        error: "update_failed",
        ...scope,
      }),
    )
  }

  if (shouldNotifyTextAdded(scopedSession.session.goals, normalizedGoals)) {
    const actorName = formatActorName({
      firstName: context.profile?.first_name,
      lastName: context.profile?.last_name,
      email: context.user.email ?? null,
    })
    const sessionLabel = formatSessionLabel({
      sessionDate: scopedSession.session.session_date,
      dockOutAt: scopedSession.session.dock_out_at,
    })

    await createNotificationsForActiveTeamMembers({
      excludeProfileId: context.user.id,
      actorProfileId: context.user.id,
      teamId: scope.scopeTeamId,
      eventType: NOTIFICATION_EVENT_TYPES.SESSION_GOALS_ADDED,
      message: buildSessionUpdateMessage({
        actorName,
        fieldLabel: "Goals",
        sessionLabel,
      }),
      targetHref: buildScopedNotificationHref({
        pathname: `/team-sessions/${parsedInput.data.sessionId}`,
        orgId: scope.scopeOrgId,
        teamId: scope.scopeTeamId,
        tab: "goals",
      }),
      metadata: {
        sessionId: parsedInput.data.sessionId,
        campId: scopedSession.camp.id,
      },
    })
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  logTiming("success", "saved")
  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "goals_updated",
      ...scope,
    }),
  )
}

export async function updateSessionResultsAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const logTiming = (
    status: SessionDetailTimingStatus,
    outcome: string,
    error?: string,
  ) => {
    logSessionActionTiming({
      phase: "save_session_results",
      startedAt,
      scope,
      sessionId,
      status,
      outcome,
      error,
    })
  }

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming("error", "invalid_input")
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
    logTiming("error", "invalid_input")
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
    logTiming("error", "forbidden")
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
    logTiming("error", "forbidden")
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
    logTiming("error", "update_failed", resultError.message)
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

  logTiming("success", "saved")
  redirect(
    buildSessionDetailRedirectPath({
      sessionId: parsedInput.data.sessionId,
      status: "results_updated",
      ...scope,
    }),
  )
}

type SessionSetupActionError = "invalid_input" | "forbidden" | "tws_required" | "update_failed"

export type UpdateSessionSetupActionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: SessionSetupActionError
      message: string
    }

export type TeamSetupMetricActionItem = Pick<
  SessionSetupDialogItem,
  | "id"
  | "key"
  | "label"
  | "inputKind"
  | "metricGroup"
  | "isFixed"
  | "isRequired"
  | "position"
  | "options"
>

export type UpdateTeamSetupMetricActionResult =
  | {
      ok: true
      item: TeamSetupMetricActionItem
    }
  | {
      ok: false
      error: SessionSetupActionError
      message: string
    }

export type DeleteTeamSetupMetricActionResult =
  | {
      ok: true
      itemId: string
    }
  | {
      ok: false
      error: SessionSetupActionError
      message: string
    }

type UpdateSessionSetupMutationResult =
  | {
      ok: true
      sessionId: string
      scope: SessionActionScope
    }
  | {
      ok: false
      error: SessionSetupActionError
      message: string
      sessionId?: string
      scope: SessionActionScope
    }

const SESSION_SETUP_ERROR_MESSAGES: Record<SessionSetupActionError, string> = {
  invalid_input: "The submitted setup data is invalid. Review the form and try again.",
  forbidden: "You do not have permission to manage this session in the active scope.",
  tws_required: "TWS is required. Select at least one TWS option before continuing.",
  update_failed: "Could not update this session setup. Confirm permissions and try again.",
}

function buildSessionSetupActionError(input: {
  error: SessionSetupActionError
  scope: SessionActionScope
  sessionId?: string
}): UpdateSessionSetupMutationResult {
  return {
    ok: false,
    error: input.error,
    message: SESSION_SETUP_ERROR_MESSAGES[input.error],
    scope: input.scope,
    sessionId: input.sessionId,
  }
}

function buildUpdateTeamSetupMetricActionError(
  error: SessionSetupActionError,
): UpdateTeamSetupMetricActionResult {
  return {
    ok: false,
    error,
    message: SESSION_SETUP_ERROR_MESSAGES[error],
  }
}

function buildDeleteTeamSetupMetricActionError(
  error: SessionSetupActionError,
): DeleteTeamSetupMetricActionResult {
  return {
    ok: false,
    error,
    message: SESSION_SETUP_ERROR_MESSAGES[error],
  }
}

async function fetchTeamSetupMetricActionItem(input: {
  itemId: string
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  teamId: string
}): Promise<TeamSetupMetricActionItem | null> {
  const { data: itemRow, error: itemRowError } = await input.supabase
    .from("team_setup_items")
    .select("id,key,label,input_kind,metric_group,is_fixed,is_required,position")
    .eq("id", input.itemId)
    .eq("team_id", input.teamId)
    .eq("is_active", true)
    .maybeSingle()

  if (!itemRow || itemRowError) {
    return null
  }

  const { data: optionRows, error: optionRowsError } = await input.supabase
    .from("team_setup_item_options")
    .select("id,value,label,position")
    .eq("team_setup_item_id", input.itemId)
    .eq("is_active", true)
    .order("position", { ascending: true })

  if (!optionRows || optionRowsError) {
    return null
  }

  return {
    id: itemRow.id,
    key: itemRow.key,
    label: itemRow.label,
    inputKind: itemRow.input_kind,
    metricGroup: itemRow.metric_group,
    isFixed: itemRow.is_fixed,
    isRequired: itemRow.is_required,
    position: itemRow.position,
    options: optionRows.map((optionRow) => ({
      id: optionRow.id,
      value: optionRow.value,
      label: optionRow.label,
    })),
  }
}

async function updateSessionSetupMutation(
  formData: FormData,
): Promise<UpdateSessionSetupMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildSessionSetupActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const parsedInput = updateSessionSetupInputSchema.safeParse({
    sessionId,
    setupPayload: getFormString(formData, "setupPayload"),
    orderedItemIdsPayload: getFormString(formData, "orderedItemIdsPayload"),
  })

  if (!parsedInput.success) {
    return buildSessionSetupActionError({
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
    return buildSessionSetupActionError({
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
    return buildSessionSetupActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const parsedPayload = parseSessionSetupPayload(parsedInput.data.setupPayload)
  const orderedItemIds =
    typeof parsedInput.data.orderedItemIdsPayload === "string"
      ? parseStringArrayPayload(parsedInput.data.orderedItemIdsPayload)
      : undefined

  if (!parsedPayload || orderedItemIds === null) {
    return buildSessionSetupActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const payloadByItemId = new Map<string, SessionSetupPayloadEntry>()
  for (const entry of parsedPayload) {
    payloadByItemId.set(entry.itemId, entry)
  }

  if (payloadByItemId.size !== parsedPayload.length) {
    return buildSessionSetupActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const hasValueChanges = payloadByItemId.size > 0
  const hasOrderChange = typeof orderedItemIds !== "undefined" && orderedItemIds.length > 0

  if (!hasValueChanges && !hasOrderChange) {
    return {
      ok: true,
      sessionId: parsedInput.data.sessionId,
      scope,
    }
  }

  const supabase = await createServerSupabaseClient()
  const itemIdsToDelete: string[] = []
  const setupValuesToSave: SessionSetupAtomicValueInput[] = []
  let hasPayloadTwsValue = false

  if (hasValueChanges) {
    const payloadEntries = Array.from(payloadByItemId.values())
    const payloadItemIds = payloadEntries.map((entry) => entry.itemId)
    const { data: itemRowsData, error: itemsError } = await supabase
      .from("team_setup_items")
      .select("id,key,input_kind,metric_group,is_fixed,is_required")
      .eq("team_id", scope.scopeTeamId)
      .eq("is_active", true)
      .in("id", payloadItemIds)

    if (itemsError || !itemRowsData) {
      return buildSessionSetupActionError({
        error: "update_failed",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    const itemRows = itemRowsData as TeamSetupItemMutationRow[]
    const itemById = new Map(itemRows.map((row) => [row.id, row]))

    if (itemById.size !== payloadItemIds.length) {
      return buildSessionSetupActionError({
        error: "invalid_input",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }

    const optionItemIds = payloadEntries
      .filter((entry) => entry.selectedOptions.length > 0)
      .map((entry) => entry.itemId)
    const validOptionIdsByItemId = new Map<string, Set<string>>()

    if (optionItemIds.length > 0) {
      const { data: optionRows, error: optionsError } = await supabase
        .from("team_setup_item_options")
        .select("id,team_setup_item_id")
        .in("team_setup_item_id", optionItemIds)
        .eq("is_active", true)

      if (optionsError || !optionRows) {
        return buildSessionSetupActionError({
          error: "update_failed",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      for (const optionRow of optionRows) {
        const optionSet =
          validOptionIdsByItemId.get(optionRow.team_setup_item_id) ?? new Set<string>()
        optionSet.add(optionRow.id)
        validOptionIdsByItemId.set(optionRow.team_setup_item_id, optionSet)
      }
    }

    for (const payloadEntry of payloadEntries) {
      const item = itemById.get(payloadEntry.itemId)

      if (!item) {
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      const hasTextValue = Boolean(payloadEntry.textValue)
      const hasSelectedOptions = payloadEntry.selectedOptions.length > 0
      const shouldPersist = hasTextValue || hasSelectedOptions

      if (
        item.key === "tws" &&
        (item.metric_group !== "weather" || item.input_kind !== "multi_select")
      ) {
        return buildSessionSetupActionError({
          error: "tws_required",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (item.input_kind === "text" && hasSelectedOptions) {
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (item.input_kind !== "text" && hasTextValue) {
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      const validOptionIds = validOptionIdsByItemId.get(payloadEntry.itemId) ?? new Set<string>()
      if (
        payloadEntry.selectedOptions.some(
          (selectedOption) => !validOptionIds.has(selectedOption.optionId),
        )
      ) {
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (item.input_kind === "single_select" && payloadEntry.selectedOptions.length > 1) {
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (item.key === "tws" && !shouldPersist) {
        return buildSessionSetupActionError({
          error: "tws_required",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (!shouldPersist) {
        itemIdsToDelete.push(payloadEntry.itemId)
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
        return buildSessionSetupActionError({
          error: "invalid_input",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }

      if (item.key === "tws") {
        if (normalizedSelectedOptions.length === 0) {
          return buildSessionSetupActionError({
            error: "tws_required",
            scope,
            sessionId: parsedInput.data.sessionId,
          })
        }

        hasPayloadTwsValue = true
      }

      setupValuesToSave.push({
        team_setup_item_id: payloadEntry.itemId,
        text_value: item.input_kind === "text" ? payloadEntry.textValue : null,
        selected_options:
          item.input_kind === "text"
            ? []
            : normalizedSelectedOptions.map((selectedOption) => ({
                team_setup_item_option_id: selectedOption.optionId,
                allocation_percent: selectedOption.allocationPercent,
              })),
      })
    }

    if (!hasPayloadTwsValue) {
      const hasSavedTwsSelection = await sessionHasSavedTwsSelection({
        sessionId: parsedInput.data.sessionId,
        supabase,
        teamId: scope.scopeTeamId,
      })

      if (hasSavedTwsSelection !== true) {
        return buildSessionSetupActionError({
          error: hasSavedTwsSelection === null ? "update_failed" : "tws_required",
          scope,
          sessionId: parsedInput.data.sessionId,
        })
      }
    }
  }

  const { error: saveSetupError } = await supabase.rpc("save_session_setup_atomic", {
    p_delete_item_ids: itemIdsToDelete,
    p_ordered_item_ids: hasOrderChange ? orderedItemIds : null,
    p_session_id: parsedInput.data.sessionId,
    p_team_id: scope.scopeTeamId,
    p_values: setupValuesToSave,
  })

  if (saveSetupError) {
    return buildSessionSetupActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  revalidateSessionSetupSlices({
    sessionId: parsedInput.data.sessionId,
  })

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
  }
}

export async function saveSessionSetupAction(
  formData: FormData,
): Promise<UpdateSessionSetupActionResult> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const result = await updateSessionSetupMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_setup",
      startedAt,
      scope,
      sessionId: result.sessionId ?? sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
    })

    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  logSessionActionTiming({
    phase: "save_session_setup",
    startedAt,
    scope,
    sessionId,
    status: "success",
    outcome: "saved",
  })

  return {
    ok: true,
  }
}

export async function updateSessionSetupAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const result = await updateSessionSetupMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_setup",
      startedAt,
      scope,
      sessionId: result.sessionId ?? submittedSessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
    })

    if (!result.sessionId) {
      redirect(
        buildTeamSessionsRedirectPath({
          error: result.error === "tws_required" ? "invalid_input" : result.error,
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

  logSessionActionTiming({
    phase: "save_session_setup",
    startedAt,
    scope,
    sessionId: result.sessionId,
    status: "success",
    outcome: "saved",
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: result.sessionId,
      status: "setup_updated",
      ...result.scope,
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
    metricGroup: getFormString(formData, "metricGroup"),
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
      metric_group: parsedInput.data.metricGroup,
      is_fixed: false,
      is_required: false,
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

export async function updateTeamSetupMetricAction(
  formData: FormData,
): Promise<UpdateTeamSetupMetricActionResult> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const parsedOptions = parseStringArrayPayload(getFormString(formData, "optionsPayload"))

  if (!sessionId || !parsedOptions) {
    return buildUpdateTeamSetupMetricActionError("invalid_input")
  }

  const parsedInput = updateTeamSetupMetricInputSchema.safeParse({
    sessionId,
    itemId: getFormString(formData, "itemId"),
    metricGroup: getFormString(formData, "metricGroup"),
    inputKind: getFormString(formData, "inputKind"),
    label: getFormString(formData, "label"),
    options: parsedOptions,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildUpdateTeamSetupMetricActionError("invalid_input")
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
  })

  if (!scopedSession) {
    return buildUpdateTeamSetupMetricActionError("forbidden")
  }

  const normalizedLabel = normalizeTeamSetupMetricLabel(parsedInput.data.label)
  const normalizedOptions = normalizeTeamSetupMetricOptions(parsedInput.data.options)

  if (parsedInput.data.inputKind === "text" && normalizedOptions.length > 0) {
    return buildUpdateTeamSetupMetricActionError("invalid_input")
  }

  if (parsedInput.data.inputKind !== "text" && normalizedOptions.length === 0) {
    return buildUpdateTeamSetupMetricActionError("invalid_input")
  }

  const supabase = await createServerSupabaseClient()
  const { data: itemRow, error: itemRowError } = await supabase
    .from("team_setup_items")
    .select("id,key,label,metric_group,is_fixed,is_required")
    .eq("id", parsedInput.data.itemId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (itemRowError || !itemRow || itemRow.metric_group !== parsedInput.data.metricGroup) {
    return buildUpdateTeamSetupMetricActionError("forbidden")
  }

  const isRequiredTws = itemRow.is_required && itemRow.key === "tws"

  if (itemRow.is_fixed || (itemRow.is_required && !isRequiredTws)) {
    return buildUpdateTeamSetupMetricActionError("forbidden")
  }

  if (
    isRequiredTws &&
    (parsedInput.data.metricGroup !== "weather" ||
      parsedInput.data.inputKind !== "multi_select" ||
      normalizedLabel !== itemRow.label)
  ) {
    return buildUpdateTeamSetupMetricActionError("forbidden")
  }

  if (!isRequiredTws) {
    const { error: updateItemError } = await supabase
      .from("team_setup_items")
      .update({
        label: normalizedLabel,
        input_kind: parsedInput.data.inputKind,
        metric_group: itemRow.metric_group,
        is_fixed: false,
        is_required: false,
      })
      .eq("id", parsedInput.data.itemId)

    if (updateItemError) {
      return buildUpdateTeamSetupMetricActionError("update_failed")
    }
  }

  const { error: deactivateOptionsError } = await supabase
    .from("team_setup_item_options")
    .update({ is_active: false })
    .eq("team_setup_item_id", parsedInput.data.itemId)

  if (deactivateOptionsError) {
    return buildUpdateTeamSetupMetricActionError("update_failed")
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
        return buildUpdateTeamSetupMetricActionError("update_failed")
      }
    }
  }

  const updatedItem = await fetchTeamSetupMetricActionItem({
    itemId: parsedInput.data.itemId,
    supabase,
    teamId: scope.scopeTeamId,
  })

  if (!updatedItem) {
    return buildUpdateTeamSetupMetricActionError("update_failed")
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    item: updatedItem,
  }
}

export async function deleteTeamSetupMetricAction(
  formData: FormData,
): Promise<DeleteTeamSetupMetricActionResult> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  const parsedInput = deleteTeamSetupMetricInputSchema.safeParse({
    sessionId,
    itemId: getFormString(formData, "itemId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildDeleteTeamSetupMetricActionError("invalid_input")
  }

  const scopedSession = await ensureCanManageScopedSessionSetup({
    scope,
    sessionId: parsedInput.data.sessionId,
  })

  if (!scopedSession) {
    return buildDeleteTeamSetupMetricActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: itemRow, error: itemRowError } = await supabase
    .from("team_setup_items")
    .select("id,metric_group,is_fixed,is_required")
    .eq("id", parsedInput.data.itemId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (itemRowError || !itemRow || itemRow.is_fixed || itemRow.is_required) {
    return buildDeleteTeamSetupMetricActionError("forbidden")
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
    return buildDeleteTeamSetupMetricActionError("update_failed")
  }

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    itemId: parsedInput.data.itemId,
  }
}

export async function reorderTeamSetupMetricsAction(formData: FormData): Promise<void> {
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const orderedItemIds = parseStringArrayPayload(getFormString(formData, "orderedItemIdsPayload"))

  const parsedInput = reorderTeamSetupMetricsInputSchema.safeParse({
    sessionId,
    metricGroup: getFormString(formData, "metricGroup"),
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
  const reorderResult = await persistSetupMetricOrder({
    supabase,
    teamId: scope.scopeTeamId,
    metricGroup: parsedInput.data.metricGroup,
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

type SessionGearActionError = "invalid_input" | "forbidden" | "update_failed"

export type UpdateSessionGearUsageActionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: SessionGearActionError
      message: string
    }

type UpdateSessionGearUsageMutationResult =
  | {
      ok: true
      sessionId: string
      scope: SessionActionScope
    }
  | {
      ok: false
      error: SessionGearActionError
      message: string
      sessionId?: string
      scope: SessionActionScope
    }

const SESSION_GEAR_ERROR_MESSAGES: Record<SessionGearActionError, string> = {
  invalid_input: "The submitted gear selection is invalid. Review the form and try again.",
  forbidden: "You do not have permission to manage gear in the active scope.",
  update_failed: "Could not update session gear. Confirm permissions and try again.",
}

function buildSessionGearUsageActionError(input: {
  error: SessionGearActionError
  scope: SessionActionScope
  sessionId?: string
}): UpdateSessionGearUsageMutationResult {
  return {
    ok: false,
    error: input.error,
    message: SESSION_GEAR_ERROR_MESSAGES[input.error],
    scope: input.scope,
    sessionId: input.sessionId,
  }
}

function isGearAlertNotificationRow(
  row: TeamGearAlertRow,
): row is TeamGearAlertRow & { alert_state: "warning" | "critical" } {
  return row.alert_state === "warning" || row.alert_state === "critical"
}

async function persistGearAlertNotificationsForLinkedGear(input: {
  actorProfileId: string
  gearItemIds: string[]
  orgId: string
  supabase: ServerSupabaseClient
  teamId: string
}): Promise<void> {
  if (input.gearItemIds.length === 0) {
    return
  }

  try {
    const { data, error } = await input.supabase.rpc("get_team_gear_alert_rows", {
      p_gear_item_ids: input.gearItemIds,
      p_team_id: input.teamId,
    })

    if (error) {
      console.warn("Failed to load linked gear alert state", error)
      return
    }

    const gearAlerts = (data ?? [])
      .filter(isGearAlertNotificationRow)
      .map((row) => ({
        alertState: row.alert_state,
        gearItemId: row.gear_item_id,
        gearName: row.name,
        triggeredAlertCount: Number(row.triggered_alert_count),
        usageCount: Number(row.usage_count),
        usageMinutes: Number(row.usage_minutes),
      }))

    await createGearAlertNotificationsForActiveTeamMembers({
      actorProfileId: input.actorProfileId,
      gearAlerts,
      orgId: input.orgId,
      teamId: input.teamId,
    })
  } catch (error) {
    console.warn("Failed to persist linked gear alert notifications", error)
  }
}

async function updateSessionGearUsageMutation(
  formData: FormData,
): Promise<UpdateSessionGearUsageMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const uniqueGearItemIds = [...new Set(getFormStringArray(formData, "gearItemIds"))]

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildSessionGearUsageActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const parsedInput = updateSessionGearUsageInputSchema.safeParse({
    sessionId,
    gearItemIds: uniqueGearItemIds,
  })

  if (!parsedInput.success) {
    return buildSessionGearUsageActionError({
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
    return buildSessionGearUsageActionError({
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
    return buildSessionGearUsageActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const supabase = await createServerSupabaseClient()

  if (parsedInput.data.gearItemIds.length > 0) {
    const { data: scopedGearRows, error: scopedGearError } = await supabase
      .from("gear_items")
      .select("id")
      .eq("team_id", scope.scopeTeamId)
      .in("id", parsedInput.data.gearItemIds)

    if (scopedGearError) {
      return buildSessionGearUsageActionError({
        error: "update_failed",
        scope,
        sessionId,
      })
    }

    if (!scopedGearRows || scopedGearRows.length !== parsedInput.data.gearItemIds.length) {
      return buildSessionGearUsageActionError({
        error: "invalid_input",
        scope,
        sessionId: parsedInput.data.sessionId,
      })
    }
  }

  const { error: updateGearUsageError } = await supabase.rpc("replace_session_gear_usage_atomic", {
    p_gear_item_ids: parsedInput.data.gearItemIds,
    p_linked_by_profile_id: context.profile?.id ?? null,
    p_session_id: parsedInput.data.sessionId,
    p_team_id: scope.scopeTeamId,
  })

  if (updateGearUsageError) {
    return buildSessionGearUsageActionError({
      error: "update_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  await persistGearAlertNotificationsForLinkedGear({
    actorProfileId: context.user.id,
    gearItemIds: parsedInput.data.gearItemIds,
    orgId: scope.scopeOrgId,
    supabase,
    teamId: scope.scopeTeamId,
  })

  revalidateSessionSlices({
    sessionId: parsedInput.data.sessionId,
    campId: scopedSession.camp.id,
    teamVenueId: scopedSession.teamVenue.id,
  })

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
  }
}

export async function saveSessionGearUsageAction(
  formData: FormData,
): Promise<UpdateSessionGearUsageActionResult> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const uniqueGearItemIds = [...new Set(getFormStringArray(formData, "gearItemIds"))]
  const result = await updateSessionGearUsageMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_gear",
      startedAt,
      scope,
      sessionId: result.sessionId ?? sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
      metadata: {
        gearItemCount: uniqueGearItemIds.length,
      },
    })

    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  logSessionActionTiming({
    phase: "save_session_gear",
    startedAt,
    scope,
    sessionId: result.sessionId,
    status: "success",
    outcome: "saved",
    metadata: {
      gearItemCount: uniqueGearItemIds.length,
    },
  })

  return {
    ok: true,
  }
}

export async function updateSessionGearUsageAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const uniqueGearItemIds = [...new Set(getFormStringArray(formData, "gearItemIds"))]
  const result = await updateSessionGearUsageMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "save_session_gear",
      startedAt,
      scope,
      sessionId: result.sessionId ?? submittedSessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
      metadata: {
        gearItemCount: uniqueGearItemIds.length,
      },
    })

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

  logSessionActionTiming({
    phase: "save_session_gear",
    startedAt,
    scope,
    sessionId: result.sessionId,
    status: "success",
    outcome: "saved",
    metadata: {
      gearItemCount: uniqueGearItemIds.length,
    },
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: result.sessionId,
      status: "gear_updated",
      ...result.scope,
    }),
  )
}

type UploadSessionAssetActionError =
  | "invalid_input"
  | "forbidden"
  | "plan_limit_reached"
  | "payment_required"
  | "upload_failed"
type DeleteSessionAssetActionError = "invalid_input" | "forbidden" | "delete_failed"
type SessionVakarosTrimActionError =
  | "invalid_input"
  | "forbidden"
  | "save_failed"
  | "delete_failed"
type SessionVakarosTrimActionFailure = {
  ok: false
  error: SessionVakarosTrimActionError
  message: string
}

export type UploadSessionAssetActionResult =
  | {
      ok: true
      status: "asset_uploaded"
      tab: "images" | "analytics"
    }
  | {
      ok: false
      error: UploadSessionAssetActionError
      message: string
    }

export type DeleteSessionAssetActionResult =
  | {
      ok: true
      status: "asset_deleted"
      tab: "images" | "analytics"
    }
  | {
      ok: false
      error: DeleteSessionAssetActionError
      message: string
    }

export type SaveSessionVakarosTrimActionResult =
  | {
      ok: true
      savedTrim: SessionDetailVakarosSavedTrim
      status: "vakaros_trim_saved"
    }
  | SessionVakarosTrimActionFailure

export type DeleteSessionVakarosTrimActionResult =
  | {
      ok: true
      savedTrimId: string
      status: "vakaros_trim_deleted"
    }
  | SessionVakarosTrimActionFailure

type UploadSessionAssetMutationResult =
  | {
      ok: true
      sessionId: string
      scope: SessionActionScope
      status: "asset_uploaded"
      tab: "images" | "analytics"
    }
  | {
      ok: false
      error: UploadSessionAssetActionError
      message: string
      sessionId?: string
      scope: SessionActionScope
    }

const SESSION_ASSET_UPLOAD_ERROR_MESSAGES: Record<UploadSessionAssetActionError, string> = {
  invalid_input: "The selected file is invalid. Review the file and try again.",
  forbidden: "You do not have permission to upload files in the active scope.",
  plan_limit_reached: "This is a Pro feature. Upgrade to Pro to continue uploading files.",
  payment_required:
    "Your paid plan is inactive. Recover payment in Subscription to continue uploading files.",
  upload_failed: "Could not upload this file. Confirm storage is available and try again.",
}

const SESSION_ASSET_DELETE_ERROR_MESSAGES: Record<DeleteSessionAssetActionError, string> = {
  invalid_input: "Could not find this file. Refresh and try again.",
  forbidden: "You do not have permission to delete files in the active scope.",
  delete_failed: "Could not delete this file. Confirm storage is available and try again.",
}

const SESSION_VAKAROS_TRIM_ERROR_MESSAGES: Record<SessionVakarosTrimActionError, string> = {
  invalid_input: "The saved trim is invalid. Review the trim range and buoys, then try again.",
  forbidden: "You do not have permission to manage saved trims in the active scope.",
  save_failed: "Could not save this trim. Refresh and try again.",
  delete_failed: "Could not delete this trim. Refresh and try again.",
}

function buildUploadSessionAssetActionError(input: {
  error: UploadSessionAssetActionError
  scope: SessionActionScope
  sessionId?: string
}): UploadSessionAssetMutationResult {
  return {
    ok: false,
    error: input.error,
    message: SESSION_ASSET_UPLOAD_ERROR_MESSAGES[input.error],
    sessionId: input.sessionId,
    scope: input.scope,
  }
}

function buildDeleteSessionAssetActionError(
  error: DeleteSessionAssetActionError,
): DeleteSessionAssetActionResult {
  return {
    ok: false,
    error,
    message: SESSION_ASSET_DELETE_ERROR_MESSAGES[error],
  }
}

function buildSessionVakarosTrimActionError(
  error: SessionVakarosTrimActionError,
): SessionVakarosTrimActionFailure {
  return {
    ok: false,
    error,
    message: SESSION_VAKAROS_TRIM_ERROR_MESSAGES[error],
  }
}

async function uploadSessionAssetMutation(
  formData: FormData,
): Promise<UploadSessionAssetMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const parsedInput = uploadSessionAssetInputSchema.safeParse({
    sessionId,
    assetType: getFormString(formData, "assetType"),
    description: getFormString(formData, "description"),
  })

  const assetFile = getFormFile(formData, "assetFile")
  const thumbnailFile =
    parsedInput.success && parsedInput.data.assetType === "photo"
      ? getFormFile(formData, "thumbnailFile")
      : undefined

  if (!parsedInput.success || !assetFile) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    return buildUploadSessionAssetActionError({
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
    return buildUploadSessionAssetActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const uploadEntitlement = await resolveOrganizationSessionAssetUploadEntitlement({
    organizationId: scope.scopeOrgId,
  })

  if (!uploadEntitlement.allowed) {
    return buildUploadSessionAssetActionError({
      error: uploadEntitlement.reason ?? "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const maxFileSize =
    parsedInput.data.assetType === "photo" ? MAX_PHOTO_ASSET_BYTES : MAX_ASSET_BYTES
  const hasValidPhotoMimeType =
    parsedInput.data.assetType !== "photo" || assetFile.type === COMPRESSED_PHOTO_MIME_TYPE
  const hasValidAnalyticsFile =
    parsedInput.data.assetType !== "analytics_file" ||
    (assetFile.type === ANALYTICS_FILE_MIME_TYPE && hasPdfFileName(assetFile.name))

  if (
    assetFile.size <= 0 ||
    assetFile.size > maxFileSize ||
    !hasValidPhotoMimeType ||
    !hasValidAnalyticsFile ||
    (thumbnailFile !== undefined &&
      (thumbnailFile.size <= 0 ||
        thumbnailFile.size > MAX_PHOTO_THUMBNAIL_BYTES ||
        thumbnailFile.type !== COMPRESSED_PHOTO_MIME_TYPE))
  ) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  let fileBytes: Uint8Array
  let thumbnailFileBytes: Uint8Array | null = null

  try {
    fileBytes = new Uint8Array(await assetFile.arrayBuffer())
    thumbnailFileBytes = thumbnailFile
      ? new Uint8Array(await thumbnailFile.arrayBuffer())
      : null
  } catch {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  if (
    !hasValidSessionAssetFileSignature({
      assetType: parsedInput.data.assetType,
      fileBytes,
    }) ||
    (thumbnailFileBytes !== null &&
      !hasValidSessionAssetFileSignature({
        assetType: "photo",
        fileBytes: thumbnailFileBytes,
      }))
  ) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const storageBucket = getAssetBucket(parsedInput.data.assetType)
  const storagePath = buildAssetStoragePath({
    sessionId: parsedInput.data.sessionId,
    assetType: parsedInput.data.assetType,
    fileName: assetFile.name,
  })
  const thumbnailStoragePath =
    thumbnailFile && thumbnailFileBytes ? buildAssetThumbnailStoragePath(storagePath) : null

  let uploadFailed = false
  const uploadedStoragePaths: string[] = []
  const storageAdmin = createAdminSupabaseClient()

  try {
    const { error: storageError } = await storageAdmin.storage
      .from(storageBucket)
      .upload(storagePath, fileBytes, {
        contentType: assetFile.type || undefined,
        upsert: false,
      })

    if (storageError) {
      throw storageError
    }

    uploadedStoragePaths.push(storagePath)

    if (thumbnailFile && thumbnailFileBytes && thumbnailStoragePath) {
      const { error: thumbnailStorageError } = await storageAdmin.storage
        .from(storageBucket)
        .upload(thumbnailStoragePath, thumbnailFileBytes, {
          contentType: thumbnailFile.type || undefined,
          upsert: false,
        })

      if (thumbnailStorageError) {
        throw thumbnailStorageError
      }

      uploadedStoragePaths.push(thumbnailStoragePath)
    }
  } catch {
    uploadFailed = true
  }

  if (uploadFailed) {
    if (uploadedStoragePaths.length > 0) {
      try {
        await storageAdmin.storage.from(storageBucket).remove(uploadedStoragePaths)
      } catch {
        // Best effort cleanup only.
      }
    }

    return buildUploadSessionAssetActionError({
      error: "upload_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const supabase = await createServerSupabaseClient()
  const { error: insertError } = await supabase.from("session_assets").insert({
    session_id: parsedInput.data.sessionId,
    asset_type: parsedInput.data.assetType,
    bucket: storageBucket,
    storage_path: storagePath,
    file_name: assetFile.name,
    description: normalizedDescription,
    mime_type: assetFile.type || null,
    size_bytes: assetFile.size,
    thumbnail_bucket: thumbnailStoragePath ? storageBucket : null,
    thumbnail_storage_path: thumbnailStoragePath,
    thumbnail_mime_type: thumbnailFile?.type ?? null,
    thumbnail_size_bytes: thumbnailFile?.size ?? null,
    uploaded_by_profile_id: context.profile?.id ?? null,
  })

  if (insertError) {
    try {
      await storageAdmin.storage.from(storageBucket).remove(uploadedStoragePaths)
    } catch {
      // Best effort cleanup only.
    }

    return buildUploadSessionAssetActionError({
      error: "upload_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
    status: "asset_uploaded",
    tab: parsedInput.data.assetType === "photo" ? "images" : "analytics",
  }
}

async function uploadSessionGpsFileMutation(
  formData: FormData,
): Promise<UploadSessionAssetMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")

  if (!sessionId || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const parsedInput = uploadSessionGpsFileInputSchema.safeParse({
    sessionId,
    description: getFormString(formData, "description"),
  })
  const gpsFile = getFormFile(formData, "gpsFile")

  if (!parsedInput.success || !gpsFile) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId,
    })
  }

  const normalizedDescription = normalizeOptionalText(parsedInput.data.description)

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    return buildUploadSessionAssetActionError({
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
    return buildUploadSessionAssetActionError({
      error: "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const uploadEntitlement = await resolveOrganizationSessionAssetUploadEntitlement({
    organizationId: scope.scopeOrgId,
  })

  if (!uploadEntitlement.allowed) {
    return buildUploadSessionAssetActionError({
      error: uploadEntitlement.reason ?? "forbidden",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const hasValidFileName = assertValidVakarosCsvFileName(gpsFile.name)
  const hasValidMimeType =
    gpsFile.type.length === 0 ||
    gpsFile.type === GPS_FILE_MIME_TYPE ||
    gpsFile.type === "application/vnd.ms-excel" ||
    gpsFile.type === "text/plain"

  if (
    gpsFile.size <= 0 ||
    gpsFile.size > MAX_ASSET_BYTES ||
    !hasValidFileName ||
    !hasValidMimeType
  ) {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  let fileText: string

  try {
    fileText = await gpsFile.text()
  } catch {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  let parsedVakaros: ReturnType<typeof parseVakarosCsv>

  try {
    parsedVakaros = parseVakarosCsv(fileText)
  } catch {
    return buildUploadSessionAssetActionError({
      error: "invalid_input",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const artifactPaths = buildGpsFileArtifactStoragePaths({
    basePath: buildGpsFileStorageBasePath({
      sessionId: parsedInput.data.sessionId,
      fileName: gpsFile.name,
    }),
  })
  const textEncoder = new TextEncoder()
  const series1HzFileBytes = textEncoder.encode(parsedVakaros.series1HzCsv)
  const trackGeojsonFileBytes = textEncoder.encode(parsedVakaros.trackGeojson)
  const summaryFileBytes = textEncoder.encode(parsedVakaros.summaryCsv)
  const storageUploads = [
    {
      contentType: GPS_FILE_MIME_TYPE,
      data: series1HzFileBytes,
      path: artifactPaths.series1HzStoragePath,
    },
    {
      contentType: "application/geo+json",
      data: trackGeojsonFileBytes,
      path: artifactPaths.trackGeojsonStoragePath,
    },
    {
      contentType: GPS_FILE_MIME_TYPE,
      data: summaryFileBytes,
      path: artifactPaths.summaryStoragePath,
    },
  ]
  const storageAdmin = createAdminSupabaseClient()
  const uploadedStoragePaths: string[] = []

  try {
    for (const upload of storageUploads) {
      const { error: storageError } = await storageAdmin.storage
        .from(SESSION_GPS_FILES_BUCKET)
        .upload(upload.path, upload.data, {
          contentType: upload.contentType,
          upsert: false,
        })

      if (storageError) {
        throw storageError
      }

      uploadedStoragePaths.push(upload.path)
    }
  } catch {
    if (uploadedStoragePaths.length > 0) {
      try {
        await storageAdmin.storage
          .from(SESSION_GPS_FILES_BUCKET)
          .remove(uploadedStoragePaths)
      } catch {
        // Best effort cleanup only.
      }
    }

    return buildUploadSessionAssetActionError({
      error: "upload_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const supabase = await createServerSupabaseClient()
  const { data: assetRow, error: insertAssetError } = await supabase
    .from("session_assets")
    .insert({
      session_id: parsedInput.data.sessionId,
      asset_type: "gps_file",
      bucket: SESSION_GPS_FILES_BUCKET,
      storage_path: artifactPaths.series1HzStoragePath,
      file_name: gpsFile.name,
      description: normalizedDescription,
      mime_type: GPS_FILE_MIME_TYPE,
      size_bytes: series1HzFileBytes.byteLength,
      uploaded_by_profile_id: context.profile?.id ?? null,
    })
    .select("id")
    .single()

  if (insertAssetError || !assetRow) {
    try {
      await storageAdmin.storage.from(SESSION_GPS_FILES_BUCKET).remove(uploadedStoragePaths)
    } catch {
      // Best effort cleanup only.
    }

    return buildUploadSessionAssetActionError({
      error: "upload_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  const { error: insertVakarosError } = await supabase
    .from("session_vakaros_uploads")
    .insert({
      session_id: parsedInput.data.sessionId,
      asset_id: assetRow.id,
      bucket: SESSION_GPS_FILES_BUCKET,
      raw_storage_path: null,
      series_1hz_storage_path: artifactPaths.series1HzStoragePath,
      track_geojson_storage_path: artifactPaths.trackGeojsonStoragePath,
      summary_storage_path: artifactPaths.summaryStoragePath,
      rows_raw: parsedVakaros.metadata.rowsRaw,
      rows_1hz: parsedVakaros.metadata.rows1Hz,
      start_at: parsedVakaros.metadata.startAt,
      end_at: parsedVakaros.metadata.endAt,
      duration_hours: parsedVakaros.metadata.durationHours,
      distance_nm: parsedVakaros.metadata.distanceNm,
      avg_sog_kts: parsedVakaros.metadata.avgSogKts,
      p95_sog_kts: parsedVakaros.metadata.p95SogKts,
      max_sog_kts: parsedVakaros.metadata.maxSogKts,
      uploaded_by_profile_id: context.profile?.id ?? null,
    })

  if (insertVakarosError) {
    try {
      await supabase.from("session_assets").delete().eq("id", assetRow.id)
      await storageAdmin.storage.from(SESSION_GPS_FILES_BUCKET).remove(uploadedStoragePaths)
    } catch {
      // Best effort cleanup only.
    }

    return buildUploadSessionAssetActionError({
      error: "upload_failed",
      scope,
      sessionId: parsedInput.data.sessionId,
    })
  }

  return {
    ok: true,
    sessionId: parsedInput.data.sessionId,
    scope,
    status: "asset_uploaded",
    tab: "analytics",
  }
}

export async function saveSessionAssetAction(
  formData: FormData,
): Promise<UploadSessionAssetActionResult> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const assetType = getFormString(formData, "assetType")
  const result = await uploadSessionAssetMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "upload_session_asset",
      startedAt,
      scope,
      sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
      metadata: {
        assetType: assetType ?? null,
      },
    })

    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  logSessionActionTiming({
    phase: "upload_session_asset",
    startedAt,
    scope,
    sessionId,
    status: "success",
    outcome: result.status,
    metadata: {
      assetType: assetType ?? null,
      tab: result.tab,
    },
  })

  return {
    ok: true,
    status: result.status,
    tab: result.tab,
  }
}

export async function saveSessionGpsFileAction(
  formData: FormData,
): Promise<UploadSessionAssetActionResult> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const result = await uploadSessionGpsFileMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "upload_session_gps_file",
      startedAt,
      scope,
      sessionId: result.sessionId ?? sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
      metadata: {
        assetType: "gps_file",
      },
    })

    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  logSessionActionTiming({
    phase: "upload_session_gps_file",
    startedAt,
    scope,
    sessionId,
    status: "success",
    outcome: result.status,
    metadata: {
      assetType: "gps_file",
      tab: result.tab,
    },
  })

  return {
    ok: true,
    status: result.status,
    tab: result.tab,
  }
}

export async function saveSessionVakarosTrimAction(
  formData: FormData,
): Promise<SaveSessionVakarosTrimActionResult> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const submittedUploadId = getFormString(formData, "uploadId")
  const logTiming = (input: {
    error?: string
    outcome: string
    savedTrimId?: string | null
    sessionId?: string | null
    status: SessionDetailTimingStatus
  }) => {
    logSessionActionTiming({
      phase: "save_session_vakaros_trim",
      startedAt,
      scope,
      sessionId: input.sessionId ?? submittedSessionId,
      status: input.status,
      outcome: input.outcome,
      error: input.error,
      metadata: {
        uploadId: submittedUploadId ?? null,
        savedTrimId: input.savedTrimId ?? null,
      },
    })
  }
  const parsedInput = saveSessionVakarosTrimInputSchema.safeParse({
    sessionId: submittedSessionId,
    uploadId: submittedUploadId,
    name: getFormString(formData, "name"),
    trimStartIndex: getFormString(formData, "trimStartIndex"),
    trimEndIndex: getFormString(formData, "trimEndIndex"),
    buoysPayload: getFormString(formData, "buoysPayload"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming({
      outcome: "invalid_input",
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("forbidden")
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: uploadRow, error: uploadError } = await supabase
    .from("session_vakaros_uploads")
    .select("id,session_id,rows_1hz")
    .eq("id", parsedInput.data.uploadId)
    .eq("session_id", parsedInput.data.sessionId)
    .maybeSingle()

  if (uploadError) {
    logTiming({
      outcome: "upload_query_error",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: uploadError.message,
    })
    return buildSessionVakarosTrimActionError("save_failed")
  }

  if (!uploadRow || uploadRow.rows_1hz <= 0) {
    logTiming({
      outcome: "invalid_upload",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  const { count: savedTrimCount, error: countError } = await supabase
    .from("session_vakaros_saved_trims")
    .select("id", { count: "exact", head: true })
    .eq("upload_id", uploadRow.id)

  if (countError) {
    logTiming({
      outcome: "saved_trim_count_error",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: countError.message,
    })
    return buildSessionVakarosTrimActionError("save_failed")
  }

  const normalizedInput = normalizeVakarosSavedTrimInput({
    sessionId: parsedInput.data.sessionId,
    uploadId: parsedInput.data.uploadId,
    name: parsedInput.data.name,
    fallbackName: `Trim ${(savedTrimCount ?? 0) + 1}`,
    maxIndex: uploadRow.rows_1hz - 1,
    trimStartIndex: parsedInput.data.trimStartIndex,
    trimEndIndex: parsedInput.data.trimEndIndex,
    buoysPayload: parsedInput.data.buoysPayload,
  })

  if (!normalizedInput) {
    logTiming({
      outcome: "invalid_payload",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  const { data: savedTrimRow, error: insertError } = await supabase
    .from("session_vakaros_saved_trims")
    .insert({
      upload_id: uploadRow.id,
      name: normalizedInput.name,
      trim_start_index: normalizedInput.trimStartIndex,
      trim_end_index: normalizedInput.trimEndIndex,
      buoys: normalizedInput.buoys as Json,
      created_by_profile_id: context.profile?.id ?? null,
    })
    .select("id,name,trim_start_index,trim_end_index,created_at")
    .single()

  if (insertError || !savedTrimRow) {
    logTiming({
      outcome: "insert_failed",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: insertError?.message,
    })
    return buildSessionVakarosTrimActionError("save_failed")
  }

  logTiming({
    outcome: "saved",
    savedTrimId: savedTrimRow.id,
    sessionId: parsedInput.data.sessionId,
    status: "success",
  })

  return {
    ok: true,
    status: "vakaros_trim_saved",
    savedTrim: {
      id: savedTrimRow.id,
      buoys: normalizedInput.buoys,
      createdAt: savedTrimRow.created_at,
      name: savedTrimRow.name,
      trimEnd: savedTrimRow.trim_end_index,
      trimStart: savedTrimRow.trim_start_index,
    },
  }
}

export async function deleteSessionVakarosTrimAction(
  formData: FormData,
): Promise<DeleteSessionVakarosTrimActionResult> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const submittedUploadId = getFormString(formData, "uploadId")
  const submittedSavedTrimId = getFormString(formData, "savedTrimId")
  const logTiming = (input: {
    error?: string
    outcome: string
    sessionId?: string | null
    status: SessionDetailTimingStatus
  }) => {
    logSessionActionTiming({
      phase: "delete_session_vakaros_trim",
      startedAt,
      scope,
      sessionId: input.sessionId ?? submittedSessionId,
      status: input.status,
      outcome: input.outcome,
      error: input.error,
      metadata: {
        uploadId: submittedUploadId ?? null,
        savedTrimId: submittedSavedTrimId ?? null,
      },
    })
  }
  const parsedInput = deleteSessionVakarosTrimInputSchema.safeParse({
    sessionId: submittedSessionId,
    uploadId: submittedUploadId,
    savedTrimId: submittedSavedTrimId,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming({
      outcome: "invalid_input",
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("forbidden")
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: uploadRow, error: uploadError } = await supabase
    .from("session_vakaros_uploads")
    .select("id,session_id")
    .eq("id", parsedInput.data.uploadId)
    .eq("session_id", parsedInput.data.sessionId)
    .maybeSingle()

  if (uploadError) {
    logTiming({
      outcome: "upload_query_error",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: uploadError.message,
    })
    return buildSessionVakarosTrimActionError("delete_failed")
  }

  if (!uploadRow) {
    logTiming({
      outcome: "invalid_upload",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  const { data: deletedRow, error: deleteError } = await supabase
    .from("session_vakaros_saved_trims")
    .delete()
    .eq("id", parsedInput.data.savedTrimId)
    .eq("upload_id", uploadRow.id)
    .select("id")
    .maybeSingle()

  if (deleteError) {
    logTiming({
      outcome: "delete_failed",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: deleteError.message,
    })
    return buildSessionVakarosTrimActionError("delete_failed")
  }

  if (!deletedRow) {
    logTiming({
      outcome: "saved_trim_not_found",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildSessionVakarosTrimActionError("invalid_input")
  }

  logTiming({
    outcome: "deleted",
    sessionId: parsedInput.data.sessionId,
    status: "success",
  })

  return {
    ok: true,
    savedTrimId: deletedRow.id,
    status: "vakaros_trim_deleted",
  }
}

export async function deleteSessionAssetAction(
  formData: FormData,
): Promise<DeleteSessionAssetActionResult> {
  const startedAt = startSessionDetailTiming()
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const submittedSessionId = getFormString(formData, "sessionId")
  const submittedAssetId = getFormString(formData, "assetId")
  const logTiming = (input: {
    assetType?: string | null
    error?: string
    outcome: string
    sessionId?: string | null
    status: SessionDetailTimingStatus
  }) => {
    logSessionActionTiming({
      phase: "delete_session_asset",
      startedAt,
      scope,
      sessionId: input.sessionId ?? submittedSessionId,
      status: input.status,
      outcome: input.outcome,
      error: input.error,
      metadata: {
        assetId: submittedAssetId ?? null,
        assetType: input.assetType ?? null,
      },
    })
  }
  const parsedInput = deleteSessionAssetInputSchema.safeParse({
    sessionId: submittedSessionId,
    assetId: submittedAssetId,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    logTiming({
      outcome: "invalid_input",
      status: "error",
    })
    return buildDeleteSessionAssetActionError("invalid_input")
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildDeleteSessionAssetActionError("forbidden")
  }

  const scopedSession = await resolveScopedSessionContext({
    sessionId: parsedInput.data.sessionId,
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedSession) {
    logTiming({
      outcome: "forbidden",
      sessionId: parsedInput.data.sessionId,
      status: "error",
    })
    return buildDeleteSessionAssetActionError("forbidden")
  }

  const supabase = await createServerSupabaseClient()
  const { data: assetRow, error: assetError } = await supabase
    .from("session_assets")
    .select("id, asset_type, bucket, storage_path, thumbnail_bucket, thumbnail_storage_path")
    .eq("id", parsedInput.data.assetId)
    .eq("session_id", parsedInput.data.sessionId)
    .maybeSingle()

  if (assetError || !assetRow) {
    logTiming({
      outcome: assetError ? "asset_query_error" : "asset_not_found",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: assetError?.message,
    })
    return buildDeleteSessionAssetActionError("invalid_input")
  }

  let gpsStoragePaths: string[] = []

  if (assetRow.asset_type === "gps_file") {
    const { data: gpsRow, error: gpsError } = await supabase
      .from("session_vakaros_uploads")
      .select(
        "raw_storage_path,series_1hz_storage_path,track_geojson_storage_path,summary_storage_path",
      )
      .eq("asset_id", assetRow.id)
      .maybeSingle()

    if (gpsError) {
      logTiming({
        assetType: assetRow.asset_type,
        outcome: "gps_metadata_query_error",
        sessionId: parsedInput.data.sessionId,
        status: "error",
        error: gpsError.message,
      })
      return buildDeleteSessionAssetActionError("delete_failed")
    }

    if (gpsRow) {
      gpsStoragePaths = [
        gpsRow.raw_storage_path,
        gpsRow.series_1hz_storage_path,
        gpsRow.track_geojson_storage_path,
        gpsRow.summary_storage_path,
      ].filter((storagePath): storagePath is string => Boolean(storagePath))
    }
  }

  const { error: deleteError } = await supabase
    .from("session_assets")
    .delete()
    .eq("id", assetRow.id)
    .eq("session_id", parsedInput.data.sessionId)

  if (deleteError) {
    logTiming({
      assetType: assetRow.asset_type,
      outcome: "delete_failed",
      sessionId: parsedInput.data.sessionId,
      status: "error",
      error: deleteError.message,
    })
    return buildDeleteSessionAssetActionError("delete_failed")
  }

  try {
    const storageAdmin = createAdminSupabaseClient()
    const storagePaths =
      assetRow.asset_type === "gps_file"
        ? [...new Set([assetRow.storage_path, ...gpsStoragePaths])]
        : [assetRow.storage_path]

    await storageAdmin.storage.from(assetRow.bucket).remove(storagePaths)

    if (assetRow.thumbnail_bucket && assetRow.thumbnail_storage_path) {
      await storageAdmin.storage
        .from(assetRow.thumbnail_bucket)
        .remove([assetRow.thumbnail_storage_path])
    }
  } catch {
    // The asset row is already deleted; storage cleanup is best-effort.
  }

  logTiming({
    assetType: assetRow.asset_type,
    outcome: "deleted",
    sessionId: parsedInput.data.sessionId,
    status: "success",
  })

  return {
    ok: true,
    status: "asset_deleted",
    tab: assetRow.asset_type === "photo" ? "images" : "analytics",
  }
}

export async function uploadSessionAssetAction(formData: FormData): Promise<void> {
  const startedAt = startSessionDetailTiming()
  const scope = getScopeFromFormData(formData)
  const sessionId = getFormString(formData, "sessionId")
  const assetType = getFormString(formData, "assetType")
  const result = await uploadSessionAssetMutation(formData)

  if (!result.ok) {
    logSessionActionTiming({
      phase: "upload_session_asset",
      startedAt,
      scope,
      sessionId: result.sessionId ?? sessionId,
      status: "error",
      outcome: result.error,
      error: result.message,
      metadata: {
        assetType: assetType ?? null,
      },
    })

    if (!result.sessionId) {
      const teamSessionsError =
        result.error === "upload_failed" ? "update_failed" : result.error

      redirect(
        buildTeamSessionsRedirectPath({
          error: teamSessionsError,
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

  logSessionActionTiming({
    phase: "upload_session_asset",
    startedAt,
    scope,
    sessionId: result.sessionId,
    status: "success",
    outcome: result.status,
    metadata: {
      assetType: assetType ?? null,
      tab: result.tab,
    },
  })

  redirect(
    buildSessionDetailRedirectPath({
      sessionId: result.sessionId,
      scopeOrgId: result.scope.scopeOrgId,
      scopeTeamId: result.scope.scopeTeamId,
      scopeTab: result.tab,
      status: result.status,
    }),
  )
}
