import "server-only"

import serverlessChromium from "@sparticuz/chromium"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { chromium as playwrightChromium } from "playwright"
import { chromium as playwrightCoreChromium } from "playwright-core"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamVenueReportRow = Pick<
  Database["public"]["Tables"]["team_venue_reports"]["Row"],
  "id" | "team_venue_id" | "year" | "name"
>

type TeamVenueReportCampRow = Pick<
  Database["public"]["Tables"]["team_venue_report_camps"]["Row"],
  "report_id" | "camp_id"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "start_date" | "end_date" | "notes"
>

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name"
>

type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "camp_id" | "session_date" | "net_time_minutes" | "created_at"
>

type SessionReviewRow = Pick<
  Database["public"]["Tables"]["session_reviews"]["Row"],
  "session_id" | "best_of_session" | "to_work"
>

type SessionSetupRow = Pick<
  Database["public"]["Tables"]["session_setups"]["Row"],
  "session_id" | "free_notes"
>

type TeamSetupItemRow = Pick<
  Database["public"]["Tables"]["team_setup_items"]["Row"],
  "id" | "key"
>

type TeamSetupOptionRow = Pick<
  Database["public"]["Tables"]["team_setup_item_options"]["Row"],
  "id" | "team_setup_item_id" | "label" | "position"
>

type SessionSetupValueRow = Pick<
  Database["public"]["Tables"]["session_setup_item_values"]["Row"],
  "id" | "session_id" | "team_setup_item_id"
>

type SessionSetupSelectedOptionRow = Pick<
  Database["public"]["Tables"]["session_setup_item_selected_options"]["Row"],
  "session_setup_item_value_id" | "team_setup_item_option_id"
>

type TeamMembershipRow = Pick<
  Database["public"]["Tables"]["team_memberships"]["Row"],
  "profile_id" | "role"
>

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "email"
>

type ReportPdfResult = {
  fileName: string
  pdfBytes: Uint8Array
}

type SessionConditionPayload = {
  bands: string[]
  seaState: string
  twd: string
  best: string
  toWork: string
  freeNotes: string
}

type ConditionAggregatePayload = {
  seaState: string[]
  twd: string[]
  best: string[]
  toWork: string[]
  freeNotes: string[]
}

type TemplatePayload = Record<string, string>

const PLACEHOLDER_RE = /{{\s*([^}]+?)\s*}}/g
const CONDITION_FIELDS = ["Sea State", "TWD", "Best", "To Work", "Free Notes"] as const
const CONDITION_BANDS = ["ST 0-4", "DT 5-8", "FP 9-11", "DP 12-18", "OP 19-23", "S 24+"] as const

const TEAM_VENUE_REPORT_SELECT_COLUMNS = "id,team_venue_id,year,name"
const TEAM_VENUE_REPORT_CAMPS_SELECT_COLUMNS = "report_id,camp_id"
const CAMP_SELECT_COLUMNS = "id,team_venue_id,name,start_date,end_date,notes"
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name"
const SESSION_SELECT_COLUMNS = "id,camp_id,session_date,net_time_minutes,created_at"
const SESSION_REVIEW_SELECT_COLUMNS = "session_id,best_of_session,to_work"
const SESSION_SETUP_SELECT_COLUMNS = "session_id,free_notes"
const TEAM_SETUP_ITEMS_SELECT_COLUMNS = "id,key"
const TEAM_SETUP_OPTIONS_SELECT_COLUMNS = "id,team_setup_item_id,label,position"
const SESSION_SETUP_VALUES_SELECT_COLUMNS = "id,session_id,team_setup_item_id"
const SESSION_SETUP_SELECTED_OPTIONS_SELECT_COLUMNS =
  "session_setup_item_value_id,team_setup_item_option_id"
const TEAM_MEMBERSHIP_SELECT_COLUMNS = "profile_id,role"
const PROFILE_SELECT_COLUMNS = "id,first_name,last_name,email"
const REPORT_BRAND_LOGO_FILE_NAME = "A1R.png"
const REPORT_BRAND_LOGO_MIME_TYPE = "image/png"

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function formatMemberName(profile: ProfileRow): string {
  const first = normalizeText(profile.first_name)
  const last = normalizeText(profile.last_name)

  if (first || last) {
    return [first, last].filter((value) => value.length > 0).join(" ")
  }

  return normalizeText(profile.email)
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateRange(input: { startDate: string; endDate: string }): string {
  return `${formatDateLabel(input.startDate)} to ${formatDateLabel(input.endDate)}`
}

function formatTotalNetTime(minutes: number): string {
  if (minutes <= 0) {
    return "00h 00m"
  }

  const days = Math.floor(minutes / (24 * 60))
  const remainingMinutesAfterDays = minutes - days * 24 * 60
  const hours = Math.floor(remainingMinutesAfterDays / 60)
  const restMinutes = remainingMinutesAfterDays % 60

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
  }

  return `${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
}

function formatAverageSessionMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`
}

function joinUnique(values: string[]): string {
  const unique = [...new Set(values.filter((value) => value.length > 0))]
  return unique.join("\n\n")
}

function parseYearFromDate(value: string): number {
  return Number.parseInt(value.slice(0, 4), 10)
}

function pruneConditions(templateHtml: string, payload: TemplatePayload): string {
  let output = templateHtml

  for (const band of CONDITION_BANDS) {
    const hasContent = CONDITION_FIELDS.some((field) => {
      const key = `${band} ${field}`
      return normalizeText(payload[key]).length > 0
    })

    if (hasContent) {
      continue
    }

    const pattern = new RegExp(
      `<!--\\s*=====\\s*${band.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*=====\\s*-->\\s*<tr>.*?<\\/tr>\\s*`,
      "gs",
    )

    output = output.replace(pattern, "")
  }

  return output
}

function renderTemplatePlaceholders(templateHtml: string, payload: TemplatePayload): string {
  return templateHtml.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = payload[key] ?? ""
    return escapeHtml(value)
  })
}

async function loadTemplateHtml(): Promise<string> {
  const templatePath = path.join(process.cwd(), "features/reports/report-template.html")
  return readFile(templatePath, "utf-8")
}

async function loadPublicAssetDataUri(input: {
  fileName: string
  mimeType: string
}): Promise<string> {
  const assetPath = path.join(process.cwd(), "public", input.fileName)
  const asset = await readFile(assetPath)

  return `data:${input.mimeType};base64,${asset.toString("base64")}`
}

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

function formatPdfRendererError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.replace(/\s+/g, " ").slice(0, 700)
}

async function renderPdfWithPlaywrightPackage(html: string): Promise<Uint8Array> {
  const browser = await playwrightChromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 })
    await page.waitForTimeout(250)

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    })

    return toUint8Array(pdfBuffer)
  } finally {
    await browser.close()
  }
}

async function renderPdfWithPlaywrightCore(html: string): Promise<Uint8Array> {
  const executablePath = await serverlessChromium.executablePath()

  const browser = await playwrightCoreChromium.launch({
    executablePath,
    headless: true,
    args: serverlessChromium.args,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 })
    await page.waitForTimeout(250)

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    })

    return toUint8Array(pdfBuffer)
  } finally {
    await browser.close()
  }
}

async function renderHtmlToPdfBytes(html: string): Promise<Uint8Array> {
  let playwrightPackageError: unknown = null

  try {
    return await renderPdfWithPlaywrightPackage(html)
  } catch (error) {
    playwrightPackageError = error
    // Fallback to the serverless Chromium stack.
  }

  try {
    return await renderPdfWithPlaywrightCore(html)
  } catch (serverlessChromiumError) {
    console.error("Report PDF renderer failed", {
      playwrightPackageError,
      serverlessChromiumError,
    })

    throw new Error(
      [
        "Could not initialize Chromium PDF renderer.",
        `Playwright package: ${formatPdfRendererError(playwrightPackageError)}.`,
        `Serverless Chromium: ${formatPdfRendererError(serverlessChromiumError)}.`,
      ].join(" "),
    )
  }
}

function buildConditionPayload(input: {
  sessions: SessionRow[]
  setupBySessionId: Map<string, SessionSetupRow>
  reviewBySessionId: Map<string, SessionReviewRow>
  conditionsBySessionId: Map<string, SessionConditionPayload>
}): TemplatePayload {
  const byBand = new Map<string, ConditionAggregatePayload>()

  for (const band of CONDITION_BANDS) {
    byBand.set(band, {
      seaState: [],
      twd: [],
      best: [],
      toWork: [],
      freeNotes: [],
    })
  }

  for (const session of input.sessions) {
    const review = input.reviewBySessionId.get(session.id)
    const setup = input.setupBySessionId.get(session.id)
    const condition = input.conditionsBySessionId.get(session.id)

    if (!condition || condition.bands.length === 0) {
      continue
    }

    const best = normalizeText(review?.best_of_session)
    const toWork = normalizeText(review?.to_work)
    const freeNotes = normalizeText(setup?.free_notes)

    for (const band of condition.bands) {
      const aggregate = byBand.get(band)

      if (!aggregate) {
        continue
      }

      if (condition.seaState.length > 0) {
        aggregate.seaState.push(condition.seaState)
      }

      if (condition.twd.length > 0) {
        aggregate.twd.push(condition.twd)
      }

      if (best.length > 0) {
        aggregate.best.push(best)
      }

      if (toWork.length > 0) {
        aggregate.toWork.push(toWork)
      }

      if (freeNotes.length > 0) {
        aggregate.freeNotes.push(freeNotes)
      }
    }
  }

  const payload: TemplatePayload = {}

  for (const band of CONDITION_BANDS) {
    const aggregate = byBand.get(band)

    payload[`${band} Sea State`] = aggregate ? joinUnique(aggregate.seaState) : ""
    payload[`${band} TWD`] = aggregate ? joinUnique(aggregate.twd) : ""
    payload[`${band} Best`] = aggregate ? joinUnique(aggregate.best) : ""
    payload[`${band} To Work`] = aggregate ? joinUnique(aggregate.toWork) : ""
    payload[`${band} Free Notes`] = aggregate ? joinUnique(aggregate.freeNotes) : ""
  }

  return payload
}

function buildSessionConditionMap(input: {
  sessions: SessionRow[]
  setupItems: TeamSetupItemRow[]
  setupOptions: TeamSetupOptionRow[]
  setupValues: SessionSetupValueRow[]
  selectedOptions: SessionSetupSelectedOptionRow[]
}): Map<string, SessionConditionPayload> {
  const itemById = new Map(input.setupItems.map((item) => [item.id, item]))
  const optionById = new Map(input.setupOptions.map((option) => [option.id, option]))

  const optionIdsByValueId = new Map<string, string[]>()

  for (const selectedOption of input.selectedOptions) {
    const ids = optionIdsByValueId.get(selectedOption.session_setup_item_value_id) ?? []
    ids.push(selectedOption.team_setup_item_option_id)
    optionIdsByValueId.set(selectedOption.session_setup_item_value_id, ids)
  }

  const conditionsBySessionId = new Map<
    string,
    {
      tws: string[]
      twd: string[]
      seaState: string[]
    }
  >()

  for (const valueRow of input.setupValues) {
    const item = itemById.get(valueRow.team_setup_item_id)

    if (!item) {
      continue
    }

    if (item.key !== "tws" && item.key !== "twd" && item.key !== "sea_state") {
      continue
    }

    const selectedIds = optionIdsByValueId.get(valueRow.id) ?? []
    const optionLabels = selectedIds
      .map((selectedId) => optionById.get(selectedId))
      .filter((option): option is TeamSetupOptionRow => Boolean(option))
      .sort((left, right) => left.position - right.position)
      .map((option) => normalizeText(option.label))
      .filter((label) => label.length > 0)

    const existing =
      conditionsBySessionId.get(valueRow.session_id) ??
      ({
        tws: [],
        twd: [],
        seaState: [],
      } as const)

    if (item.key === "tws") {
      conditionsBySessionId.set(valueRow.session_id, {
        ...existing,
        tws: optionLabels,
      })
      continue
    }

    if (item.key === "twd") {
      conditionsBySessionId.set(valueRow.session_id, {
        ...existing,
        twd: optionLabels,
      })
      continue
    }

    conditionsBySessionId.set(valueRow.session_id, {
      ...existing,
      seaState: optionLabels,
    })
  }

  const sessionConditionPayloadById = new Map<string, SessionConditionPayload>()

  for (const session of input.sessions) {
    const normalized = conditionsBySessionId.get(session.id)

    if (!normalized) {
      sessionConditionPayloadById.set(session.id, {
        bands: [],
        seaState: "",
        twd: "",
        best: "",
        toWork: "",
        freeNotes: "",
      })
      continue
    }

    const bands = normalized.tws.filter((value) =>
      CONDITION_BANDS.includes(value as (typeof CONDITION_BANDS)[number]),
    )

    sessionConditionPayloadById.set(session.id, {
      bands,
      seaState: normalized.seaState.join(", "),
      twd: normalized.twd.join(", "),
      best: "",
      toWork: "",
      freeNotes: "",
    })
  }

  return sessionConditionPayloadById
}

async function buildTemplatePayload(input: {
  report: TeamVenueReportRow
  teamVenue: TeamVenueRow
  venue: VenueRow
  camps: CampRow[]
  sessions: SessionRow[]
  reviews: SessionReviewRow[]
  setups: SessionSetupRow[]
  setupItems: TeamSetupItemRow[]
  setupOptions: TeamSetupOptionRow[]
  setupValues: SessionSetupValueRow[]
  selectedOptions: SessionSetupSelectedOptionRow[]
  crewNames: string[]
  coachNames: string[]
}): Promise<TemplatePayload> {
  const sessionsSorted = [...input.sessions].sort((left, right) => {
    const dateOrder = right.session_date.localeCompare(left.session_date)

    if (dateOrder !== 0) {
      return dateOrder
    }

    return right.created_at.localeCompare(left.created_at)
  })

  const setupBySessionId = new Map(input.setups.map((row) => [row.session_id, row]))
  const reviewBySessionId = new Map(input.reviews.map((row) => [row.session_id, row]))

  const conditionsBySessionId = buildSessionConditionMap({
    sessions: sessionsSorted,
    setupItems: input.setupItems,
    setupOptions: input.setupOptions,
    setupValues: input.setupValues,
    selectedOptions: input.selectedOptions,
  })

  const conditionPayload = buildConditionPayload({
    sessions: sessionsSorted,
    setupBySessionId,
    reviewBySessionId,
    conditionsBySessionId,
  })

  const sortedCamps = [...input.camps].sort((left, right) => {
    const startOrder = left.start_date.localeCompare(right.start_date)

    if (startOrder !== 0) {
      return startOrder
    }

    return left.name.localeCompare(right.name)
  })

  const campNames = sortedCamps.map((camp) => camp.name)
  const campGoals = sortedCamps
    .map((camp) => {
      const notes = normalizeText(camp.notes)

      if (notes.length === 0) {
        return null
      }

      return `${camp.name}\n${notes}`
    })
    .filter((value): value is string => value !== null)
    .join("\n\n")

  const startDate = sortedCamps[0]?.start_date
  const endDate = sortedCamps[sortedCamps.length - 1]?.end_date

  const netTimeMinutesValues = sessionsSorted
    .map((session) => session.net_time_minutes)
    .filter((value): value is number => typeof value === "number" && value >= 0)

  const totalNetTimeMinutes = netTimeMinutesValues.reduce((sum, value) => sum + value, 0)
  const averageNetTimeMinutes =
    netTimeMinutesValues.length > 0
      ? Math.round(totalNetTimeMinutes / netTimeMinutesValues.length)
      : null
  const brandLogoDataUri = await loadPublicAssetDataUri({
    fileName: REPORT_BRAND_LOGO_FILE_NAME,
    mimeType: REPORT_BRAND_LOGO_MIME_TYPE,
  })

  return {
    "Brand Logo": brandLogoDataUri,
    Crew: input.crewNames.join(" - "),
    Coach: input.coachNames.join(", "),
    Date:
      startDate && endDate
        ? formatDateRange({
            startDate,
            endDate,
          })
        : "",
    Camps: campNames.join(", "),
    "Net Time": formatTotalNetTime(totalNetTimeMinutes),
    "Avg. Session": formatAverageSessionMinutes(averageNetTimeMinutes),
    "Venue Camp Goals": campGoals,
    "Venue Name": input.venue.name,
    ...conditionPayload,
  }
}

async function loadReportPdfData(reportId: string): Promise<{
  report: TeamVenueReportRow
  teamVenue: TeamVenueRow
  venue: VenueRow
  camps: CampRow[]
  sessions: SessionRow[]
  reviews: SessionReviewRow[]
  setups: SessionSetupRow[]
  setupItems: TeamSetupItemRow[]
  setupOptions: TeamSetupOptionRow[]
  setupValues: SessionSetupValueRow[]
  selectedOptions: SessionSetupSelectedOptionRow[]
  crewNames: string[]
  coachNames: string[]
}> {
  const supabase = await createServerSupabaseClient()

  const { data: reportRow, error: reportError } = await supabase
    .from("team_venue_reports")
    .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
    .eq("id", reportId)
    .maybeSingle()

  if (reportError) {
    throw new Error(`Could not load report: ${reportError.message}`)
  }

  if (!reportRow) {
    throw new Error("Report not found or not accessible")
  }

  const report = reportRow as TeamVenueReportRow

  const { data: reportCampRows, error: reportCampsError } = await supabase
    .from("team_venue_report_camps")
    .select(TEAM_VENUE_REPORT_CAMPS_SELECT_COLUMNS)
    .eq("report_id", report.id)

  if (reportCampsError) {
    throw new Error(`Could not load report camps: ${reportCampsError.message}`)
  }

  const reportCampLinks: TeamVenueReportCampRow[] = reportCampRows ?? []
  const campIds = reportCampLinks.map((row) => row.camp_id)

  if (campIds.length === 0) {
    throw new Error("Report has no camps assigned")
  }

  const [{ data: teamVenueRow, error: teamVenueError }, { data: campRows, error: campsError }] =
    await Promise.all([
      supabase
        .from("team_venues")
        .select(TEAM_VENUE_SELECT_COLUMNS)
        .eq("id", report.team_venue_id)
        .maybeSingle(),
      supabase
        .from("camps")
        .select(CAMP_SELECT_COLUMNS)
        .in("id", campIds)
        .order("start_date", { ascending: true })
        .order("name", { ascending: true }),
    ])

  if (teamVenueError || !teamVenueRow) {
    throw new Error(
      `Could not load report team venue: ${teamVenueError?.message ?? "missing team venue"}`,
    )
  }

  if (campsError) {
    throw new Error(`Could not load camps for report: ${campsError.message}`)
  }

  const teamVenue = teamVenueRow as TeamVenueRow
  const camps: CampRow[] = campRows ?? []

  const mismatchedCampScope = camps.some(
    (camp) =>
      camp.team_venue_id !== teamVenue.id || parseYearFromDate(camp.start_date) !== report.year,
  )

  if (mismatchedCampScope) {
    throw new Error("Report contains camps outside the expected team venue/year scope")
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", teamVenue.venue_id)
    .maybeSingle()

  if (venueError || !venueRow) {
    throw new Error(`Could not load report venue: ${venueError?.message ?? "missing venue"}`)
  }

  const venue = venueRow as VenueRow

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .in("camp_id", camps.map((camp) => camp.id))

  if (sessionsError) {
    throw new Error(`Could not load sessions for report: ${sessionsError.message}`)
  }

  const sessions: SessionRow[] = sessionRows ?? []
  const sessionIds = sessions.map((session) => session.id)

  let reviews: SessionReviewRow[] = []
  let setups: SessionSetupRow[] = []
  let setupValues: SessionSetupValueRow[] = []
  let selectedOptions: SessionSetupSelectedOptionRow[] = []

  if (sessionIds.length > 0) {
    const [
      { data: reviewRows, error: reviewsError },
      { data: setupRows, error: setupsError },
    ] = await Promise.all([
      supabase
        .from("session_reviews")
        .select(SESSION_REVIEW_SELECT_COLUMNS)
        .in("session_id", sessionIds),
      supabase
        .from("session_setups")
        .select(SESSION_SETUP_SELECT_COLUMNS)
        .in("session_id", sessionIds),
    ])

    if (reviewsError) {
      throw new Error(`Could not load session reviews: ${reviewsError.message}`)
    }

    if (setupsError) {
      throw new Error(`Could not load session setups: ${setupsError.message}`)
    }

    reviews = reviewRows ?? []
    setups = setupRows ?? []
  }

  const { data: setupItemRows, error: setupItemsError } = await supabase
    .from("team_setup_items")
    .select(TEAM_SETUP_ITEMS_SELECT_COLUMNS)
    .eq("team_id", teamVenue.team_id)
    .in("key", ["tws", "twd", "sea_state"])

  if (setupItemsError) {
    throw new Error(`Could not load setup items for report: ${setupItemsError.message}`)
  }

  const setupItems: TeamSetupItemRow[] = setupItemRows ?? []
  const setupItemIds = setupItems.map((item) => item.id)

  let setupOptions: TeamSetupOptionRow[] = []

  if (setupItemIds.length > 0) {
    const { data: setupOptionRows, error: setupOptionsError } = await supabase
      .from("team_setup_item_options")
      .select(TEAM_SETUP_OPTIONS_SELECT_COLUMNS)
      .in("team_setup_item_id", setupItemIds)

    if (setupOptionsError) {
      throw new Error(`Could not load setup options for report: ${setupOptionsError.message}`)
    }

    setupOptions = setupOptionRows ?? []
  }

  if (sessionIds.length > 0 && setupItemIds.length > 0) {
    const { data: setupValueRows, error: setupValuesError } = await supabase
      .from("session_setup_item_values")
      .select(SESSION_SETUP_VALUES_SELECT_COLUMNS)
      .in("session_id", sessionIds)
      .in("team_setup_item_id", setupItemIds)

    if (setupValuesError) {
      throw new Error(`Could not load setup values for report: ${setupValuesError.message}`)
    }

    setupValues = setupValueRows ?? []
    const setupValueIds = setupValues.map((valueRow) => valueRow.id)

    if (setupValueIds.length > 0) {
      const { data: selectedOptionRows, error: selectedOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .select(SESSION_SETUP_SELECTED_OPTIONS_SELECT_COLUMNS)
        .in("session_setup_item_value_id", setupValueIds)

      if (selectedOptionsError) {
        throw new Error(
          `Could not load selected setup options for report: ${selectedOptionsError.message}`,
        )
      }

      selectedOptions = selectedOptionRows ?? []
    }
  }

  const { data: membershipRows, error: membershipsError } = await supabase
    .from("team_memberships")
    .select(TEAM_MEMBERSHIP_SELECT_COLUMNS)
    .eq("team_id", teamVenue.team_id)
    .eq("is_active", true)

  if (membershipsError) {
    throw new Error(`Could not load team memberships for report: ${membershipsError.message}`)
  }

  const memberships: TeamMembershipRow[] = membershipRows ?? []
  const profileIds = [...new Set(memberships.map((membership) => membership.profile_id))]

  let profiles: ProfileRow[] = []

  if (profileIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .in("id", profileIds)

    if (profilesError) {
      throw new Error(`Could not load profiles for report: ${profilesError.message}`)
    }

    profiles = profileRows ?? []
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  const crewNames = memberships
    .filter((membership) => membership.role === "crew")
    .map((membership) => profileById.get(membership.profile_id))
    .filter((profile): profile is ProfileRow => Boolean(profile))
    .map((profile) => formatMemberName(profile))
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right))

  const coachNames = memberships
    .filter((membership) => membership.role === "coach")
    .map((membership) => profileById.get(membership.profile_id))
    .filter((profile): profile is ProfileRow => Boolean(profile))
    .map((profile) => formatMemberName(profile))
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right))

  return {
    report,
    teamVenue,
    venue,
    camps,
    sessions,
    reviews,
    setups,
    setupItems,
    setupOptions,
    setupValues,
    selectedOptions,
    crewNames,
    coachNames,
  }
}

export async function generateReportPdf(reportId: string): Promise<ReportPdfResult> {
  const reportData = await loadReportPdfData(reportId)

  const templatePayload = await buildTemplatePayload({
    report: reportData.report,
    teamVenue: reportData.teamVenue,
    venue: reportData.venue,
    camps: reportData.camps,
    sessions: reportData.sessions,
    reviews: reportData.reviews,
    setups: reportData.setups,
    setupItems: reportData.setupItems,
    setupOptions: reportData.setupOptions,
    setupValues: reportData.setupValues,
    selectedOptions: reportData.selectedOptions,
    crewNames: reportData.crewNames,
    coachNames: reportData.coachNames,
  })

  const templateHtml = await loadTemplateHtml()
  const prunedTemplateHtml = pruneConditions(templateHtml, templatePayload)
  const renderedHtml = renderTemplatePlaceholders(prunedTemplateHtml, templatePayload)
  const pdfBytes = await renderHtmlToPdfBytes(renderedHtml)

  const safeBase = sanitizeFileName(reportData.report.name)
  const fileBase = safeBase.length > 0 ? safeBase : `report_${reportData.report.year}`

  return {
    fileName: `${fileBase}.pdf`,
    pdfBytes,
  }
}
