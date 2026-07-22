export const VAKAROS_SAVED_TRIM_MAX_BUOYS = 40
export const VAKAROS_SAVED_TRIM_MAX_NAME_LENGTH = 120
export const VAKAROS_SAVED_TRIM_BUOYS_PAYLOAD_MAX_LENGTH = 20000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeNameValue(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\s+/g, " ")

  if (
    normalized.length === 0 ||
    normalized.length > VAKAROS_SAVED_TRIM_MAX_NAME_LENGTH
  ) {
    return null
  }

  return normalized
}

function isFiniteInteger(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)
}

function isOptionalUuid(value) {
  return typeof value === "undefined" || (typeof value === "string" && UUID_PATTERN.test(value))
}

function normalizeBuoyId(value, index) {
  if (typeof value !== "string") {
    return `buoy-${index + 1}`
  }

  const normalized = value.trim()

  if (normalized.length === 0 || normalized.length > 120) {
    return `buoy-${index + 1}`
  }

  return normalized
}

export function normalizeVakarosSavedTrimName(value, fallbackName) {
  const normalizedName = normalizeNameValue(value)

  if (normalizedName) {
    return normalizedName
  }

  return normalizeNameValue(fallbackName) ?? "Trim"
}

export function normalizeVakarosSavedTrimBuoys(value) {
  if (!Array.isArray(value) || value.length > VAKAROS_SAVED_TRIM_MAX_BUOYS) {
    return null
  }

  const buoys = []

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]

    if (!item || typeof item !== "object") {
      return null
    }

    const mode = item.mode
    const lat = item.lat
    const lon = item.lon

    if (mode !== "windward" && mode !== "leeward") {
      return null
    }

    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return null
    }

    buoys.push({
      id: normalizeBuoyId(item.id, index),
      lat,
      lon,
      mode,
    })
  }

  return buoys
}

export function parseVakarosSavedTrimBuoysPayload(value) {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > VAKAROS_SAVED_TRIM_BUOYS_PAYLOAD_MAX_LENGTH
  ) {
    return null
  }

  let parsed

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  return normalizeVakarosSavedTrimBuoys(parsed)
}

export function normalizeVakarosSavedTrimInput(input) {
  if (!input || typeof input !== "object") {
    return null
  }

  const trimStartIndex = input.trimStartIndex
  const trimEndIndex = input.trimEndIndex
  const maxIndex = input.maxIndex

  if (
    !isOptionalUuid(input.sessionId) ||
    !isOptionalUuid(input.uploadId) ||
    !isOptionalUuid(input.savedTrimId) ||
    !isFiniteInteger(trimStartIndex) ||
    !isFiniteInteger(trimEndIndex) ||
    !isFiniteInteger(maxIndex) ||
    trimStartIndex < 0 ||
    trimEndIndex < trimStartIndex ||
    maxIndex < 0 ||
    trimEndIndex > maxIndex
  ) {
    return null
  }

  const buoys = parseVakarosSavedTrimBuoysPayload(input.buoysPayload)

  if (!buoys) {
    return null
  }

  return {
    name: normalizeVakarosSavedTrimName(input.name, input.fallbackName),
    trimStartIndex,
    trimEndIndex,
    buoys,
  }
}
