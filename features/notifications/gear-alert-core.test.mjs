import assert from "node:assert/strict"
import test from "node:test"

import {
  buildGearAlertNotificationRowsForRecipients,
  getExistingGearAlertKey,
  getGearAlertNotificationEventType,
} from "./gear-alert-core.mjs"

test("builds Gear notification rows for Near Limit and Past Due alerts", () => {
  const rows = buildGearAlertNotificationRowsForRecipients({
    actorProfileId: null,
    existingRows: [],
    gearAlerts: [
      {
        alertState: "critical",
        gearItemId: "gear-near",
        gearName: "Sail 101",
        triggeredAlertCount: 1,
        usageCount: 9,
        usageMinutes: 45,
      },
      {
        alertState: "warning",
        gearItemId: "gear-past",
        gearName: "Foil 9",
        triggeredAlertCount: 2,
        usageCount: 12,
        usageMinutes: 70,
      },
    ],
    orgId: "org-1",
    recipientProfileIds: ["profile-1", "profile-2", "profile-1", ""],
    teamId: "team-1",
  })

  assert.equal(rows.length, 4)
  assert.deepEqual(
    rows.map((row) => ({
      eventType: row.event_type,
      message: row.message,
      recipientProfileId: row.recipient_profile_id,
      targetHref: row.target_href,
    })),
    [
      {
        eventType: "gear_critical",
        message: "Sail 101 is approaching its usage limit.",
        recipientProfileId: "profile-1",
        targetHref: "/team-gear?org=org-1&team=team-1&alert=critical",
      },
      {
        eventType: "gear_critical",
        message: "Sail 101 is approaching its usage limit.",
        recipientProfileId: "profile-2",
        targetHref: "/team-gear?org=org-1&team=team-1&alert=critical",
      },
      {
        eventType: "gear_warning",
        message: "Foil 9 is past due and needs review.",
        recipientProfileId: "profile-1",
        targetHref: "/team-gear?org=org-1&team=team-1&alert=warning",
      },
      {
        eventType: "gear_warning",
        message: "Foil 9 is past due and needs review.",
        recipientProfileId: "profile-2",
        targetHref: "/team-gear?org=org-1&team=team-1&alert=warning",
      },
    ],
  )
  assert.deepEqual(rows[0].metadata, {
    alertState: "critical",
    gearItemId: "gear-near",
    triggeredAlertCount: 1,
    usageCount: 9,
    usageMinutes: 45,
  })
  assert.deepEqual(rows[2].metadata, {
    alertState: "warning",
    gearItemId: "gear-past",
    triggeredAlertCount: 2,
    usageCount: 12,
    usageMinutes: 70,
  })
})

test("dedupes Gear alert notifications by recipient gear and alert state", () => {
  const rows = buildGearAlertNotificationRowsForRecipients({
    actorProfileId: "actor-1",
    existingRows: [
      {
        event_type: "gear_critical",
        metadata: {
          alertState: "critical",
          gearItemId: "gear-1",
        },
        recipient_profile_id: "profile-1",
      },
      {
        event_type: "session_review_added",
        metadata: {
          alertState: "critical",
          gearItemId: "gear-1",
        },
        recipient_profile_id: "profile-2",
      },
    ],
    gearAlerts: [
      {
        alertState: "critical",
        gearItemId: "gear-1",
        gearName: "Sail 101",
        triggeredAlertCount: 1,
        usageCount: 9,
        usageMinutes: 45,
      },
      {
        alertState: "warning",
        gearItemId: "gear-1",
        gearName: "Sail 101",
        triggeredAlertCount: 2,
        usageCount: 11,
        usageMinutes: 55,
      },
      {
        alertState: "warning",
        gearItemId: "gear-1",
        gearName: "Sail 101",
        triggeredAlertCount: 2,
        usageCount: 11,
        usageMinutes: 55,
      },
    ],
    orgId: "org-1",
    recipientProfileIds: ["profile-1", "profile-2"],
    teamId: "team-1",
  })

  assert.deepEqual(
    rows.map((row) => ({
      actorProfileId: row.actor_profile_id,
      eventType: row.event_type,
      recipientProfileId: row.recipient_profile_id,
      state: row.metadata.alertState,
    })),
    [
      {
        actorProfileId: "actor-1",
        eventType: "gear_critical",
        recipientProfileId: "profile-2",
        state: "critical",
      },
      {
        actorProfileId: "actor-1",
        eventType: "gear_warning",
        recipientProfileId: "profile-1",
        state: "warning",
      },
      {
        actorProfileId: "actor-1",
        eventType: "gear_warning",
        recipientProfileId: "profile-2",
        state: "warning",
      },
    ],
  )
})

test("maps internal Gear alert states to persisted notification event types", () => {
  assert.equal(getGearAlertNotificationEventType("critical"), "gear_critical")
  assert.equal(getGearAlertNotificationEventType("warning"), "gear_warning")
  assert.equal(
    getExistingGearAlertKey({
      eventType: "gear_warning",
      metadata: {
        alertState: "warning",
        gearItemId: "gear-1",
      },
      recipientProfileId: "profile-1",
    }),
    "profile-1:gear-1:warning",
  )
})
