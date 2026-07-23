import assert from "node:assert/strict"
import test from "node:test"

import {
  applyNotificationDelete,
  applyNotificationMarkAllRead,
  applyNotificationReadState,
  buildAssessmentRunEmailPayload,
  buildAssessmentRunNotificationRows,
  buildAssessmentRunPushPayload,
  buildAssessmentRunTargetHref,
  buildAssessmentRequestMessage,
  buildCampGoalsMessage,
  buildGearAlertMessage,
  buildScopedNotificationHref,
  buildSessionReviewFieldLabel,
  buildSessionUpdateMessage,
  formatActorName,
  getNotificationEventTitle,
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
    "Sail SN1020 is past due and needs review.",
  )
  assert.equal(
    buildGearAlertMessage({
      gearName: "Sail SN1020",
      alertState: "critical",
    }),
    "Sail SN1020 is approaching its usage limit.",
  )
})

test("builds notification titles with Gear threshold naming", () => {
  assert.equal(getNotificationEventTitle("gear_critical"), "Gear near limit")
  assert.equal(getNotificationEventTitle("gear_warning"), "Gear past due")
  assert.equal(getNotificationEventTitle("session_review_added"), "Session update")
  assert.equal(getNotificationEventTitle("unknown"), "Notification")
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
  assert.equal(
    buildAssessmentRunTargetHref({
      assessmentRunId: "run-2",
      orgId: "org-1",
      teamId: "team-1",
    }),
    "/team-assessments/run-2?org=org-1&team=team-1",
  )
})

test("builds and dedupes assessment run notification rows", () => {
  const rows = buildAssessmentRunNotificationRows({
    actorName: "Alex Coach",
    actorProfileId: "profile-actor",
    assessmentRunId: "run-1",
    campIds: ["camp-1", "camp-2"],
    campNames: "Camp Alpha & Camp Beta",
    existingRows: [
      {
        event_type: "assessment_run_created",
        metadata: {
          assessmentRunId: "run-1",
        },
        recipient_profile_id: "profile-crew-1",
      },
      {
        event_type: "assessment_run_created",
        metadata: {
          assessmentRunId: "run-2",
        },
        recipient_profile_id: "profile-crew-2",
      },
    ],
    orgId: "org-1",
    recipientProfileIds: [
      "profile-crew-1",
      "profile-crew-2",
      "profile-crew-2",
      "profile-actor",
    ],
    teamId: "team-1",
    teamVenueId: "team-venue-1",
    venueName: "Marseille",
  })

  assert.deepEqual(
    rows.map((row) => row.recipient_profile_id),
    ["profile-crew-2"],
  )
  assert.equal(rows[0].event_type, "assessment_run_created")
  assert.equal(
    rows[0].message,
    "Alex Coach is asking you to complete the Marseille assessment for Camp Alpha & Camp Beta. Complete it.",
  )
  assert.deepEqual(rows[0].metadata, {
    assessmentRunId: "run-1",
    campIds: ["camp-1", "camp-2"],
    teamVenueId: "team-venue-1",
  })
  assert.equal(
    rows[0].target_href,
    "/team-assessments/run-1?org=org-1&team=team-1",
  )
})

test("builds branded Assessment Run email and push payloads", () => {
  const message =
    "Alex <Coach> is asking you to complete the Marseille assessment for Camp <Alpha>. Complete it."
  const emailPayload = buildAssessmentRunEmailPayload({
    actorName: "Alex Coach",
    message,
    preferencesUrl: "https://www.dockout.app/settings?tab=notifications&org=org-1&team=team-1",
    targetHref: "/team-assessments/run-1?org=org-1&team=team-1",
    targetUrl: "https://www.dockout.app/team-assessments/run-1?org=org-1&team=team-1",
    venueName: "Marseille",
  })

  assert.match(emailPayload.html, /Assessment request/)
  assert.match(emailPayload.html, /Open assessment/)
  assert.match(emailPayload.html, /Alex &lt;Coach&gt; is asking/)
  assert.doesNotMatch(emailPayload.html, /Alex <Coach>/)
  assert.doesNotMatch(emailPayload.html, /were shared with the active crew/)
  assert.ok(
    emailPayload.html.indexOf("The Dock Out team") <
      emailPayload.html.indexOf("Manage email notifications"),
  )
  assert.match(
    emailPayload.html,
    /font-size: 12px; line-height: 1\.4; color: #9ca3af;[\s\S]*Manage email notifications/,
  )
  assert.equal(emailPayload.subject, "Alex Coach requested the Marseille assessment.")
  assert.match(
    emailPayload.text,
    /Manage email notifications: https:\/\/www\.dockout\.app\/settings\?tab=notifications&org=org-1&team=team-1/,
  )

  assert.deepEqual(
    buildAssessmentRunPushPayload({
      assessmentRunId: "run-1",
      message,
      targetHref: "/team-assessments/run-1?org=org-1&team=team-1",
    }),
    {
      body: message,
      tag: "assessment-run-run-1",
      title: "Assessment request",
      url: "/team-assessments/run-1?org=org-1&team=team-1",
    },
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
