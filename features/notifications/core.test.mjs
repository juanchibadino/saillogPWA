import assert from "node:assert/strict"
import test from "node:test"

import {
  applyNotificationDelete,
  applyNotificationMarkAllRead,
  applyNotificationReadState,
  buildAssessmentRequestMessage,
  buildCampGoalsMessage,
  buildGearAlertMessage,
  buildScopedNotificationHref,
  buildSessionReviewFieldLabel,
  buildSessionUpdateMessage,
  formatActorName,
  formatSessionLabel,
  joinCampNames,
  shouldNotifyTextAdded,
} from "./core.mjs"

test("detects blank-to-non-empty notification triggers", () => {
  assert.equal(shouldNotifyTextAdded(null, "Goals for the camp"), true)
  assert.equal(shouldNotifyTextAdded("   ", "Best session notes"), true)
  assert.equal(shouldNotifyTextAdded("Existing goals", "Updated goals"), false)
  assert.equal(shouldNotifyTextAdded(null, "   "), false)
  assert.equal(shouldNotifyTextAdded("Existing goals", ""), false)
})

test("builds final human notification copy", () => {
  assert.equal(
    buildCampGoalsMessage({
      actorName: "Alex Coach",
      campName: "Miami Camp",
    }),
    "Alex Coach just uploaded the goals for Miami Camp. Check them out.",
  )
  assert.equal(
    buildSessionUpdateMessage({
      actorName: "Alex Coach",
      fieldLabel: "Best/To Work",
      sessionLabel: "Jul 11, 2026 9:00 AM",
    }),
    "Alex Coach just added Best/To Work for Jul 11, 2026 9:00 AM Session. Review the update.",
  )
  assert.equal(
    buildAssessmentRequestMessage({
      actorName: "Alex Coach",
      venueName: "Marseille",
      campNames: "Camp Alpha & Camp Beta",
    }),
    "Alex Coach is asking you to complete the Marseille assessment for Camp Alpha & Camp Beta. Complete it.",
  )
  assert.equal(
    buildGearAlertMessage({
      gearName: "Sail SN1020",
      alertState: "warning",
    }),
    "Sail SN1020 is in warning mode. Review the Gear thresholds.",
  )
})

test("builds scoped target hrefs for camp session and assessment notifications", () => {
  assert.equal(
    buildScopedNotificationHref({
      pathname: "/team-camps/camp-1",
      orgId: "org-1",
      teamId: "team-1",
      tab: "goals",
    }),
    "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
  )
  assert.equal(
    buildScopedNotificationHref({
      pathname: "/team-sessions/session-1",
      orgId: "org-1",
      teamId: "team-1",
      tab: "info",
    }),
    "/team-sessions/session-1?org=org-1&team=team-1&tab=info",
  )
  assert.equal(
    buildScopedNotificationHref({
      pathname: "/team-assessments/run-1",
      orgId: "org-1",
      teamId: "team-1",
    }),
    "/team-assessments/run-1?org=org-1&team=team-1",
  )
  assert.equal(
    buildScopedNotificationHref({
      pathname: "/team-gear",
      orgId: "org-1",
      teamId: "team-1",
      extraParams: {
        alert: "critical",
      },
    }),
    "/team-gear?org=org-1&team=team-1&alert=critical",
  )
})

test("formats notification names and labels defensively", () => {
  assert.equal(
    formatActorName({
      firstName: "Alex",
      lastName: "Coach",
      email: "alex@example.com",
    }),
    "Alex Coach",
  )
  assert.equal(formatActorName({ email: "crew@example.com" }), "crew@example.com")
  assert.equal(formatActorName({}), "A team member")
  assert.equal(joinCampNames(["Alpha", "Beta", "Gamma"]), "Alpha, Beta & Gamma")
  assert.equal(joinCampNames(["Alpha", "Beta"]), "Alpha & Beta")
  assert.equal(joinCampNames([]), "the selected camps")
  assert.equal(
    buildSessionReviewFieldLabel({ bestAdded: true, toWorkAdded: true }),
    "Best/To Work",
  )
  assert.equal(
    buildSessionReviewFieldLabel({ bestAdded: true, toWorkAdded: false }),
    "Best",
  )
  assert.equal(
    formatSessionLabel({
      sessionDate: "2026-07-11",
      dockOutAt: "2026-07-11T09:00:00.000Z",
    }),
    "Jul 11, 2026 9:00 AM",
  )
})

test("applies optimistic notification action state changes", () => {
  const initialState = {
    unreadCount: 2,
    notifications: [
      {
        id: "notification-1",
        readAt: null,
        message: "Unread",
      },
      {
        id: "notification-2",
        readAt: "2026-07-11T10:00:00.000Z",
        message: "Read",
      },
      {
        id: "notification-3",
        readAt: null,
        message: "Unread",
      },
    ],
  }

  const readState = applyNotificationReadState(
    initialState,
    "notification-1",
    "2026-07-11T11:00:00.000Z",
  )
  assert.equal(readState.unreadCount, 1)
  assert.equal(readState.notifications[0].readAt, "2026-07-11T11:00:00.000Z")

  const unreadState = applyNotificationReadState(readState, "notification-2", null)
  assert.equal(unreadState.unreadCount, 2)
  assert.equal(unreadState.notifications[1].readAt, null)

  const deletedState = applyNotificationDelete(unreadState, "notification-3")
  assert.equal(deletedState.unreadCount, 1)
  assert.deepEqual(
    deletedState.notifications.map((notification) => notification.id),
    ["notification-1", "notification-2"],
  )

  const allReadState = applyNotificationMarkAllRead(
    unreadState,
    "2026-07-11T12:00:00.000Z",
  )
  assert.equal(allReadState.unreadCount, 0)
  assert.deepEqual(
    allReadState.notifications.map((notification) => notification.readAt),
    [
      "2026-07-11T11:00:00.000Z",
      "2026-07-11T12:00:00.000Z",
      "2026-07-11T12:00:00.000Z",
    ],
  )
})
