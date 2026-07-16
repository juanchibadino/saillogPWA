#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "..")

const RAW_FILENAMES = {
  teams: "teams.csv",
  venues: "venue_block.csv",
  camps: "camp_blocks.csv",
  sessions: "session_blocks.csv",
  setups: "session_setup (2).csv",
  users: "users.csv",
  images: "session_images.csv",
}

const TARGET_ORGANIZATIONS = {
  "oSZO4yW.Sh6RI97xh.LkkA": {
    id: "52c46576-7dcd-4fa7-8773-86ee4028c747",
    name: "America One Racing",
  },
  "a.VPkP-azQhaaU521qMC.IQ": {
    id: "db4fc76b-1dd5-4cf3-8d44-8e9021bd7e0c",
    name: "ENARD Argentina",
  },
}

const TARGET_TEAMS = {
  UJEpYnoOSnKSfaXjkFvzsA: {
    id: "6e298a62-300f-4df5-a9c8-363a9d8e0794",
    name: "ARG275",
    rawName: "ARG 49er",
    organizationId: TARGET_ORGANIZATIONS["a.VPkP-azQhaaU521qMC.IQ"].id,
  },
  vdpZwd6QRd2i0NFueuPXOA: {
    id: "48802935-b272-430c-bf55-1e588295ef08",
    name: "USA31",
    rawName: "USA 49er",
    organizationId: TARGET_ORGANIZATIONS["oSZO4yW.Sh6RI97xh.LkkA"].id,
  },
  zljrb594SuerA7VAKO8wEw: {
    id: "de059290-d0f0-4b76-8468-9d6367d1962a",
    name: "USA49",
    rawName: "USA 49erFX",
    organizationId: TARGET_ORGANIZATIONS["oSZO4yW.Sh6RI97xh.LkkA"].id,
  },
}

const RAW_TEAM_REPAIRS = {
  RXA: {
    campId: "RXA.znw9RYyp8VYWgR98EA",
    repairedRawTeamId: "zljrb594SuerA7VAKO8wEw",
    reason: "Blank camp team repaired from venue ownership: Eckernforde belongs to raw USA 49erFX.",
  },
}

const BLANK_CAMP_SESSION_REJECTS = new Set([
  "a.A6YXeaLQTK9eSJA1IKi5w",
  "6CUsjt9tTKGe5x2BGlU3hA",
])

const BLANK_SESSION_TYPE_DEFAULTS = new Set(["Vb0q1BbrQJiWgGusVG4usQ"])

const SETUP_OPTION_VALUES = {
  twd: ["N 0º", "NE 45º", "E 90º", "SE 135º", "S 180º", "SW 225º", "W 270º", "NW 315º"],
  tws: ["ST 0-4", "DT 5-8", "FP 9-11", "DP 12-18", "OP 19-23", "S 24+"],
  sea_state: ["flat", "chop", "swell"],
  primaries: range(-4, 26).map(String),
  lowers: [
    "-8",
    "-7,5",
    "-7",
    "-6,5",
    "-6",
    "-5,5",
    "-5",
    "-4,5",
    "-4",
    "-3,5",
    "-3",
    "-2,5",
    "-2",
    "-1,5",
    "-1",
    "-0,5",
    "0",
    "0,5",
    "1",
    "1,5",
    "2",
    "2,5",
    "3",
    "3,5",
    "4",
  ],
  caps: ["-1", "-0,5", "0", "0,5", "1", "1,5", "2", "2,5", "3"],
  board: ["0", "1", "2", "3", "4", "5", "6"],
  bridle: ["0", "1", "2", "3", "4"],
  vang: ["0", "1", "2", "3", "4", "5", "6"],
  cunningham: ["5", "4", "3", "2", "1", "0"],
  outhaul: ["0", "1", "2", "3"],
  track: ["3", "4", "5"],
  clew: ["middle", "top"],
  tack_height: [
    "+5",
    "4,5",
    "4",
    "3,5",
    "3",
    "2,5",
    "2",
    "1,5",
    "1",
    "0,5",
    "0",
    "-0,5",
    "-1",
    "-1,5",
    "-2",
    "-2,5",
    "-3",
    "-3,5",
    "-4",
    "-4,5",
    "-5",
    "6",
    "7",
    "9",
  ],
  conditions: [
    "One side favored",
    "Side favored and winning lanes",
    "Unstable sea breeze (open)",
    "Offshore corners",
    "Offshore playing the shifts and gusts",
    "Steady/lanes and edges",
  ],
}

const SETUP_SELECT_COLUMNS = {
  TWD: "twd",
  "TWS New V3": "tws",
  sea_state: "sea_state",
  primaries: "primaries",
  lowers: "lowers",
  caps: "caps",
  board: "board",
  bridle: "bridle",
  outhaul: "outhaul",
  track: "track",
  clew: "clew",
  tack_height: "tack_height",
  conditions: "conditions",
  vang: "vang",
  cunningham: "cunningham",
}

const SETUP_TEXT_COLUMNS = {
  type_of_day: "type_of_day",
  current: "currents",
  course_area: "course_area",
}

const TWD_ALIASES = new Map([
  ["N", "N 0º"],
  ["NE", "NE 45º"],
  ["E", "E 90º"],
  ["SE", "SE 135º"],
  ["S", "S 180º"],
  ["SW", "SW 225º"],
  ["W", "W 270º"],
  ["NW", "NW 315º"],
])

function range(start, endInclusive) {
  return Array.from({ length: endInclusive - start + 1 }, (_, index) => start + index)
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return ""
  }

  return value.replace(/\r\n?/g, "\n").trim()
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, " ").toLowerCase()
}

function parseBoolean(value) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === "true" || normalized === "yes" || normalized === "1"
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
      } else {
        value += character
      }

      continue
    }

    if (character === '"') {
      inQuotes = true
      continue
    }

    if (character === ",") {
      row.push(value)
      value = ""
      continue
    }

    if (character === "\n") {
      row.push(value)
      rows.push(row)
      row = []
      value = ""
      continue
    }

    if (character !== "\r") {
      value += character
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value)
    rows.push(row)
  }

  if (rows.length === 0) {
    return []
  }

  const [headers, ...dataRows] = rows
  return dataRows
    .filter((dataRow) => dataRow.some((cell) => normalizeText(cell).length > 0))
    .map((dataRow) => {
      const record = {}

      for (let index = 0; index < headers.length; index += 1) {
        record[headers[index]] = dataRow[index] ?? ""
      }

      return record
    })
}

async function readCsv(pathname) {
  const text = await readFile(pathname, "utf8")
  return parseCsv(text.replace(/^\uFEFF/, ""))
}

export async function loadRawData(rawDir = path.join(REPO_ROOT, "RAW DATA")) {
  const entries = await Promise.all(
    Object.entries(RAW_FILENAMES).map(async ([key, filename]) => [
      key,
      await readCsv(path.join(rawDir, filename)),
    ]),
  )

  return Object.fromEntries(entries)
}

function buildById(rows, column) {
  return new Map(rows.map((row) => [row[column], row]))
}

function findDuplicateIds(rows, column) {
  const seen = new Set()
  const duplicates = new Set()

  for (const row of rows) {
    const value = row[column]

    if (seen.has(value)) {
      duplicates.add(value)
    }

    seen.add(value)
  }

  return [...duplicates]
}

function parseDateCandidates(value) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return []
  }

  const match = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})(?:\s*(?:(a|p)\.\s*m\.|(AM|PM)))?$/i,
  )

  if (!match) {
    return []
  }

  const [, firstRaw, secondRaw, yearRaw, hourRaw, minuteRaw, secondPartRaw, amPmLong, amPmShort] =
    match
  const first = Number.parseInt(firstRaw, 10)
  const second = Number.parseInt(secondRaw, 10)
  const year = Number.parseInt(yearRaw, 10)
  const minute = Number.parseInt(minuteRaw, 10)
  const secondPart = Number.parseInt(secondPartRaw, 10)
  let hour = Number.parseInt(hourRaw, 10)
  const meridiem = (amPmLong ?? amPmShort ?? "").toLowerCase().slice(0, 1)

  if (meridiem === "a") {
    if (hour === 12) {
      hour = 0
    }
  } else if (meridiem === "p") {
    if (hour !== 12) {
      hour += 12
    }
  }

  const candidates = []

  for (const order of ["day-first", "month-first"]) {
    const day = order === "day-first" ? first : second
    const month = order === "day-first" ? second : first
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, secondPart))

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      date.getUTCHours() === hour &&
      date.getUTCMinutes() === minute &&
      date.getUTCSeconds() === secondPart
    ) {
      candidates.push({ date, order })
    }
  }

  const uniqueCandidates = new Map()

  for (const candidate of candidates) {
    uniqueCandidates.set(candidate.date.toISOString(), candidate)
  }

  return [...uniqueCandidates.values()]
}

function choosePreferredDate(value) {
  const candidates = parseDateCandidates(value)
  return (
    candidates.find((candidate) => candidate.order === "day-first")?.date ??
    candidates[0]?.date ??
    null
  )
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function isoTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z")
}

function chooseTimestampPair(startRaw, endRaw) {
  const start = choosePreferredDate(startRaw)

  if (!start) {
    return {
      dockOutAt: null,
      dockInAt: null,
      netTimeMinutes: null,
      startParseFailed: true,
      endRepair: null,
    }
  }

  const endCandidates = parseDateCandidates(endRaw)

  if (endCandidates.length === 0) {
    return {
      dockOutAt: isoTimestamp(start),
      dockInAt: null,
      netTimeMinutes: null,
      startParseFailed: false,
      endRepair: normalizeText(endRaw) ? "unparseable_end" : "blank_end",
    }
  }

  const sameDateValid = endCandidates.find(
    (candidate) => isoDate(candidate.date) === isoDate(start) && candidate.date >= start,
  )
  const nearbyValid = endCandidates
    .filter((candidate) => {
      const minutes = (candidate.date.getTime() - start.getTime()) / 60000
      return minutes >= 0 && minutes <= 48 * 60
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime())[0]
  const end = sameDateValid?.date ?? nearbyValid?.date ?? null

  if (!end) {
    return {
      dockOutAt: isoTimestamp(start),
      dockInAt: null,
      netTimeMinutes: null,
      startParseFailed: false,
      endRepair: "end_before_start_or_out_of_range",
    }
  }

  return {
    dockOutAt: isoTimestamp(start),
    dockInAt: isoTimestamp(end),
    netTimeMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
    startParseFailed: false,
    endRepair: null,
  }
}

function chooseCampDateRange(campRow, childSessionRows) {
  const startCandidates = parseDateCandidates(campRow.start_date)
  const endCandidates = parseDateCandidates(campRow.end_date)
  const childDates = childSessionRows
    .map((sessionRow) => choosePreferredDate(sessionRow["TIME DATA / start_time"]))
    .filter((date) => date !== null)
    .map((date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())))

  const pairs = []

  for (const startCandidate of startCandidates) {
    for (const endCandidate of endCandidates) {
      const start = new Date(
        Date.UTC(
          startCandidate.date.getUTCFullYear(),
          startCandidate.date.getUTCMonth(),
          startCandidate.date.getUTCDate(),
        ),
      )
      const end = new Date(
        Date.UTC(
          endCandidate.date.getUTCFullYear(),
          endCandidate.date.getUTCMonth(),
          endCandidate.date.getUTCDate(),
        ),
      )

      if (end < start) {
        continue
      }

      const coveredChildren = childDates.filter((date) => date >= start && date <= end).length
      const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000)
      const preference =
        (startCandidate.order === "day-first" ? 0 : 1) +
        (endCandidate.order === "day-first" ? 0 : 1)

      pairs.push({ start, end, coveredChildren, daySpan, preference })
    }
  }

  pairs.sort(
    (left, right) =>
      left.preference - right.preference ||
      left.daySpan - right.daySpan ||
      right.coveredChildren - left.coveredChildren,
  )

  const chosenPair = pairs[0]
  const baseStart =
    chosenPair?.start ??
    (startCandidates[0]
      ? new Date(
          Date.UTC(
            startCandidates[0].date.getUTCFullYear(),
            startCandidates[0].date.getUTCMonth(),
            startCandidates[0].date.getUTCDate(),
          ),
        )
      : null)
  const baseEnd = chosenPair?.end ?? baseStart
  const datesForRange = [baseStart, baseEnd, ...childDates].filter((date) => date !== null)

  if (datesForRange.length === 0) {
    return {
      startDate: null,
      endDate: null,
      repair: "unparseable_camp_dates",
    }
  }

  const startDate = datesForRange.reduce((earliest, date) =>
    date < earliest ? date : earliest,
  )
  const endDate = datesForRange.reduce((latest, date) => (date > latest ? date : latest))
  const rawStart = startCandidates[0] ? isoDate(startCandidates[0].date) : null
  const rawEnd = endCandidates[0] ? isoDate(endCandidates[0].date) : null
  const repair =
    !chosenPair || rawStart !== isoDate(startDate) || rawEnd !== isoDate(endDate)
      ? "normalized_or_widened_date_range"
      : null

  return {
    startDate: isoDate(startDate),
    endDate: isoDate(endDate),
    repair,
  }
}

function inferCampType(childSessions) {
  const types = childSessions
    .map((sessionRow) => normalizeText(sessionRow["GENERAL / Type"]).toLowerCase())
    .filter((value) => value === "training" || value === "regatta")

  if (types.length === 0 || types.every((type) => type === "training")) {
    return "training"
  }

  if (types.every((type) => type === "regatta")) {
    return "regatta"
  }

  return "mixed"
}

function buildCampNotes(row) {
  const parts = [
    ["Location", row.location],
    ["Goals", row.goals],
    ["Why", row.why],
    ["Achieved", row.achieved],
    ["Closed", row.closed],
    ["Assessment created", row.assessment_created],
  ]
    .map(([label, value]) => [label, normalizeText(value)])
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)

  return parts.length > 0 ? parts.join("\n\n") : null
}

function buildSessionNotes(row) {
  const audioNotes = normalizeText(row.audionotes)
  return audioNotes.length > 0 ? `Audio notes: ${audioNotes}` : null
}

function splitMultiValue(value) {
  return normalizeText(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function normalizeNumberToken(value) {
  return normalizeText(value)
    .replace(/(?<=\d)\.5\b/g, ",5")
    .replace(/(?<=\d)\.0\b/g, "")
}

function normalizeSetupOptionValue(key, value) {
  const normalized = normalizeText(value)

  if (key === "twd") {
    return TWD_ALIASES.get(normalized.toUpperCase()) ?? normalized
  }

  if (
    key === "lowers" ||
    key === "caps" ||
    key === "tack_height" ||
    key === "primaries" ||
    key === "board" ||
    key === "bridle" ||
    key === "vang" ||
    key === "cunningham" ||
    key === "outhaul" ||
    key === "track"
  ) {
    const numberToken = normalizeNumberToken(normalized)
    return key === "tack_height" && numberToken === "5" ? "+5" : numberToken
  }

  return normalized
}

function parseSetupCreatedAt(row) {
  return choosePreferredDate(row.created_time) ?? new Date(0)
}

function buildFreeNotesEntry(row) {
  const lines = []
  const freeNotes = normalizeText(row.free_notes)
  const twsMin = normalizeText(row["TWS-"])
  const twsMax = normalizeText(row["TWS+"])

  if (freeNotes) {
    lines.push(freeNotes)
  }

  if (twsMin || twsMax) {
    lines.push(`TWS raw range: ${twsMin || "?"}-${twsMax || "?"}`)
  }

  if (lines.length === 0) {
    return null
  }

  const createdTime = normalizeText(row.created_time) || "unknown time"
  return `[${createdTime} | ${row.daily_metrics_id}]\n${lines.join("\n")}`
}

function addOrderedSetValue(target, value) {
  if (!target.includes(value)) {
    target.push(value)
  }
}

function assignCatalogNames(entries, fallbackLabel) {
  const nameCountsByOwner = new Map()

  return entries.map((entry) => {
    const ownerKey = `${entry.ownerKind}:${entry.ownerId}`
    const nameCounts = nameCountsByOwner.get(ownerKey) ?? new Map()
    const baseName = buildCatalogName(entry.description, fallbackLabel)
    const existingCount = nameCounts.get(baseName.toLowerCase()) ?? 0
    const nextCount = existingCount + 1
    nameCounts.set(baseName.toLowerCase(), nextCount)
    nameCountsByOwner.set(ownerKey, nameCounts)

    return {
      ...entry,
      name: nextCount === 1 ? baseName : clampCatalogName(`${baseName} (${nextCount})`),
    }
  })
}

function buildCatalogName(description, fallbackLabel) {
  const normalized = normalizeText(description).replace(/\s+/g, " ")

  if (!normalized) {
    return fallbackLabel
  }

  const sentenceEnd = normalized.search(/[.!?]/)
  const firstSentence =
    sentenceEnd > 12 ? normalized.slice(0, sentenceEnd + 1) : normalized
  return clampCatalogName(firstSentence)
}

function clampCatalogName(value) {
  const normalized = normalizeText(value).replace(/\s+/g, " ")

  if (normalized.length <= 120) {
    return normalized
  }

  return `${normalized.slice(0, 117).trim()}...`
}

export function buildImportPlan(rawData) {
  const issues = []
  const repairs = []
  const rejects = []

  const rawVenuesById = buildById(rawData.venues, "venue_id")
  const rawSessionsById = buildById(rawData.sessions, "session_id")
  const rawUsersById = buildById(rawData.users, "GENERAL / user_id")
  const sessionsByCampId = new Map()

  for (const sessionRow of rawData.sessions) {
    const campId = sessionRow["CAMP / camp_id"]
    const current = sessionsByCampId.get(campId) ?? []
    current.push(sessionRow)
    sessionsByCampId.set(campId, current)
  }

  for (const [key, column] of [
    ["venues", "venue_id"],
    ["camps", "camp_id"],
    ["sessions", "session_id"],
    ["setups", "daily_metrics_id"],
    ["images", "image_id"],
  ]) {
    for (const duplicateId of findDuplicateIds(rawData[key], column)) {
      issues.push({
        severity: "fatal",
        code: "duplicate_raw_id",
        message: `Duplicate ${key}.${column}: ${duplicateId}`,
      })
    }
  }

  for (const teamRow of rawData.teams) {
    if (!TARGET_TEAMS[teamRow.team_id]) {
      issues.push({
        severity: "fatal",
        code: "unmapped_team",
        message: `No target team mapping for raw team ${teamRow.team_id}.`,
      })
    }

    if (!TARGET_ORGANIZATIONS[teamRow["ORG / org_id"]]) {
      issues.push({
        severity: "fatal",
        code: "unmapped_org",
        message: `No target organization mapping for raw org ${teamRow["ORG / org_id"]}.`,
      })
    }
  }

  const camps = []
  const campPlanByRawId = new Map()

  for (const campRow of rawData.camps) {
    let rawTeamId = normalizeText(campRow.team_id)
    const rawVenueId = normalizeText(campRow["VENUE / venue_id"])
    const venueRow = rawVenuesById.get(rawVenueId)

    if (!rawTeamId && campRow.camp_id === RAW_TEAM_REPAIRS.RXA.campId) {
      rawTeamId = RAW_TEAM_REPAIRS.RXA.repairedRawTeamId
      repairs.push({
        code: "camp_team_repaired_from_venue",
        rawId: campRow.camp_id,
        message: RAW_TEAM_REPAIRS.RXA.reason,
      })
    }

    const targetTeam = TARGET_TEAMS[rawTeamId]

    if (!targetTeam) {
      rejects.push({
        entity: "camp",
        rawId: campRow.camp_id,
        reason: "missing_or_unmapped_team",
      })
      continue
    }

    if (!venueRow) {
      rejects.push({
        entity: "camp",
        rawId: campRow.camp_id,
        reason: `missing_raw_venue:${rawVenueId}`,
      })
      continue
    }

    if (normalizeText(venueRow["GENERAL DATA / team_id"]) !== rawTeamId) {
      rejects.push({
        entity: "camp",
        rawId: campRow.camp_id,
        reason: `raw_team_venue_mismatch:${rawTeamId}:${venueRow["GENERAL DATA / team_id"]}`,
      })
      continue
    }

    const childSessions = sessionsByCampId.get(campRow.camp_id) ?? []
    const dateRange = chooseCampDateRange(campRow, childSessions)

    if (!dateRange.startDate || !dateRange.endDate) {
      rejects.push({
        entity: "camp",
        rawId: campRow.camp_id,
        reason: "unparseable_camp_date_range",
      })
      continue
    }

    if (dateRange.repair) {
      repairs.push({
        code: "camp_date_range_repaired",
        rawId: campRow.camp_id,
        message: `${campRow.Name}: ${dateRange.repair} -> ${dateRange.startDate}..${dateRange.endDate}`,
      })
    }

    const campPlan = {
      rawId: campRow.camp_id,
      rawTeamId,
      targetTeamId: targetTeam.id,
      targetOrganizationId: targetTeam.organizationId,
      rawVenueId,
      rawVenueName: venueRow["GENERAL DATA / Name"],
      name: normalizeText(campRow.Name) || "Untitled Camp",
      campType: inferCampType(childSessions),
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      notes: buildCampNotes(campRow),
      isActive: true,
    }

    camps.push(campPlan)
    campPlanByRawId.set(campPlan.rawId, campPlan)
  }

  const sessions = []
  const sessionPlanByRawId = new Map()

  for (const sessionRow of rawData.sessions) {
    const rawSessionId = sessionRow.session_id
    const rawCampId = normalizeText(sessionRow["CAMP / camp_id"])

    if (!rawCampId) {
      rejects.push({
        entity: "session",
        rawId: rawSessionId,
        reason: BLANK_CAMP_SESSION_REJECTS.has(rawSessionId)
          ? "blank_camp_id_default_reject"
          : "blank_camp_id",
      })
      continue
    }

    const camp = campPlanByRawId.get(rawCampId)

    if (!camp) {
      rejects.push({
        entity: "session",
        rawId: rawSessionId,
        reason: `camp_not_imported:${rawCampId}`,
      })
      continue
    }

    let sessionType = normalizeText(sessionRow["GENERAL / Type"]).toLowerCase()

    if (!sessionType && BLANK_SESSION_TYPE_DEFAULTS.has(rawSessionId)) {
      sessionType = "training"
      repairs.push({
        code: "blank_session_type_defaulted",
        rawId: rawSessionId,
        message: "Blank session type defaulted to training.",
      })
    }

    if (sessionType !== "training" && sessionType !== "regatta") {
      rejects.push({
        entity: "session",
        rawId: rawSessionId,
        reason: `invalid_session_type:${sessionRow["GENERAL / Type"]}`,
      })
      continue
    }

    const timestampPair = chooseTimestampPair(
      sessionRow["TIME DATA / start_time"],
      sessionRow["TIME DATA / end_time"],
    )

    if (timestampPair.startParseFailed || !timestampPair.dockOutAt) {
      rejects.push({
        entity: "session",
        rawId: rawSessionId,
        reason: "unparseable_session_start_time",
      })
      continue
    }

    if (timestampPair.endRepair) {
      repairs.push({
        code: "session_end_time_repaired",
        rawId: rawSessionId,
        message: `${timestampPair.endRepair}; dock_in_at/net_time_minutes will be null.`,
      })
    }

    const sessionDate = timestampPair.dockOutAt.slice(0, 10)

    if (sessionDate < camp.startDate || sessionDate > camp.endDate) {
      issues.push({
        severity: "fatal",
        code: "session_outside_repaired_camp_range",
        message: `${rawSessionId} ${sessionDate} outside ${camp.rawId} ${camp.startDate}..${camp.endDate}`,
      })
    }

    const sessionPlan = {
      rawId: rawSessionId,
      rawCampId,
      targetTeamId: camp.targetTeamId,
      targetOrganizationId: camp.targetOrganizationId,
      rawVenueId: camp.rawVenueId,
      sessionType,
      sessionDate,
      dockOutAt: timestampPair.dockOutAt,
      dockInAt: timestampPair.dockInAt,
      netTimeMinutes: timestampPair.netTimeMinutes,
      highlightedByCoach: parseBoolean(sessionRow["ASSESS / highlighted"]),
      goals: normalizeText(sessionRow["ASSESS / goals"]) || null,
      notes: buildSessionNotes(sessionRow),
      review: {
        bestOfSession: normalizeText(sessionRow["ASSESS / best"]) || null,
        toWork: normalizeText(sessionRow["ASSESS / To Work"]) || null,
      },
      resultNotes: normalizeText(sessionRow["GENERAL / Results"]) || null,
      rawStandardMove: normalizeText(sessionRow["ASSESS / Standard move"]),
      rawWindPattern: normalizeText(sessionRow["ASSESS / Wind Pattern"]),
    }

    sessions.push(sessionPlan)
    sessionPlanByRawId.set(sessionPlan.rawId, sessionPlan)
  }

  const setupRowsBySessionId = new Map()

  for (const setupRow of rawData.setups) {
    const rawSessionId = normalizeText(setupRow.session_id)

    if (!rawSessionsById.has(rawSessionId)) {
      rejects.push({
        entity: "setup",
        rawId: setupRow.daily_metrics_id,
        reason: `session_not_found_in_raw_sessions:${rawSessionId}`,
      })
      continue
    }

    if (!sessionPlanByRawId.has(rawSessionId)) {
      rejects.push({
        entity: "setup",
        rawId: setupRow.daily_metrics_id,
        reason: `session_not_imported:${rawSessionId}`,
      })
      continue
    }

    if (setupRow.user_id && !rawUsersById.has(setupRow.user_id)) {
      issues.push({
        severity: "warning",
        code: "setup_user_not_found",
        message: `${setupRow.daily_metrics_id} references missing user ${setupRow.user_id}.`,
      })
    }

    const current = setupRowsBySessionId.get(rawSessionId) ?? []
    current.push(setupRow)
    setupRowsBySessionId.set(rawSessionId, current)
  }

  const setupPlans = []

  for (const [rawSessionId, setupRows] of setupRowsBySessionId.entries()) {
    setupRows.sort((left, right) => parseSetupCreatedAt(left) - parseSetupCreatedAt(right))

    if (setupRows.length > 1) {
      repairs.push({
        code: "duplicate_session_setup_merged",
        rawId: rawSessionId,
        message: `${setupRows.length} setup rows merged by deterministic import rules.`,
      })
    }

    const selectedValuesByKey = new Map()
    const textValuesByKey = new Map()
    const freeNotes = []

    for (const setupRow of setupRows) {
      for (const [column, key] of Object.entries(SETUP_SELECT_COLUMNS)) {
        for (const token of splitMultiValue(setupRow[column])) {
          const normalizedOption = normalizeSetupOptionValue(key, token)
          const allowedValues = SETUP_OPTION_VALUES[key] ?? []

          if (!allowedValues.includes(normalizedOption)) {
            issues.push({
              severity: "fatal",
              code: "missing_setup_option",
              message: `${setupRow.daily_metrics_id} ${column}=${token} normalized to ${normalizedOption}, but ${key} has no target option.`,
            })
            continue
          }

          const current = selectedValuesByKey.get(key) ?? []
          addOrderedSetValue(current, normalizedOption)
          selectedValuesByKey.set(key, current)
        }
      }

      for (const [column, key] of Object.entries(SETUP_TEXT_COLUMNS)) {
        const value = normalizeText(setupRow[column])

        if (value) {
          textValuesByKey.set(key, value)
        }
      }

      const freeNotesEntry = buildFreeNotesEntry(setupRow)

      if (freeNotesEntry) {
        freeNotes.push(freeNotesEntry)
      }
    }

    const itemValues = []

    for (const [key, selectedValues] of selectedValuesByKey.entries()) {
      itemValues.push({
        itemKey: key,
        selectedValues,
        textValue: null,
      })
    }

    for (const [key, textValue] of textValuesByKey.entries()) {
      itemValues.push({
        itemKey: key,
        selectedValues: [],
        textValue,
      })
    }

    setupPlans.push({
      rawSessionId,
      setupRowIds: setupRows.map((setupRow) => setupRow.daily_metrics_id),
      itemValues,
      freeNotes: freeNotes.length > 0 ? freeNotes.join("\n\n---\n\n") : null,
    })
  }

  const standardMoveEntries = assignCatalogNames(
    sessions
      .filter((session) => session.rawStandardMove)
      .map((session) => ({
        rawSessionId: session.rawId,
        ownerKind: "team",
        ownerId: session.targetTeamId,
        description: session.rawStandardMove,
      })),
    "Standard Move",
  )

  const windPatternEntries = assignCatalogNames(
    sessions
      .filter((session) => session.rawWindPattern)
      .map((session) => ({
        rawSessionId: session.rawId,
        ownerKind: "team_venue",
        ownerId: `${session.targetTeamId}:${session.rawVenueId}`,
        rawVenueId: session.rawVenueId,
        description: session.rawWindPattern,
      })),
    "Wind Pattern",
  )

  for (const imageRow of rawData.images) {
    if (!rawSessionsById.has(imageRow.session_id)) {
      rejects.push({
        entity: "image",
        rawId: imageRow.image_id,
        reason: `session_not_found_in_raw_sessions:${imageRow.session_id}`,
      })
    }
  }

  return {
    counts: {
      rawTeams: rawData.teams.length,
      rawVenues: rawData.venues.length,
      rawCamps: rawData.camps.length,
      rawSessions: rawData.sessions.length,
      rawSetups: rawData.setups.length,
      rawImages: rawData.images.length,
      plannedCamps: camps.length,
      plannedSessions: sessions.length,
      plannedSetupSessions: setupPlans.length,
      plannedSetupSourceRows: setupPlans.reduce(
        (total, setupPlan) => total + setupPlan.setupRowIds.length,
        0,
      ),
      plannedStandardMoveLinks: standardMoveEntries.length,
      plannedWindPatternLinks: windPatternEntries.length,
    },
    issues,
    repairs,
    rejects,
    camps,
    sessions,
    setups: setupPlans,
    standardMoves: standardMoveEntries,
    windPatterns: windPatternEntries,
  }
}

function loadEnvFile(filePath) {
  return readFile(filePath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith("#")) {
          continue
        }

        const separatorIndex = trimmed.indexOf("=")

        if (separatorIndex === -1) {
          continue
        }

        const key = trimmed.slice(0, separatorIndex).trim()
        let value = trimmed.slice(separatorIndex + 1).trim()

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }

        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
    .catch((error) => {
      if (error.code !== "ENOENT") {
        throw error
      }
    })
}

async function createSupabaseClientFromEnv() {
  await loadEnvFile(path.join(REPO_ROOT, ".env.local"))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim()

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Apply mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    )
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function resolveDatabaseVenueMap(supabase, plan) {
  const organizationIds = [...new Set(plan.camps.map((camp) => camp.targetOrganizationId))]
  const { data, error } = await supabase
    .from("venues")
    .select("id,organization_id,name,legacy_glide_row_id")
    .in("organization_id", organizationIds)

  if (error) {
    throw new Error(`Could not load venues: ${error.message}`)
  }

  const venueRows = data ?? []
  const byLegacyId = new Map()
  const byOrgName = new Map()

  for (const venue of venueRows) {
    if (venue.legacy_glide_row_id) {
      byLegacyId.set(venue.legacy_glide_row_id, venue)
    }

    byOrgName.set(`${venue.organization_id}:${normalizeKey(venue.name)}`, venue)
  }

  const venueMap = new Map()
  const unresolved = []

  for (const camp of plan.camps) {
    if (venueMap.has(camp.rawVenueId)) {
      continue
    }

    const venue =
      byLegacyId.get(camp.rawVenueId) ??
      byOrgName.get(`${camp.targetOrganizationId}:${normalizeKey(camp.rawVenueName)}`)

    if (!venue) {
      unresolved.push(`${camp.rawVenueId} ${camp.rawVenueName} (${camp.targetOrganizationId})`)
      continue
    }

    venueMap.set(camp.rawVenueId, venue.id)
  }

  if (unresolved.length > 0) {
    throw new Error(`Could not resolve loaded venues:\n${unresolved.join("\n")}`)
  }

  return venueMap
}

async function ensureTeamVenues(supabase, plan, venueMap) {
  const desiredRows = []
  const seen = new Set()

  for (const camp of plan.camps) {
    const venueId = venueMap.get(camp.rawVenueId)
    const key = `${camp.targetTeamId}:${venueId}`

    if (!seen.has(key)) {
      desiredRows.push({ team_id: camp.targetTeamId, venue_id: venueId })
      seen.add(key)
    }
  }

  if (desiredRows.length === 0) {
    return new Map()
  }

  const { error: upsertError } = await supabase
    .from("team_venues")
    .upsert(desiredRows, { onConflict: "team_id,venue_id", ignoreDuplicates: true })

  if (upsertError) {
    throw new Error(`Could not ensure team_venues: ${upsertError.message}`)
  }

  const teamIds = [...new Set(desiredRows.map((row) => row.team_id))]
  const venueIds = [...new Set(desiredRows.map((row) => row.venue_id))]
  const { data, error } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .in("team_id", teamIds)
    .in("venue_id", venueIds)

  if (error) {
    throw new Error(`Could not reload team_venues: ${error.message}`)
  }

  return new Map((data ?? []).map((row) => [`${row.team_id}:${row.venue_id}`, row.id]))
}

async function upsertByLegacyId({ supabase, table, legacyColumn, rows, selectColumns }) {
  if (rows.length === 0) {
    return new Map()
  }

  const legacyIds = rows.map((row) => row[legacyColumn])
  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select(selectColumns)
    .in(legacyColumn, legacyIds)

  if (existingError) {
    throw new Error(`Could not load existing ${table}: ${existingError.message}`)
  }

  const existingByLegacyId = new Map(
    (existingRows ?? []).map((row) => [row[legacyColumn], row]),
  )
  const idByLegacyId = new Map()

  for (const row of rows) {
    const existing = existingByLegacyId.get(row[legacyColumn])

    if (existing) {
      const { data, error } = await supabase
        .from(table)
        .update(row)
        .eq("id", existing.id)
        .select(selectColumns)
        .single()

      if (error) {
        throw new Error(`Could not update ${table} ${row[legacyColumn]}: ${error.message}`)
      }

      idByLegacyId.set(row[legacyColumn], data.id)
      continue
    }

    const { data, error } = await supabase.from(table).insert(row).select(selectColumns).single()

    if (error) {
      throw new Error(`Could not insert ${table} ${row[legacyColumn]}: ${error.message}`)
    }

    idByLegacyId.set(row[legacyColumn], data.id)
  }

  return idByLegacyId
}

async function ensureSetupMetadata(supabase, plan) {
  const teamIds = [...new Set(plan.camps.map((camp) => camp.targetTeamId))]

  for (const teamId of teamIds) {
    const { data: items, error } = await supabase
      .from("team_setup_items")
      .select("id,team_id,key,position")
      .eq("team_id", teamId)
      .order("position", { ascending: true })

    if (error) {
      throw new Error(`Could not load team setup items for ${teamId}: ${error.message}`)
    }

    const existingItems = items ?? []
    const itemByKey = new Map(existingItems.map((item) => [item.key, item]))

    if (!itemByKey.has("course_area")) {
      const maxPosition = existingItems.reduce(
        (max, item) => Math.max(max, item.position ?? 0),
        0,
      )
      const { error: insertCourseAreaError } = await supabase.from("team_setup_items").insert({
        team_id: teamId,
        key: "course_area",
        label: "Course Area",
        input_kind: "text",
        metric_group: "weather",
        is_fixed: false,
        position: maxPosition + 1,
        is_active: true,
      })

      if (insertCourseAreaError) {
        throw new Error(
          `Could not insert course_area setup metric for ${teamId}: ${insertCourseAreaError.message}`,
        )
      }
    }

    const { data: tackItems, error: tackError } = await supabase
      .from("team_setup_items")
      .select("id")
      .eq("team_id", teamId)
      .eq("key", "tack_height")
      .limit(1)

    if (tackError) {
      throw new Error(`Could not load tack_height setup item for ${teamId}: ${tackError.message}`)
    }

    const tackItem = tackItems?.[0]

    if (!tackItem) {
      throw new Error(`Team ${teamId} is missing tack_height setup item.`)
    }

    const { data: options, error: optionsError } = await supabase
      .from("team_setup_item_options")
      .select("value,position")
      .eq("team_setup_item_id", tackItem.id)

    if (optionsError) {
      throw new Error(`Could not load tack_height options for ${teamId}: ${optionsError.message}`)
    }

    const existingOptionValues = new Set((options ?? []).map((option) => option.value))
    let nextPosition = (options ?? []).reduce(
      (max, option) => Math.max(max, option.position ?? 0),
      0,
    )
    const missingOptions = ["6", "7", "9"].filter(
      (optionValue) => !existingOptionValues.has(optionValue),
    )

    if (missingOptions.length > 0) {
      const { error: insertOptionsError } = await supabase.from("team_setup_item_options").insert(
        missingOptions.map((optionValue) => {
          nextPosition += 1
          return {
            team_setup_item_id: tackItem.id,
            value: optionValue,
            label: optionValue,
            position: nextPosition,
            is_active: true,
          }
        }),
      )

      if (insertOptionsError) {
        throw new Error(
          `Could not insert tack_height options for ${teamId}: ${insertOptionsError.message}`,
        )
      }
    }
  }
}

async function loadSetupMetadata(supabase, teamIds) {
  const { data: itemRows, error: itemError } = await supabase
    .from("team_setup_items")
    .select("id,team_id,key")
    .in("team_id", teamIds)
    .eq("is_active", true)

  if (itemError) {
    throw new Error(`Could not load setup items: ${itemError.message}`)
  }

  const itemByTeamAndKey = new Map()
  const itemIds = []

  for (const item of itemRows ?? []) {
    itemByTeamAndKey.set(`${item.team_id}:${item.key}`, item)
    itemIds.push(item.id)
  }

  const { data: optionRows, error: optionError } = await supabase
    .from("team_setup_item_options")
    .select("id,team_setup_item_id,value")
    .in("team_setup_item_id", itemIds)
    .eq("is_active", true)

  if (optionError) {
    throw new Error(`Could not load setup options: ${optionError.message}`)
  }

  const optionByItemAndValue = new Map()

  for (const option of optionRows ?? []) {
    optionByItemAndValue.set(`${option.team_setup_item_id}:${option.value}`, option)
  }

  return { itemByTeamAndKey, optionByItemAndValue }
}

async function applySetups(supabase, plan, sessionIdByRawId) {
  await ensureSetupMetadata(supabase, plan)
  const teamIds = [...new Set(plan.sessions.map((session) => session.targetTeamId))]
  const setupMetadata = await loadSetupMetadata(supabase, teamIds)
  const teamIdByRawSessionId = new Map(
    plan.sessions.map((session) => [session.rawId, session.targetTeamId]),
  )

  for (const setupPlan of plan.setups) {
    const sessionId = sessionIdByRawId.get(setupPlan.rawSessionId)
    const teamId = teamIdByRawSessionId.get(setupPlan.rawSessionId)

    if (!sessionId || !teamId) {
      throw new Error(`Could not resolve setup session ${setupPlan.rawSessionId}.`)
    }

    const { error: setupError } = await supabase.from("session_setups").upsert(
      {
        session_id: sessionId,
        free_notes: setupPlan.freeNotes,
      },
      { onConflict: "session_id" },
    )

    if (setupError) {
      throw new Error(`Could not upsert session setup ${setupPlan.rawSessionId}: ${setupError.message}`)
    }

    for (const itemValue of setupPlan.itemValues) {
      const setupItem = setupMetadata.itemByTeamAndKey.get(`${teamId}:${itemValue.itemKey}`)

      if (!setupItem) {
        throw new Error(`Missing setup item ${itemValue.itemKey} for team ${teamId}.`)
      }

      const { data: valueRow, error: valueError } = await supabase
        .from("session_setup_item_values")
        .upsert(
          {
            session_id: sessionId,
            team_setup_item_id: setupItem.id,
            text_value: itemValue.textValue,
          },
          { onConflict: "session_id,team_setup_item_id" },
        )
        .select("id")
        .single()

      if (valueError) {
        throw new Error(
          `Could not upsert setup value ${setupPlan.rawSessionId}/${itemValue.itemKey}: ${valueError.message}`,
        )
      }

      const { error: deleteOptionsError } = await supabase
        .from("session_setup_item_selected_options")
        .delete()
        .eq("session_setup_item_value_id", valueRow.id)

      if (deleteOptionsError) {
        throw new Error(
          `Could not replace setup options ${setupPlan.rawSessionId}/${itemValue.itemKey}: ${deleteOptionsError.message}`,
        )
      }

      if (itemValue.selectedValues.length > 0) {
        const optionRows = itemValue.selectedValues.map((selectedValue) => {
          const option = setupMetadata.optionByItemAndValue.get(`${setupItem.id}:${selectedValue}`)

          if (!option) {
            throw new Error(
              `Missing setup option ${itemValue.itemKey}=${selectedValue} for team ${teamId}.`,
            )
          }

          return {
            session_setup_item_value_id: valueRow.id,
            team_setup_item_option_id: option.id,
            allocation_percent: null,
          }
        })
        const { error: insertOptionsError } = await supabase
          .from("session_setup_item_selected_options")
          .insert(optionRows)

        if (insertOptionsError) {
          throw new Error(
            `Could not insert setup options ${setupPlan.rawSessionId}/${itemValue.itemKey}: ${insertOptionsError.message}`,
          )
        }
      }
    }
  }
}

async function findOrUpsertCatalogRow({
  supabase,
  table,
  ownerColumn,
  ownerId,
  name,
  description,
}) {
  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select("id")
    .eq(ownerColumn, ownerId)
    .ilike("name", name)
    .limit(1)

  if (existingError) {
    throw new Error(`Could not query ${table} ${name}: ${existingError.message}`)
  }

  const existing = existingRows?.[0]

  if (existing) {
    const { data, error } = await supabase
      .from(table)
      .update({ name, description, is_active: true })
      .eq("id", existing.id)
      .select("id")
      .single()

    if (error) {
      throw new Error(`Could not update ${table} ${name}: ${error.message}`)
    }

    return data.id
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ [ownerColumn]: ownerId, name, description, is_active: true })
    .select("id")
    .single()

  if (error) {
    throw new Error(`Could not insert ${table} ${name}: ${error.message}`)
  }

  return data.id
}

async function applyCatalogLinks({ supabase, plan, sessionIdByRawId, teamVenueIdByTeamVenueKey }) {
  for (const standardMove of plan.standardMoves) {
    const sessionId = sessionIdByRawId.get(standardMove.rawSessionId)
    const moveId = await findOrUpsertCatalogRow({
      supabase,
      table: "team_standard_moves",
      ownerColumn: "team_id",
      ownerId: standardMove.ownerId,
      name: standardMove.name,
      description: standardMove.description,
    })

    const { error } = await supabase.from("session_standard_moves").upsert(
      {
        session_id: sessionId,
        team_standard_move_id: moveId,
      },
      { onConflict: "session_id,team_standard_move_id" },
    )

    if (error) {
      throw new Error(`Could not link standard move ${standardMove.rawSessionId}: ${error.message}`)
    }
  }

  for (const windPattern of plan.windPatterns) {
    const sessionId = sessionIdByRawId.get(windPattern.rawSessionId)
    const teamVenueId = teamVenueIdByTeamVenueKey.get(windPattern.ownerId)

    if (!teamVenueId) {
      throw new Error(`Could not resolve team_venue for wind pattern ${windPattern.ownerId}.`)
    }

    const patternId = await findOrUpsertCatalogRow({
      supabase,
      table: "team_venue_wind_patterns",
      ownerColumn: "team_venue_id",
      ownerId: teamVenueId,
      name: windPattern.name,
      description: windPattern.description,
    })

    const { error } = await supabase.from("session_wind_patterns").upsert(
      {
        session_id: sessionId,
        team_venue_wind_pattern_id: patternId,
      },
      { onConflict: "session_id,team_venue_wind_pattern_id" },
    )

    if (error) {
      throw new Error(`Could not link wind pattern ${windPattern.rawSessionId}: ${error.message}`)
    }
  }
}

async function applyImportPlan(plan) {
  const fatalIssues = plan.issues.filter((issue) => issue.severity === "fatal")

  if (fatalIssues.length > 0) {
    throw new Error(`Cannot apply plan with fatal issues: ${fatalIssues.length}`)
  }

  const supabase = await createSupabaseClientFromEnv()
  const venueMap = await resolveDatabaseVenueMap(supabase, plan)
  const teamVenueIdByTeamVenueKey = await ensureTeamVenues(supabase, plan, venueMap)
  const teamVenueIdByCampRawId = new Map()

  for (const camp of plan.camps) {
    const venueId = venueMap.get(camp.rawVenueId)
    const teamVenueId = teamVenueIdByTeamVenueKey.get(`${camp.targetTeamId}:${venueId}`)

    if (!teamVenueId) {
      throw new Error(`Could not resolve team_venue for camp ${camp.rawId}.`)
    }

    teamVenueIdByCampRawId.set(camp.rawId, teamVenueId)
  }

  const campIdByRawId = await upsertByLegacyId({
    supabase,
    table: "camps",
    legacyColumn: "legacy_glide_row_id",
    selectColumns: "id,legacy_glide_row_id",
    rows: plan.camps.map((camp) => ({
      team_venue_id: teamVenueIdByCampRawId.get(camp.rawId),
      name: camp.name,
      camp_type: camp.campType,
      start_date: camp.startDate,
      end_date: camp.endDate,
      notes: camp.notes,
      is_active: camp.isActive,
      legacy_glide_row_id: camp.rawId,
    })),
  })

  const sessionIdByRawId = await upsertByLegacyId({
    supabase,
    table: "sessions",
    legacyColumn: "legacy_glide_row_id",
    selectColumns: "id,legacy_glide_row_id",
    rows: plan.sessions.map((session) => ({
      camp_id: campIdByRawId.get(session.rawCampId),
      session_type: session.sessionType,
      session_date: session.sessionDate,
      dock_out_at: session.dockOutAt,
      dock_in_at: session.dockInAt,
      net_time_minutes: session.netTimeMinutes,
      highlighted_by_coach: session.highlightedByCoach,
      weather_summary: null,
      goals: session.goals,
      notes: session.notes,
      legacy_glide_row_id: session.rawId,
    })),
  })

  for (const session of plan.sessions) {
    const sessionId = sessionIdByRawId.get(session.rawId)

    if (session.review.bestOfSession || session.review.toWork) {
      const { error } = await supabase.from("session_reviews").upsert(
        {
          session_id: sessionId,
          best_of_session: session.review.bestOfSession,
          to_work: session.review.toWork,
        },
        { onConflict: "session_id" },
      )

      if (error) {
        throw new Error(`Could not upsert session review ${session.rawId}: ${error.message}`)
      }
    }

    if (session.resultNotes) {
      const { error } = await supabase.from("session_regatta_results").upsert(
        {
          session_id: sessionId,
          result_notes: session.resultNotes,
        },
        { onConflict: "session_id" },
      )

      if (error) {
        throw new Error(`Could not upsert session result ${session.rawId}: ${error.message}`)
      }
    }
  }

  await applySetups(supabase, plan, sessionIdByRawId)

  const teamVenueKeyByRawVenueScope = new Map()

  for (const camp of plan.camps) {
    const venueId = venueMap.get(camp.rawVenueId)
    const teamVenueId = teamVenueIdByTeamVenueKey.get(`${camp.targetTeamId}:${venueId}`)
    teamVenueKeyByRawVenueScope.set(`${camp.targetTeamId}:${camp.rawVenueId}`, teamVenueId)
  }

  await applyCatalogLinks({
    supabase,
    plan,
    sessionIdByRawId,
    teamVenueIdByTeamVenueKey: teamVenueKeyByRawVenueScope,
  })

  return {
    appliedCamps: campIdByRawId.size,
    appliedSessions: sessionIdByRawId.size,
    appliedSetupSessions: plan.setups.length,
    appliedStandardMoveLinks: plan.standardMoves.length,
    appliedWindPatternLinks: plan.windPatterns.length,
  }
}

export function renderMarkdownReport(plan, applyResult = null) {
  const fatalIssues = plan.issues.filter((issue) => issue.severity === "fatal")
  const warnings = plan.issues.filter((issue) => issue.severity !== "fatal")
  const lines = [
    "# RAW DATA Migration Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Counts",
    "",
    `- Raw camps: ${plan.counts.rawCamps}`,
    `- Planned camps: ${plan.counts.plannedCamps}`,
    `- Raw sessions: ${plan.counts.rawSessions}`,
    `- Planned sessions: ${plan.counts.plannedSessions}`,
    `- Raw setup rows: ${plan.counts.rawSetups}`,
    `- Planned setup source rows: ${plan.counts.plannedSetupSourceRows}`,
    `- Planned setup sessions: ${plan.counts.plannedSetupSessions}`,
    `- Planned Std. Move links: ${plan.counts.plannedStandardMoveLinks}`,
    `- Planned Wind Pattern links: ${plan.counts.plannedWindPatternLinks}`,
    `- Rejected rows: ${plan.rejects.length}`,
    `- Repairs/defaults: ${plan.repairs.length}`,
    `- Fatal issues: ${fatalIssues.length}`,
    `- Warnings: ${warnings.length}`,
    "",
  ]

  if (applyResult) {
    lines.push("## Apply Result", "")

    for (const [key, value] of Object.entries(applyResult)) {
      lines.push(`- ${key}: ${value}`)
    }

    lines.push("")
  }

  lines.push("## Repairs And Defaults", "")

  if (plan.repairs.length === 0) {
    lines.push("- None")
  } else {
    for (const repair of plan.repairs) {
      lines.push(`- ${repair.code}: ${repair.rawId} - ${repair.message}`)
    }
  }

  lines.push("", "## Rejected Rows", "")

  if (plan.rejects.length === 0) {
    lines.push("- None")
  } else {
    for (const reject of plan.rejects) {
      lines.push(`- ${reject.entity}: ${reject.rawId} - ${reject.reason}`)
    }
  }

  lines.push("", "## Issues", "")

  if (plan.issues.length === 0) {
    lines.push("- None")
  } else {
    for (const issue of plan.issues) {
      lines.push(`- ${issue.severity}: ${issue.code} - ${issue.message}`)
    }
  }

  lines.push("", "## Team Mapping", "")

  for (const [rawTeamId, targetTeam] of Object.entries(TARGET_TEAMS)) {
    lines.push(`- ${rawTeamId} (${targetTeam.rawName}) -> ${targetTeam.name} ${targetTeam.id}`)
  }

  lines.push("")
  return `${lines.join("\n")}\n`
}

function parseCliArgs(argv) {
  const args = {
    rawDir: path.join(REPO_ROOT, "RAW DATA"),
    reportPath: path.join(REPO_ROOT, "reports", "raw-data-migration-report.md"),
    jsonPath: path.join(REPO_ROOT, "reports", "raw-data-migration-plan.json"),
    apply: false,
    writeReport: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--apply") {
      args.apply = true
    } else if (arg === "--dry-run") {
      args.apply = false
    } else if (arg === "--raw-dir") {
      index += 1
      args.rawDir = path.resolve(argv[index])
    } else if (arg === "--report") {
      index += 1
      args.reportPath = path.resolve(argv[index])
    } else if (arg === "--json") {
      index += 1
      args.jsonPath = path.resolve(argv[index])
    } else if (arg === "--no-report") {
      args.writeReport = false
    } else if (arg === "--help") {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function renderHelp() {
  return `Usage: node scripts/import-raw-data.mjs [--dry-run|--apply] [--raw-dir PATH] [--report PATH] [--json PATH]

Dry-run is the default. Apply mode writes camps, sessions, setup values, Std. Moves, and Wind Patterns using Supabase service credentials from environment or .env.local.`
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2))

  if (args.help) {
    console.log(renderHelp())
    return
  }

  const rawData = await loadRawData(args.rawDir)
  const plan = buildImportPlan(rawData)
  const fatalIssues = plan.issues.filter((issue) => issue.severity === "fatal")

  let applyResult = null

  if (args.apply) {
    applyResult = await applyImportPlan(plan)
  }

  if (args.writeReport) {
    await mkdir(path.dirname(args.reportPath), { recursive: true })
    await mkdir(path.dirname(args.jsonPath), { recursive: true })
    await writeFile(args.reportPath, renderMarkdownReport(plan, applyResult))
    await writeFile(args.jsonPath, `${JSON.stringify({ plan, applyResult }, null, 2)}\n`)
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        reportPath: args.writeReport ? args.reportPath : null,
        jsonPath: args.writeReport ? args.jsonPath : null,
        counts: plan.counts,
        rejects: plan.rejects.length,
        repairs: plan.repairs.length,
        fatalIssues: fatalIssues.length,
        warnings: plan.issues.length - fatalIssues.length,
        applyResult,
      },
      null,
      2,
    ),
  )

  if (fatalIssues.length > 0) {
    process.exitCode = 1
  }
}

if (process.argv[1] === __filename) {
  runCli().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
