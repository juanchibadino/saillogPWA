import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamCalendarHref,
  resolveTeamCalendarListRequest,
} from "./list-route-state.mjs"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const TEAM_ID = "22222222-2222-4222-8222-222222222222"
const MEMBER_ID = "33333333-3333-4333-8333-333333333333"
const CAMP_ID = "44444444-4444-4444-8444-444444444444"
const EVENT_ID = "55555555-5555-4555-8555-555555555555"

test("normalizes invalid calendar time, member, and event params safely", () => {
  assert.deepEqual(
    resolveTeamCalendarListRequest({
      eventParam: "camp:not-a-uuid",
      memberParam: "profile-1",
      timeParam: "past",
    }),
    {
      requestedEventFilter: undefined,
      requestedMemberId: undefined,
      requestedTimeFilter: "future",
    },
  )
})

test("accepts valid member, camp event, custom event, and all filter", () => {
  assert.deepEqual(
    resolveTeamCalendarListRequest({
      eventParam: `camp:${CAMP_ID}`,
      memberParam: MEMBER_ID,
      timeParam: "all",
    }),
    {
      requestedEventFilter: {
        sourceType: "camp",
        sourceId: CAMP_ID,
        value: `camp:${CAMP_ID}`,
      },
      requestedMemberId: MEMBER_ID,
      requestedTimeFilter: "all",
    },
  )

  assert.deepEqual(
    resolveTeamCalendarListRequest({
      eventParam: `event:${EVENT_ID}`,
      memberParam: undefined,
      timeParam: "future",
    }).requestedEventFilter,
    {
      sourceType: "event",
      sourceId: EVENT_ID,
      value: `event:${EVENT_ID}`,
    },
  )
})

test("builds calendar href preserving scope and omitting default future param", () => {
  assert.equal(
    buildTeamCalendarHref({
      scope: {
        activeOrgId: ORG_ID,
        activeTeamId: TEAM_ID,
      },
    }),
    `/team-calendar?org=${ORG_ID}&team=${TEAM_ID}`,
  )
})

test("builds calendar href with member, event, all time, and feedback params", () => {
  assert.equal(
    buildTeamCalendarHref({
      scope: {
        activeOrgId: ORG_ID,
        activeTeamId: TEAM_ID,
      },
      memberId: MEMBER_ID,
      eventFilter: {
        sourceType: "event",
        sourceId: EVENT_ID,
        value: `event:${EVENT_ID}`,
      },
      timeFilter: "all",
      status: "event_deleted",
    }),
    `/team-calendar?org=${ORG_ID}&team=${TEAM_ID}&member=${MEMBER_ID}&event=event%3A${EVENT_ID}&time=all&status=event_deleted`,
  )
})
