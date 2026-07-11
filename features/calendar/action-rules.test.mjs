import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCalendarActionRedirectPath,
  canEditCalendarPresence,
  isCalendarDateWithinRange,
  isCalendarTargetInScope,
  normalizeCalendarActionReturnPath,
  validateCalendarDateRange,
} from "./action-rules.mjs"

test("allows self presence edits", () => {
  assert.equal(
    canEditCalendarPresence({
      currentProfileId: "profile-1",
      targetProfileId: "profile-1",
      canManageAnyPresence: false,
    }),
    true,
  )
})

test("allows managers to edit another profile presence", () => {
  assert.equal(
    canEditCalendarPresence({
      currentProfileId: "coach-1",
      targetProfileId: "crew-1",
      canManageAnyPresence: true,
    }),
    true,
  )
})

test("blocks non-managers from editing another profile presence", () => {
  assert.equal(
    canEditCalendarPresence({
      currentProfileId: "crew-1",
      targetProfileId: "crew-2",
      canManageAnyPresence: false,
    }),
    false,
  )
})

test("validates calendar date ranges and presence dates", () => {
  assert.equal(
    validateCalendarDateRange({
      startDate: "2026-06-23",
      endDate: "2026-06-29",
    }),
    true,
  )
  assert.equal(
    validateCalendarDateRange({
      startDate: "2026-06-29",
      endDate: "2026-06-23",
    }),
    false,
  )
  assert.equal(
    isCalendarDateWithinRange({
      date: "2026-06-29",
      startDate: "2026-06-23",
      endDate: "2026-06-29",
    }),
    true,
  )
  assert.equal(
    isCalendarDateWithinRange({
      date: "2026-06-30",
      startDate: "2026-06-23",
      endDate: "2026-06-29",
    }),
    false,
  )
})

test("rejects cross-team targets", () => {
  assert.equal(
    isCalendarTargetInScope({
      targetTeamId: "team-1",
      scopeTeamId: "team-1",
    }),
    true,
  )
  assert.equal(
    isCalendarTargetInScope({
      targetTeamId: "team-2",
      scopeTeamId: "team-1",
    }),
    false,
  )
})

test("normalizes safe calendar return paths and rejects external paths", () => {
  assert.equal(
    normalizeCalendarActionReturnPath("/team-calendar?org=org-1&team=team-1"),
    "/team-calendar?org=org-1&team=team-1",
  )
  assert.equal(normalizeCalendarActionReturnPath("https://example.com/team-calendar"), null)
  assert.equal(normalizeCalendarActionReturnPath("/team-camps"), null)
})

test("builds calendar action redirects against sanitized return path", () => {
  assert.equal(
    buildCalendarActionRedirectPath({
      returnPath: "/team-calendar?org=old&team=old&status=old",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      status: "event_deleted",
    }),
    "/team-calendar?org=org-1&team=team-1&status=event_deleted",
  )

  assert.equal(
    buildCalendarActionRedirectPath({
      returnPath: "/team-calendar?org=old&team=old&time=past",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      timeFilter: "future",
      status: "event_deleted",
    }),
    "/team-calendar?org=org-1&team=team-1&status=event_deleted",
  )

  assert.equal(
    buildCalendarActionRedirectPath({
      returnPath: "/team-calendar?org=old&team=old",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      timeFilter: "all",
      status: "event_deleted",
    }),
    "/team-calendar?org=org-1&team=team-1&time=all&status=event_deleted",
  )
})
