import {
  buildGearAlertMessage,
  buildScopedNotificationHref,
  NOTIFICATION_EVENT_TYPES,
} from "./core.mjs"

export function isGearAlertNotificationState(value) {
  return value === "warning" || value === "critical"
}

export function getGearAlertNotificationEventType(alertState) {
  return alertState === "critical"
    ? NOTIFICATION_EVENT_TYPES.GEAR_CRITICAL
    : NOTIFICATION_EVENT_TYPES.GEAR_WARNING
}

export function getUniqueTeamRecipientIds(recipientProfileIds) {
  return [...new Set(recipientProfileIds.filter((profileId) => profileId.length > 0))]
}

function isJsonRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function getExistingGearAlertKey(input) {
  if (
    input.eventType !== NOTIFICATION_EVENT_TYPES.GEAR_WARNING &&
    input.eventType !== NOTIFICATION_EVENT_TYPES.GEAR_CRITICAL
  ) {
    return null
  }

  if (!isJsonRecord(input.metadata)) {
    return null
  }

  const gearItemId = input.metadata.gearItemId
  const alertState = input.metadata.alertState

  if (typeof gearItemId !== "string" || !isGearAlertNotificationState(alertState)) {
    return null
  }

  return `${input.recipientProfileId}:${gearItemId}:${alertState}`
}

function buildGearAlertNotificationKey(input) {
  return `${input.recipientProfileId}:${input.gearItemId}:${input.alertState}`
}

export function buildGearAlertNotificationRowsForRecipients(input) {
  const recipientProfileIds = getUniqueTeamRecipientIds(input.recipientProfileIds)
  const existingKeys = new Set()

  for (const row of input.existingRows ?? []) {
    const existingKey = getExistingGearAlertKey({
      eventType: row.event_type,
      metadata: row.metadata,
      recipientProfileId: row.recipient_profile_id,
    })

    if (existingKey) {
      existingKeys.add(existingKey)
    }
  }

  const notificationRows = []

  for (const alert of input.gearAlerts) {
    if (!isGearAlertNotificationState(alert.alertState)) {
      continue
    }

    const eventType = getGearAlertNotificationEventType(alert.alertState)
    const message = buildGearAlertMessage({
      alertState: alert.alertState,
      gearName: alert.gearName,
    })
    const targetHref = buildScopedNotificationHref({
      pathname: "/team-gear",
      orgId: input.orgId,
      teamId: input.teamId,
      extraParams: {
        alert: alert.alertState,
      },
    })
    const metadata = {
      alertState: alert.alertState,
      gearItemId: alert.gearItemId,
      triggeredAlertCount: alert.triggeredAlertCount,
      usageCount: alert.usageCount,
      usageMinutes: alert.usageMinutes,
    }

    for (const recipientProfileId of recipientProfileIds) {
      const notificationKey = buildGearAlertNotificationKey({
        alertState: alert.alertState,
        gearItemId: alert.gearItemId,
        recipientProfileId,
      })

      if (existingKeys.has(notificationKey)) {
        continue
      }

      existingKeys.add(notificationKey)
      notificationRows.push({
        actor_profile_id: input.actorProfileId ?? null,
        event_type: eventType,
        message,
        metadata,
        recipient_profile_id: recipientProfileId,
        target_href: targetHref,
        team_id: input.teamId,
      })
    }
  }

  return notificationRows
}
