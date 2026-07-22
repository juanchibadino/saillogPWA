import assert from "node:assert/strict"
import { test } from "node:test"

import {
  VAKAROS_SAVED_TRIM_BUOYS_PAYLOAD_MAX_LENGTH,
  normalizeVakarosSavedTrimInput,
} from "./vakaros-saved-trims.mjs"

test("accepts a valid saved Vakaros trim with buoys", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "  Windward gate  ",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: JSON.stringify([
      { id: "a", lat: 33.7, lon: -118.1, mode: "windward" },
      { id: "b", lat: 33.8, lon: -118.2, mode: "leeward" },
    ]),
  })

  assert.deepEqual(result, {
    name: "Windward gate",
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoys: [
      { id: "a", lat: 33.7, lon: -118.1, mode: "windward" },
      { id: "b", lat: 33.8, lon: -118.2, mode: "leeward" },
    ],
  })
})

test("rejects reversed trim ranges", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 50,
    trimEndIndex: 10,
    buoysPayload: "[]",
  })

  assert.equal(result, null)
})

test("rejects invalid identifiers", () => {
  const result = normalizeVakarosSavedTrimInput({
    sessionId: "not-a-uuid",
    uploadId: "00000000-0000-4000-8000-000000000000",
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: "[]",
  })

  assert.equal(result, null)
})

test("rejects out-of-range buoy coordinates", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: JSON.stringify([{ id: "a", lat: 91, lon: -118.1, mode: "windward" }]),
  })

  assert.equal(result, null)
})

test("rejects invalid buoy modes", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: JSON.stringify([{ id: "a", lat: 33.7, lon: -118.1, mode: "offset" }]),
  })

  assert.equal(result, null)
})

test("rejects trim ranges outside the uploaded series", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 49,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: "[]",
  })

  assert.equal(result, null)
})

test("rejects oversized buoy payloads", () => {
  const result = normalizeVakarosSavedTrimInput({
    name: "Trim 1",
    fallbackName: "Trim 1",
    maxIndex: 99,
    trimStartIndex: 10,
    trimEndIndex: 50,
    buoysPayload: `[${" ".repeat(VAKAROS_SAVED_TRIM_BUOYS_PAYLOAD_MAX_LENGTH)}]`,
  })

  assert.equal(result, null)
})
