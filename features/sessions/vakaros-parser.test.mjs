import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  assertValidVakarosCsvFileName,
  parseVakarosCsv,
} from "./vakaros-parser.mjs"

const SAMPLE_CSV_PATH = "RAW DATA/Vakaros/saillog-main/samples/vakaros-sample(forLOCALuse).csv"

test("parses the Vakaros sample into summary, 1Hz series, and lon/lat GeoJSON", () => {
  const csv = readFileSync(SAMPLE_CSV_PATH, "utf8")
  const result = parseVakarosCsv(csv)
  const track = JSON.parse(result.trackGeojson)
  const firstCoordinate = track.features[0].geometry.coordinates[0]

  assert.equal(result.metadata.rowsRaw, 52523)
  assert.equal(result.metadata.rows1Hz, 10505)
  assert.equal(result.metadata.durationHours, 2.918)
  assert.equal(result.metadata.distanceNm, 12.351)
  assert.equal(result.metadata.avgSogKts, 4.14)
  assert.equal(result.metadata.p95SogKts, 10.2)
  assert.equal(result.metadata.maxSogKts, 15.4)
  assert.ok(Math.abs(firstCoordinate[0] - -118.1176616) < 0.0000001)
  assert.ok(Math.abs(firstCoordinate[1] - 33.7462666) < 0.0000001)
  assert.match(result.summaryCsv, /rows_raw,rows_1hz,start_at,end_at,duration_h/)
  assert.match(result.series1HzCsv, /timestamp,latitude,longitude,sog_kts,cog,hdg_true,heel,trim/)
})

test("groups rows by floored second", () => {
  const csv = [
    "timestamp,latitude,longitude,sog_kts,cog,hdg_true,heel,trim",
    "2026-01-01T00:00:00.100Z,10,20,2,30,40,5,6",
    "2026-01-01T00:00:00.900Z,12,22,4,50,60,7,8",
    "2026-01-01T00:00:01.100Z,14,24,6,70,80,9,10",
  ].join("\n")
  const result = parseVakarosCsv(csv, { geojsonSampleEvery: 1 })
  const rows = result.series1HzCsv.split("\n")

  assert.equal(result.metadata.rowsRaw, 3)
  assert.equal(result.metadata.rows1Hz, 2)
  assert.match(rows[1], /2026-01-01T00:00:00.000Z,11,21,3,40,50,6,7/)
})

test("rejects Vakaros CSV files with missing required columns", () => {
  assert.throws(
    () => parseVakarosCsv("timestamp,latitude,longitude\n2026-01-01T00:00:00Z,10,20"),
    /missing columns: sog_kts, cog, hdg_true, heel, trim/,
  )
})

test("rejects files with no valid telemetry rows", () => {
  const csv = [
    "timestamp,latitude,longitude,sog_kts,cog,hdg_true,heel,trim",
    "not-a-date,10,20,2,30,40,5,6",
  ].join("\n")

  assert.throws(() => parseVakarosCsv(csv), /no valid rows after parsing telemetry/)
})

test("validates CSV file names", () => {
  assert.equal(assertValidVakarosCsvFileName("race.csv"), true)
  assert.equal(assertValidVakarosCsvFileName("race.PDF"), false)
})
