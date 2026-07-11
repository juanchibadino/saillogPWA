import assert from "node:assert/strict"
import test from "node:test"

import { buildTeamCalendarTimeline } from "./timeline-core.mjs"

const CAMP = {
  id: "camp-1",
  sourceType: "camp",
  title: "Camp X",
  eventType: "camp",
  startDate: "2026-06-23",
  endDate: "2026-06-29",
}

const NEXT_CAMP = {
  id: "camp-2",
  sourceType: "camp",
  title: "Camp XX",
  eventType: "camp",
  startDate: "2026-07-04",
  endDate: "2026-07-04",
}

const MEETING = {
  id: "event-1",
  sourceType: "event",
  title: "Organization meeting",
  eventType: "meeting",
  startDate: "2026-06-25",
  endDate: "2026-06-25",
}

test("future timeline starts at today and excludes previous days", () => {
  const items = buildTeamCalendarTimeline({
    sources: [CAMP, NEXT_CAMP],
    today: "2026-06-27",
    timeFilter: "future",
  })

  assert.equal(items[0].type, "day")
  assert.equal(items[0].date, "2026-06-27")
  assert.equal(items.some((item) => item.type === "day" && item.date === "2026-06-26"), false)
})

test("all timeline starts at the first day of the current year", () => {
  const items = buildTeamCalendarTimeline({
    sources: [CAMP, NEXT_CAMP],
    today: "2026-06-27",
    timeFilter: "all",
  })
  const dayRows = items.filter((item) => item.type === "day")

  assert.deepEqual(items[0], {
    type: "gap",
    timelineId: "gap:2026-01-01:2026-06-22",
    startDate: "2026-01-01",
    endDate: "2026-06-22",
  })
  assert.deepEqual(
    dayRows.map((item) => item.date),
    [
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
      "2026-07-04",
    ],
  )
})

test("multi-day camps expand into one row per impacted day", () => {
  const items = buildTeamCalendarTimeline({
    sources: [CAMP],
    today: "2026-06-23",
    timeFilter: "future",
  }).filter((item) => item.type === "day")

  assert.equal(items.length, 7)
  assert.equal(items[0].isFirstDay, true)
  assert.equal(items.at(-1).isLastDay, true)
})

test("empty future gaps collapse into a single gap row", () => {
  const items = buildTeamCalendarTimeline({
    sources: [CAMP, NEXT_CAMP],
    today: "2026-06-29",
    timeFilter: "future",
  })
  const gap = items.find((item) => item.type === "gap")

  assert.deepEqual(gap, {
    type: "gap",
    timelineId: "gap:2026-06-30:2026-07-03",
    startDate: "2026-06-30",
    endDate: "2026-07-03",
  })
})

test("event filter limits rows and member target presence is calculated", () => {
  const items = buildTeamCalendarTimeline({
    sources: [CAMP, MEETING],
    today: "2026-06-23",
    timeFilter: "future",
    selectedEventFilter: {
      sourceType: "event",
      sourceId: "event-1",
      value: "event:event-1",
    },
    targetProfileId: "member-1",
    presenceBySourceDate: {
      "event:event-1": {
        "2026-06-25": ["member-1", "member-2"],
      },
    },
  })

  assert.equal(items.length, 2)
  assert.equal(items[0].type, "gap")
  assert.equal(items[1].sourceType, "event")
  assert.equal(items[1].isTargetPresent, true)
  assert.deepEqual(items[1].presentProfileIds, ["member-1", "member-2"])
})
