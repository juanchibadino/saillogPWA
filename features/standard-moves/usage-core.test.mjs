import assert from "node:assert/strict"
import test from "node:test"

import { buildStandardMoveCampUsage } from "./usage-core.mjs"

const MOVE_1 = "move-1"
const MOVE_2 = "move-2"
const CAMP_1 = "camp-1"
const CAMP_2 = "camp-2"
const SESSION_1 = "session-1"
const SESSION_2 = "session-2"
const SESSION_3 = "session-3"

function buildUsage(overrides = {}) {
  return buildStandardMoveCampUsage({
    standardMoveId: MOVE_1,
    usageRows: [
      {
        session_id: SESSION_1,
        team_standard_move_id: MOVE_1,
      },
      {
        session_id: SESSION_2,
        team_standard_move_id: MOVE_1,
      },
      {
        session_id: SESSION_3,
        team_standard_move_id: MOVE_2,
      },
    ],
    sessionRows: [
      {
        camp_id: CAMP_1,
        id: SESSION_1,
        session_date: "2026-07-19T10:00:00.000Z",
      },
      {
        camp_id: CAMP_1,
        id: SESSION_2,
        session_date: "2026-07-20T10:00:00.000Z",
      },
      {
        camp_id: CAMP_2,
        id: SESSION_3,
        session_date: "2026-07-21T10:00:00.000Z",
      },
    ],
    campRows: [
      {
        id: CAMP_1,
        name: "Camp Alpha",
      },
      {
        id: CAMP_2,
        name: "Camp Bravo",
      },
    ],
    ...overrides,
  })
}

test("groups multiple sessions in one camp into one camp badge with count", () => {
  assert.deepEqual(buildUsage(), {
    itemId: MOVE_1,
    usageCount: 2,
    camps: [
      {
        id: CAMP_1,
        name: "Camp Alpha",
        usageCount: 2,
      },
    ],
  })
})

test("sorts camps by latest session usage, then name", () => {
  const result = buildUsage({
    usageRows: [
      {
        session_id: SESSION_1,
        team_standard_move_id: MOVE_1,
      },
      {
        session_id: SESSION_2,
        team_standard_move_id: MOVE_1,
      },
      {
        session_id: SESSION_3,
        team_standard_move_id: MOVE_1,
      },
    ],
    sessionRows: [
      {
        camp_id: CAMP_1,
        id: SESSION_1,
        session_date: "2026-07-18T10:00:00.000Z",
      },
      {
        camp_id: CAMP_2,
        id: SESSION_2,
        session_date: "2026-07-21T10:00:00.000Z",
      },
      {
        camp_id: "camp-3",
        id: SESSION_3,
        session_date: "2026-07-21T10:00:00.000Z",
      },
    ],
    campRows: [
      {
        id: CAMP_1,
        name: "Zulu Camp",
      },
      {
        id: CAMP_2,
        name: "Bravo Camp",
      },
      {
        id: "camp-3",
        name: "Alpha Camp",
      },
    ],
  })

  assert.deepEqual(result.camps, [
    {
      id: "camp-3",
      name: "Alpha Camp",
      usageCount: 1,
    },
    {
      id: CAMP_2,
      name: "Bravo Camp",
      usageCount: 1,
    },
    {
      id: CAMP_1,
      name: "Zulu Camp",
      usageCount: 1,
    },
  ])
})

test("returns empty camps and zero count when there is no usage", () => {
  assert.deepEqual(buildUsage({ usageRows: [] }), {
    itemId: MOVE_1,
    usageCount: 0,
    camps: [],
  })
})
