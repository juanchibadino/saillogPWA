import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamCalendarFeedPath,
  buildTeamCalendarFeedUrl,
  canManageTeamCalendarFeed,
  normalizeCalendarFeedToken,
  resolveTeamCalendarFeedMutation,
} from "./feed-core.mjs"

const TEAM_ID = "22222222-2222-4222-8222-222222222222"
const PROFILE_ID = "33333333-3333-4333-8333-333333333333"
const TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEF1234567890_-"

test("normalizes private calendar feed tokens", () => {
  assert.equal(normalizeCalendarFeedToken(TOKEN), TOKEN)
  assert.equal(normalizeCalendarFeedToken("short"), null)
  assert.equal(normalizeCalendarFeedToken(`${TOKEN}.ics`), null)
})

test("builds subscription and download URLs", () => {
  assert.equal(
    buildTeamCalendarFeedPath(TOKEN),
    `/api/team-calendar/feed/${TOKEN}.ics`,
  )
  assert.equal(
    buildTeamCalendarFeedUrl({
      origin: "https://dockout.app",
      token: TOKEN,
      download: true,
    }),
    `https://dockout.app/api/team-calendar/feed/${TOKEN}.ics?download=1`,
  )
})

test("checks manager access against active team scope", () => {
  assert.equal(
    canManageTeamCalendarFeed({
      activeTeamId: TEAM_ID,
      targetTeamId: TEAM_ID,
      canManageTeamSessions: true,
    }),
    true,
  )
  assert.equal(
    canManageTeamCalendarFeed({
      activeTeamId: TEAM_ID,
      targetTeamId: "other-team",
      canManageTeamSessions: true,
    }),
    false,
  )
  assert.equal(
    canManageTeamCalendarFeed({
      activeTeamId: TEAM_ID,
      targetTeamId: TEAM_ID,
      canManageTeamSessions: false,
    }),
    false,
  )
})

test("reuses an active feed when generating", () => {
  const mutation = resolveTeamCalendarFeedMutation({
    mode: "ensure",
    actorProfileId: PROFILE_ID,
    teamId: TEAM_ID,
    nextToken: TOKEN,
    existingFeed: {
      id: "feed-1",
      isActive: true,
      token: "existing-token",
    },
  })

  assert.deepEqual(mutation, {
    type: "reuse",
    feed: {
      id: "feed-1",
      isActive: true,
      token: "existing-token",
    },
  })
})

test("creates a feed when none is active", () => {
  const mutation = resolveTeamCalendarFeedMutation({
    mode: "ensure",
    actorProfileId: PROFILE_ID,
    teamId: TEAM_ID,
    nextToken: TOKEN,
    existingFeed: null,
  })

  assert.deepEqual(mutation, {
    type: "create",
    nextFeed: {
      createdByProfileId: PROFILE_ID,
      teamId: TEAM_ID,
      token: TOKEN,
    },
  })
})

test("rotates an active feed and invalidates the previous row", () => {
  const mutation = resolveTeamCalendarFeedMutation({
    mode: "rotate",
    actorProfileId: PROFILE_ID,
    teamId: TEAM_ID,
    nextToken: TOKEN,
    existingFeed: {
      id: "feed-1",
      isActive: true,
      token: "existing-token",
    },
  })

  assert.deepEqual(mutation, {
    type: "rotate",
    deactivateFeedId: "feed-1",
    nextFeed: {
      createdByProfileId: PROFILE_ID,
      teamId: TEAM_ID,
      token: TOKEN,
    },
  })
})
