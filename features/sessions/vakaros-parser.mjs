const REQUIRED_COLUMNS = [
  "timestamp",
  "latitude",
  "longitude",
  "sog_kts",
  "cog",
  "hdg_true",
  "heel",
  "trim",
]

const NM_PER_KM = 0.539957
const EARTH_RADIUS_KM = 6371

function parseCsvRows(csvText) {
  const text = String(csvText ?? "").replace(/^\uFEFF/, "")
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }

    if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }

    if (char === "\r") {
      continue
    }

    field += char
  }

  row.push(field)
  rows.push(row)

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0))
}

function escapeCsvCell(value) {
  const text = String(value ?? "")

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function stringifyCsv(headers, rows) {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ].join("\n")
}

function normalizeTimestamp(value) {
  return String(value ?? "")
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
}

function parseTimestamp(value) {
  const normalized = normalizeTimestamp(value)
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

function parseFiniteNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim())

  return Number.isFinite(parsed) ? parsed : null
}

function haversineKm(left, right) {
  const lat1 = (left.latitude * Math.PI) / 180
  const lon1 = (left.longitude * Math.PI) / 180
  const lat2 = (right.latitude * Math.PI) / 180
  const lon2 = (right.longitude * Math.PI) / 180
  const dlat = lat2 - lat1
  const dlon = lon2 - lon1
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
}

function round(value, decimals) {
  const factor = 10 ** decimals

  return Math.round((value + Number.EPSILON) * factor) / factor
}

function mean(values) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function quantile(values, q) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * q
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex]
  }

  const lower = sorted[lowerIndex]
  const upper = sorted[upperIndex]
  return lower + (upper - lower) * (position - lowerIndex)
}

function buildColumnIndex(headers) {
  const columnIndex = new Map()

  headers.forEach((header, index) => {
    columnIndex.set(header.trim(), index)
  })

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column))

  if (missingColumns.length > 0) {
    throw new Error(`missing columns: ${missingColumns.join(", ")}`)
  }

  return columnIndex
}

function parseTelemetryRows(csvText) {
  const rows = parseCsvRows(csvText)

  if (rows.length === 0) {
    throw new Error("missing header row")
  }

  const headers = rows[0]
  const columnIndex = buildColumnIndex(headers)
  const telemetryRows = []

  for (const cells of rows.slice(1)) {
    const timestamp = parseTimestamp(cells[columnIndex.get("timestamp")])

    if (!timestamp) {
      continue
    }

    const latitude = parseFiniteNumber(cells[columnIndex.get("latitude")])
    const longitude = parseFiniteNumber(cells[columnIndex.get("longitude")])
    const sogKts = parseFiniteNumber(cells[columnIndex.get("sog_kts")])
    const cog = parseFiniteNumber(cells[columnIndex.get("cog")])
    const hdgTrue = parseFiniteNumber(cells[columnIndex.get("hdg_true")])
    const heel = parseFiniteNumber(cells[columnIndex.get("heel")])
    const trim = parseFiniteNumber(cells[columnIndex.get("trim")])

    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      sogKts === null ||
      cog === null ||
      hdgTrue === null ||
      heel === null ||
      trim === null
    ) {
      continue
    }

    telemetryRows.push({
      timestamp,
      latitude,
      longitude,
      sog_kts: sogKts,
      cog,
      hdg_true: hdgTrue,
      heel,
      trim,
    })
  }

  if (telemetryRows.length === 0) {
    throw new Error("no valid rows after parsing telemetry")
  }

  telemetryRows.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
  return telemetryRows
}

function buildOneHzRows(rows) {
  const groups = new Map()

  for (const row of rows) {
    const second = Math.floor(row.timestamp.getTime() / 1000)
    const current = groups.get(second) ?? {
      timestampMs: second * 1000,
      count: 0,
      latitude: 0,
      longitude: 0,
      sog_kts: 0,
      cog: 0,
      hdg_true: 0,
      heel: 0,
      trim: 0,
    }

    current.count += 1
    current.latitude += row.latitude
    current.longitude += row.longitude
    current.sog_kts += row.sog_kts
    current.cog += row.cog
    current.hdg_true += row.hdg_true
    current.heel += row.heel
    current.trim += row.trim
    groups.set(second, current)
  }

  return [...groups.values()]
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .map((group) => ({
      timestamp: new Date(group.timestampMs).toISOString(),
      latitude: group.latitude / group.count,
      longitude: group.longitude / group.count,
      sog_kts: group.sog_kts / group.count,
      cog: group.cog / group.count,
      hdg_true: group.hdg_true / group.count,
      heel: group.heel / group.count,
      trim: group.trim / group.count,
    }))
}

function buildTrackGeojson(rows, sampleEvery) {
  const safeSampleEvery = Math.max(1, Math.floor(sampleEvery || 50))
  const sampledRows = rows.filter((_, index) => index % safeSampleEvery === 0)

  if (sampledRows.at(-1) !== rows.at(-1)) {
    sampledRows.push(rows.at(-1))
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Vakaros track" },
        geometry: {
          type: "LineString",
          coordinates: sampledRows.map((row) => [row.longitude, row.latitude]),
        },
      },
    ],
  }
}

export function parseVakarosCsv(csvText, options = {}) {
  const rows = parseTelemetryRows(csvText)
  const oneHzRows = buildOneHzRows(rows)
  const startAt = rows[0].timestamp
  const endAt = rows.at(-1).timestamp
  const durationHours = (endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000)
  let distanceKm = 0

  for (let index = 1; index < rows.length; index += 1) {
    distanceKm += haversineKm(rows[index - 1], rows[index])
  }

  const sogValues = rows.map((row) => row.sog_kts)
  const metadata = {
    rowsRaw: rows.length,
    rows1Hz: oneHzRows.length,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    durationHours: round(durationHours, 3),
    distanceNm: round(distanceKm * NM_PER_KM, 3),
    avgSogKts: round(mean(sogValues), 2),
    p95SogKts: round(quantile(sogValues, 0.95), 2),
    maxSogKts: round(Math.max(...sogValues), 2),
  }
  const summaryCsv = stringifyCsv(
    [
      "rows_raw",
      "rows_1hz",
      "start_at",
      "end_at",
      "duration_h",
      "distance_nm",
      "avg_sog_kts",
      "p95_sog_kts",
      "max_sog_kts",
    ],
    [
      {
        rows_raw: metadata.rowsRaw,
        rows_1hz: metadata.rows1Hz,
        start_at: metadata.startAt,
        end_at: metadata.endAt,
        duration_h: metadata.durationHours,
        distance_nm: metadata.distanceNm,
        avg_sog_kts: metadata.avgSogKts,
        p95_sog_kts: metadata.p95SogKts,
        max_sog_kts: metadata.maxSogKts,
      },
    ],
  )
  const series1HzCsv = stringifyCsv(
    ["timestamp", "latitude", "longitude", "sog_kts", "cog", "hdg_true", "heel", "trim"],
    oneHzRows,
  )
  const trackGeojson = JSON.stringify(
    buildTrackGeojson(rows, options.geojsonSampleEvery ?? 50),
  )

  return {
    metadata,
    series1HzCsv,
    summaryCsv,
    trackGeojson,
  }
}

export function assertValidVakarosCsvFileName(fileName) {
  return String(fileName ?? "").trim().toLowerCase().endsWith(".csv")
}

export const VAKAROS_REQUIRED_COLUMNS = REQUIRED_COLUMNS
