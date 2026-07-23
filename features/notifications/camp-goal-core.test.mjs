import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCampGoalCrewRecipients,
  buildCampGoalEmailPayload,
  buildCampGoalNotificationRows,
  buildCampGoalPushPayload,
  getCampGoalEmailRecipients,
} from "./camp-goal-core.mjs"

test("builds Camp Goal crew recipients and filters email delivery recipients", () => {
  const recipients = buildCampGoalCrewRecipients({
    actorProfileId: "profile-actor",
    memberships: [
      {
        is_active: true,
        profile_id: "profile-actor",
        role: "crew",
      },
      {
        is_active: true,
        profile_id: "profile-crew-1",
        role: "crew",
      },
      {
        is_active: true,
        profile_id: "profile-crew-1",
        role: "crew",
      },
      {
        is_active: false,
        profile_id: "profile-crew-2",
        role: "crew",
      },
      {
        is_active: true,
        profile_id: "profile-coach",
        role: "coach",
      },
      {
        is_active: true,
        profile_id: "profile-inactive",
        role: "crew",
      },
      {
        is_active: true,
        profile_id: "profile-no-email",
        role: "crew",
      },
      {
        is_active: true,
        profile_id: "profile-email-disabled",
        role: "crew",
      },
    ],
    profiles: [
      {
        email: "actor@example.com",
        first_name: "Actor",
        id: "profile-actor",
        is_active: true,
        last_name: "Coach",
      },
      {
        email: "crew.one@example.com",
        first_name: "Crew",
        id: "profile-crew-1",
        is_active: true,
        last_name: "One",
      },
      {
        email: "crew.two@example.com",
        first_name: "Crew",
        id: "profile-crew-2",
        is_active: true,
        last_name: "Two",
      },
      {
        email: "coach@example.com",
        first_name: "Coach",
        id: "profile-coach",
        is_active: true,
        last_name: "Member",
      },
      {
        email: "inactive@example.com",
        first_name: "Inactive",
        id: "profile-inactive",
        is_active: false,
        last_name: "Crew",
      },
      {
        email: "",
        first_name: "No",
        id: "profile-no-email",
        is_active: true,
        last_name: "Email",
      },
      {
        email: "disabled@example.com",
        email_notifications_enabled: false,
        first_name: "Disabled",
        id: "profile-email-disabled",
        is_active: true,
        last_name: "Email",
      },
    ],
  })

  assert.deepEqual(
    recipients.map((recipient) => recipient.profileId),
    ["profile-crew-1", "profile-no-email", "profile-email-disabled"],
  )
  assert.deepEqual(
    getCampGoalEmailRecipients(recipients).map((recipient) => recipient.profileId),
    ["profile-crew-1"],
  )
})

test("dedupes Camp Goal notification rows by camp and recipient", () => {
  const rows = buildCampGoalNotificationRows({
    actorName: "Alex Coach",
    actorProfileId: "profile-actor",
    campId: "camp-1",
    campName: "Miami Camp",
    existingRows: [
      {
        event_type: "camp_goals_added",
        metadata: {
          campId: "camp-1",
        },
        recipient_profile_id: "profile-crew-1",
      },
      {
        event_type: "camp_goals_added",
        metadata: {
          campId: "camp-2",
        },
        recipient_profile_id: "profile-crew-2",
      },
    ],
    orgId: "org-1",
    recipients: [
      {
        email: "crew.one@example.com",
        name: "Crew One",
        profileId: "profile-crew-1",
      },
      {
        email: "crew.two@example.com",
        name: "Crew Two",
        profileId: "profile-crew-2",
      },
    ],
    teamId: "team-1",
  })

  assert.deepEqual(
    rows.map((row) => row.recipient_profile_id),
    ["profile-crew-2"],
  )
  assert.equal(rows[0].event_type, "camp_goals_added")
  assert.deepEqual(rows[0].metadata, { campId: "camp-1" })
  assert.equal(
    rows[0].target_href,
    "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
  )
})

test("builds branded Camp Goal email html", () => {
  const payload = buildCampGoalEmailPayload({
    actorName: "Alex Coach",
    campName: "Miami",
    message: "Alex <Coach> just uploaded the goals for Miami <Camp>. Check them out.",
    targetHref: "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
    targetUrl: "https://www.dockout.app/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
  })

  assert.match(
    payload.html,
    /https:\/\/www\.dockout\.app\/icons\/apple-touch-icon\.png/,
  )
  assert.match(payload.html, /Camp goals are ready/)
  assert.match(payload.html, /Open camp goals/)
  assert.match(payload.html, /Alex &lt;Coach&gt; just uploaded/)
  assert.match(payload.html, /Miami &lt;Camp&gt;/)
  assert.match(
    payload.html,
    /href="https:\/\/www\.dockout\.app\/team-camps\/camp-1\?org=org-1&amp;team=team-1&amp;tab=goals"/,
  )
  assert.doesNotMatch(payload.html, /Alex <Coach>/)
  assert.equal(payload.subject, "Alex Coach added Goals for Miami Camp.")
})

test("does not duplicate Camp in Camp Goal email subject", () => {
  const payload = buildCampGoalEmailPayload({
    actorName: "Alex Coach",
    campName: "Miami Camp",
    message: "Alex Coach just uploaded the goals for Miami Camp. Check them out.",
    targetHref: "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
    targetUrl: "https://www.dockout.app/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
  })

  assert.equal(payload.subject, "Alex Coach added Goals for Miami Camp.")
})

test("builds Camp Goal push payload with a safe internal target href", () => {
  assert.deepEqual(
    buildCampGoalPushPayload({
      campId: "camp-1",
      message: "Alex Coach just uploaded the goals for Miami Camp. Check them out.",
      targetHref: "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
    }),
    {
      body: "Alex Coach just uploaded the goals for Miami Camp. Check them out.",
      tag: "camp-goals-camp-1",
      title: "Camp goals",
      url: "/team-camps/camp-1?org=org-1&team=team-1&tab=goals",
    },
  )
})
