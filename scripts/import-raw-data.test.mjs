import assert from "node:assert/strict"
import test from "node:test"

import { buildImportPlan } from "./import-raw-data.mjs"

const AMERICA_ORG = "oSZO4yW.Sh6RI97xh.LkkA"
const USA49_RAW_TEAM = "zljrb594SuerA7VAKO8wEw"
const USA31_RAW_TEAM = "vdpZwd6QRd2i0NFueuPXOA"
const USA49_TEAM_ID = "de059290-d0f0-4b76-8468-9d6367d1962a"
const USA31_TEAM_ID = "48802935-b272-430c-bf55-1e588295ef08"

function makeRawData(overrides = {}) {
  const rawData = {
    teams: [
      {
        team_id: USA31_RAW_TEAM,
        "ORG / org_id": AMERICA_ORG,
        team_name: "USA 49er",
        team_Image: "",
      },
      {
        team_id: USA49_RAW_TEAM,
        "ORG / org_id": AMERICA_ORG,
        team_name: "USA 49erFX",
        team_Image: "",
      },
    ],
    venues: [
      {
        venue_id: "raw-venue-usa49",
        "GENERAL DATA / Name": "Eckernforde",
        "GENERAL DATA / team_id": USA49_RAW_TEAM,
        "ASSESS / assessment_created": "",
        "Goals (Deprecated)": "",
      },
      {
        venue_id: "raw-venue-usa31",
        "GENERAL DATA / Name": "Euro Venue",
        "GENERAL DATA / team_id": USA31_RAW_TEAM,
        "ASSESS / assessment_created": "",
        "Goals (Deprecated)": "",
      },
    ],
    camps: [],
    sessions: [],
    setups: [],
    users: [
      {
        "GENERAL / user_id": "raw-user",
        "GENERAL / role": "Crew",
        "GENERAL / Email": "crew@example.com",
      },
    ],
    images: [],
  }

  return {
    ...rawData,
    ...overrides,
  }
}

function makeSetupRow(overrides = {}) {
  return {
    daily_metrics_id: "setup-1",
    session_id: "session-1",
    user_id: "raw-user",
    created_time: "2/6/2025, 9:00:00 p. m.",
    venue: "",
    TWD: "SW",
    "TWS New (Deprecated)": "",
    "TWS New V3": "DT 5-8",
    "TWS-": "5",
    "TWS+": "8",
    sea_state: "chop",
    type_of_day: "Offshore",
    primaries: "",
    lowers: "",
    caps: "",
    board: "",
    bridle: "",
    outhaul: "",
    track: "",
    clew: "",
    tack_height: "6",
    course_area: "Outer loop",
    free_notes: "Fast setup",
    conditions: "",
    current: "Flood tide",
    vang: "",
    cunningham: "",
    ...overrides,
  }
}

test("repairs blank camp team from venue scope and keeps catalog links scoped", () => {
  const plan = buildImportPlan(
    makeRawData({
      camps: [
        {
          camp_id: "RXA.znw9RYyp8VYWgR98EA",
          "VENUE / venue_id": "raw-venue-usa49",
          team_id: "",
          Name: "Eckernforde",
          start_date: "29/6/2026, 12:00:00 a. m.",
          end_date: "6/7/2026, 12:00:00 a. m.",
          location: "",
          goals: "",
          achieved: "",
          assessment_created: "",
          why: "",
          closed: "",
        },
      ],
      sessions: [
        {
          session_id: "session-1",
          "GENERAL / Type": "Training",
          "CAMP / camp_id": "RXA.znw9RYyp8VYWgR98EA",
          "TIME DATA / start_time": "4/7/2026, 4:18:00 a. m.",
          "TIME DATA / end_time": "4/7/2026, 6:18:00 a. m.",
          "ASSESS / goals": "",
          "ASSESS / highlighted": "",
          "ASSESS / best": "",
          "ASSESS / To Work": "",
          "ASSESS / assessment_boolean": "",
          "GENERAL / Results": "",
          "ASSESS / Standard move": "Return to the preferred side after the start.",
          audionotes: "",
          "ASSESS / Wind Pattern": "Lefty was safer.",
        },
      ],
      setups: [makeSetupRow({ created_time: "4/7/2026, 7:00:00 a. m." })],
    }),
  )

  assert.equal(plan.issues.length, 0)
  assert.equal(plan.counts.plannedCamps, 1)
  assert.equal(plan.camps[0].targetTeamId, USA49_TEAM_ID)
  assert.equal(plan.standardMoves[0].ownerId, USA49_TEAM_ID)
  assert.equal(plan.windPatterns[0].ownerId, `${USA49_TEAM_ID}:raw-venue-usa49`)
  assert.ok(plan.repairs.some((repair) => repair.code === "camp_team_repaired_from_venue"))

  const setup = plan.setups[0]
  assert.deepEqual(
    setup.itemValues.find((item) => item.itemKey === "tack_height")?.selectedValues,
    ["6"],
  )
  assert.equal(
    setup.itemValues.find((item) => item.itemKey === "course_area")?.textValue,
    "Outer loop",
  )
  assert.equal(setup.itemValues.find((item) => item.itemKey === "currents")?.textValue, "Flood tide")
  assert.match(setup.freeNotes, /TWS raw range: 5-8/)
})

test("prefers day-first camp dates and widens range from child sessions", () => {
  const plan = buildImportPlan(
    makeRawData({
      camps: [
        {
          camp_id: "camp-euro",
          "VENUE / venue_id": "raw-venue-usa31",
          team_id: USA31_RAW_TEAM,
          Name: "Euro 49er",
          start_date: "3/6/2025, 12:00:00 a. m.",
          end_date: "8/6/2025, 12:00:00 a. m.",
          location: "",
          goals: "",
          achieved: "",
          assessment_created: "",
          why: "",
          closed: "",
        },
      ],
      sessions: [
        {
          session_id: "session-1",
          "GENERAL / Type": "Regatta",
          "CAMP / camp_id": "camp-euro",
          "TIME DATA / start_time": "2/6/2025, 7:05:00 p. m.",
          "TIME DATA / end_time": "6/2/2025, 8:03:00 PM",
          "ASSESS / goals": "",
          "ASSESS / highlighted": "",
          "ASSESS / best": "",
          "ASSESS / To Work": "",
          "ASSESS / assessment_boolean": "",
          "GENERAL / Results": "",
          "ASSESS / Standard move": "",
          audionotes: "",
          "ASSESS / Wind Pattern": "",
        },
      ],
      setups: [],
    }),
  )

  assert.equal(plan.camps[0].startDate, "2025-06-02")
  assert.equal(plan.camps[0].endDate, "2025-06-08")
  assert.equal(plan.sessions[0].dockInAt, "2025-06-02T20:03:00.000Z")
  assert.equal(plan.sessions[0].netTimeMinutes, 58)
  assert.equal(plan.sessions[0].targetTeamId, USA31_TEAM_ID)
})

test("rejects the explicit orphan session and setup rows", () => {
  const plan = buildImportPlan(
    makeRawData({
      sessions: [
        {
          session_id: "a.A6YXeaLQTK9eSJA1IKi5w",
          "GENERAL / Type": "Training",
          "CAMP / camp_id": "",
          "TIME DATA / start_time": "19/5/2025, 9:25:00 a. m.",
          "TIME DATA / end_time": "19/5/2025, 1:25:00 a. m.",
          "ASSESS / goals": "",
          "ASSESS / highlighted": "",
          "ASSESS / best": "",
          "ASSESS / To Work": "",
          "ASSESS / assessment_boolean": "",
          "GENERAL / Results": "",
          "ASSESS / Standard move": "",
          audionotes: "",
          "ASSESS / Wind Pattern": "",
        },
      ],
      setups: [
        makeSetupRow({
          daily_metrics_id: "zEq-QLN1RcO3isn2mnpKQQ",
          session_id: "j.Rir4KcRZa26uXJXoKkag",
        }),
      ],
    }),
  )

  assert.deepEqual(
    plan.rejects.map((reject) => `${reject.entity}:${reject.rawId}:${reject.reason}`),
    [
      "session:a.A6YXeaLQTK9eSJA1IKi5w:blank_camp_id_default_reject",
      "setup:zEq-QLN1RcO3isn2mnpKQQ:session_not_found_in_raw_sessions:j.Rir4KcRZa26uXJXoKkag",
    ],
  )
})
