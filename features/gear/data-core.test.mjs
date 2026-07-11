import assert from "node:assert/strict"
import test from "node:test"

import {
  TEAM_GEAR_PAGE_SIZE,
  resolveTeamGearVisibleRange,
} from "./data-core.mjs"

test("resolves bounded Team Gear desktop visible ranges", () => {
  assert.equal(TEAM_GEAR_PAGE_SIZE, 25)
  assert.deepEqual(
    resolveTeamGearVisibleRange({
      currentPage: 3,
      accumulatePages: false,
    }),
    {
      rangeStart: 50,
      rangeEnd: 74,
    },
  )
})

test("resolves accumulated Team Gear mobile visible ranges", () => {
  assert.deepEqual(
    resolveTeamGearVisibleRange({
      currentPage: 3,
      accumulatePages: true,
    }),
    {
      rangeStart: 0,
      rangeEnd: 74,
    },
  )
})
