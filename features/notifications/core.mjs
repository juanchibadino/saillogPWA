const ORG_QUERY_KEY = "org"
const TEAM_QUERY_KEY = "team"

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  CAMP_GOALS_ADDED: "camp_goals_added",
  SESSION_REVIEW_ADDED: "session_review_added",
  SESSION_GOALS_ADDED: "session_goals_added",
  ASSESSMENT_RUN_CREATED: "assessment_run_created",
  GEAR_WARNING: "gear_warning",
  GEAR_CRITICAL: "gear_critical",
})

export function normalizeNotificationText(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function shouldNotifyTextAdded(previousValue, nextValue) {
  return (
    normalizeNotificationText(previousValue).length === 0 &&
    normalizeNotificationText(nextValue).length > 0
  )
}

export function formatActorName(input = {}) {
  const name = [input.firstName, input.lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim()

  if (name.length > 0) {
    return name
  }

  if (typeof input.email === "string" && input.email.trim().length > 0) {
    return input.email.trim()
  }

  return "A team member"
}

export function joinCampNames(names = []) {
  const normalizedNames = names
    .map((name) => normalizeNotificationText(name))
    .filter((name) => name.length > 0)

  if (normalizedNames.length === 0) {
    return "the selected camps"
  }

  if (normalizedNames.length === 1) {
    return normalizedNames[0]
  }

  if (normalizedNames.length === 2) {
    return `${normalizedNames[0]} & ${normalizedNames[1]}`
  }

  return `${normalizedNames.slice(0, -1).join(", ")} & ${
    normalizedNames[normalizedNames.length - 1]
  }`
}

export function buildScopedNotificationHref(input) {
  const params = new URLSearchParams()

  if (typeof input.orgId === "string" && input.orgId.length > 0) {
    params.set(ORG_QUERY_KEY, input.orgId)
  }

  if (typeof input.teamId === "string" && input.teamId.length > 0) {
    params.set(TEAM_QUERY_KEY, input.teamId)
  }

  if (typeof input.tab === "string" && input.tab.length > 0) {
    params.set("tab", input.tab)
  }

  if (input.extraParams && typeof input.extraParams === "object") {
    for (const [key, value] of Object.entries(input.extraParams)) {
      if (
        typeof key === "string" &&
        key.length > 0 &&
        typeof value === "string" &&
        value.length > 0
      ) {
        params.set(key, value)
      }
    }
  }

  const query = params.toString()
  return query.length > 0 ? `${input.pathname}?${query}` : input.pathname
}

export function buildUpdateNotificationSettingsHref(input = {}) {
  const params = new URLSearchParams()
  params.set("tab", "notifications")

  if (typeof input.orgId === "string" && input.orgId.trim().length > 0) {
    params.set("org", input.orgId.trim())
  }

  if (typeof input.teamId === "string" && input.teamId.trim().length > 0) {
    params.set("team", input.teamId.trim())
  }

  return `/settings?${params.toString()}`
}

export function escapeNotificationHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildUpdateNotificationEmailPayload(input) {
  const targetLabel = input.targetUrl || input.targetHref
  const targetUrl = escapeNotificationHtml(targetLabel)
  const preferencesLabel = input.preferencesUrl || "/settings?tab=notifications"
  const preferencesUrl = escapeNotificationHtml(preferencesLabel)
  const message = escapeNotificationHtml(input.message)
  const heading = escapeNotificationHtml(input.heading)
  const ctaLabel = escapeNotificationHtml(input.ctaLabel)

  return {
    html: `
<div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111827;">
  <img
    src="https://www.dockout.app/icons/apple-touch-icon.png"
    alt="Dock Out"
    width="56"
    height="56"
    style="display: block; width: 56px; height: 56px; border-radius: 18px; margin: 0 0 20px;"
  />

  <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700;">
    ${heading}
  </h1>

  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #4b5563;">
    ${message}
  </p>

  <p style="margin: 0 0 28px;">
    <a
      href="${targetUrl}"
      style="display: inline-block; padding: 14px 20px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;"
    >
      ${ctaLabel}
    </a>
  </p>

  <p style="margin: 32px 0 0; font-size: 14px; color: #9ca3af;">
    See you on the water,<br />
    The Dock Out team
  </p>

  <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.4; color: #9ca3af;">
    To stop receiving Dock Out update emails,
    <a
      href="${preferencesUrl}"
      style="color: #111827; font-weight: 600; text-decoration: underline;"
    >
      Manage email notifications
    </a>.
  </p>
</div>`.trim(),
    subject: input.subject,
    text: `${input.message}\n\n${input.ctaLabel}: ${targetLabel}\n\nSee you on the water,\nThe Dock Out team\n\nManage email notifications: ${preferencesLabel}`,
  }
}

export function buildCampGoalsMessage(input) {
  return `${input.actorName} just uploaded the goals for ${input.campName}. Check them out.`
}

export function buildSessionUpdateMessage(input) {
  const sessionLabel = normalizeNotificationText(input.sessionLabel) || "the session"
  const sessionSubject = /\bsession\b/i.test(sessionLabel)
    ? sessionLabel
    : `${sessionLabel} Session`

  return `${input.actorName} just added ${input.fieldLabel} for ${sessionSubject}. Review the update.`
}

export function buildAssessmentRequestMessage(input) {
  return `${input.actorName} is asking you to complete the ${input.venueName} assessment for ${input.campNames}. Complete it.`
}

function isNotificationMetadataRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function buildAssessmentRunTargetHref(input) {
  return buildScopedNotificationHref({
    pathname: `/team-assessments/${input.assessmentRunId}`,
    orgId: input.orgId,
    teamId: input.teamId,
  })
}

export function getExistingAssessmentRunNotificationRecipientIds(input) {
  const recipientIds = new Set()

  for (const row of input.existingRows ?? []) {
    if (row.event_type !== NOTIFICATION_EVENT_TYPES.ASSESSMENT_RUN_CREATED) {
      continue
    }

    if (!isNotificationMetadataRecord(row.metadata)) {
      continue
    }

    if (row.metadata.assessmentRunId !== input.assessmentRunId) {
      continue
    }

    if (typeof row.recipient_profile_id === "string") {
      recipientIds.add(row.recipient_profile_id)
    }
  }

  return recipientIds
}

export function buildAssessmentRunNotificationRows(input) {
  const existingRecipientIds = getExistingAssessmentRunNotificationRecipientIds({
    assessmentRunId: input.assessmentRunId,
    existingRows: input.existingRows,
  })
  const message = buildAssessmentRequestMessage({
    actorName: input.actorName,
    campNames: input.campNames,
    venueName: input.venueName,
  })
  const targetHref = buildAssessmentRunTargetHref({
    assessmentRunId: input.assessmentRunId,
    orgId: input.orgId,
    teamId: input.teamId,
  })
  const recipientProfileIds = [
    ...new Set(
      input.recipientProfileIds.filter(
        (profileId) => profileId.length > 0 && profileId !== input.actorProfileId,
      ),
    ),
  ]

  return recipientProfileIds
    .filter((recipientProfileId) => !existingRecipientIds.has(recipientProfileId))
    .map((recipientProfileId) => ({
      actor_profile_id: input.actorProfileId,
      event_type: NOTIFICATION_EVENT_TYPES.ASSESSMENT_RUN_CREATED,
      message,
      metadata: {
        assessmentRunId: input.assessmentRunId,
        campIds: input.campIds,
        teamVenueId: input.teamVenueId,
      },
      recipient_profile_id: recipientProfileId,
      target_href: targetHref,
      team_id: input.teamId,
    }))
}

export function getAssessmentRunEmailRecipients(recipients = []) {
  return recipients.filter(
    (recipient) =>
      typeof recipient.email === "string" &&
      recipient.email.includes("@") &&
      recipient.email.includes(".") &&
      recipient.emailNotificationsEnabled !== false,
  )
}

export function buildAssessmentRunEmailPayload(input) {
  const venueName = normalizeNotificationText(input.venueName) || "venue"

  return buildUpdateNotificationEmailPayload({
    ctaLabel: "Open assessment",
    heading: "Assessment request",
    message: input.message,
    preferencesUrl: input.preferencesUrl,
    subject: `${input.actorName} requested the ${venueName} assessment.`,
    targetHref: input.targetHref,
    targetUrl: input.targetUrl,
  })
}

export function buildAssessmentRunPushPayload(input) {
  return {
    body: input.message,
    tag: `assessment-run-${input.assessmentRunId}`,
    title: "Assessment request",
    url: input.targetHref,
  }
}

export function getNotificationEventTitle(eventType) {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.CAMP_GOALS_ADDED:
      return "Camp goals"
    case NOTIFICATION_EVENT_TYPES.SESSION_REVIEW_ADDED:
      return "Session update"
    case NOTIFICATION_EVENT_TYPES.SESSION_GOALS_ADDED:
      return "Session goals"
    case NOTIFICATION_EVENT_TYPES.ASSESSMENT_RUN_CREATED:
      return "Assessment request"
    case NOTIFICATION_EVENT_TYPES.GEAR_WARNING:
      return "Gear past due"
    case NOTIFICATION_EVENT_TYPES.GEAR_CRITICAL:
      return "Gear near limit"
    default:
      return "Notification"
  }
}

export function buildGearAlertMessage(input) {
  const gearName = normalizeNotificationText(input.gearName) || "Gear item"

  if (input.alertState === "critical") {
    return `${gearName} is approaching its usage limit.`
  }

  return `${gearName} is past due and needs review.`
}

export function buildSessionReviewFieldLabel(input) {
  if (input.bestAdded && input.toWorkAdded) {
    return "Best/To Work"
  }

  if (input.bestAdded) {
    return "Best"
  }

  if (input.toWorkAdded) {
    return "To Work"
  }

  return "Session notes"
}

export function formatSessionLabel(input) {
  if (!input.sessionDate) {
    return "the session"
  }

  const date = new Date(`${input.sessionDate}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return "the session"
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)

  if (!input.dockOutAt) {
    return dateLabel
  }

  const time = new Date(input.dockOutAt)

  if (Number.isNaN(time.getTime())) {
    return dateLabel
  }

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(time)

  return `${dateLabel} ${timeLabel}`
}

export function applyNotificationReadState(data, id, readAt) {
  let unreadCountDelta = 0
  const notifications = data.notifications.map((notification) => {
    if (notification.id !== id) {
      return notification
    }

    if (!notification.readAt && readAt) {
      unreadCountDelta = -1
    }

    if (notification.readAt && !readAt) {
      unreadCountDelta = 1
    }

    return {
      ...notification,
      readAt,
    }
  })

  return {
    notifications,
    unreadCount: Math.max(0, data.unreadCount + unreadCountDelta),
  }
}

export function applyNotificationDelete(data, id) {
  const removedNotification = data.notifications.find(
    (notification) => notification.id === id,
  )
  const unreadCountDelta = removedNotification?.readAt ? 0 : -1

  return {
    notifications: data.notifications.filter((notification) => notification.id !== id),
    unreadCount: Math.max(0, data.unreadCount + unreadCountDelta),
  }
}

export function applyNotificationMarkAllRead(data, readAt) {
  return {
    notifications: data.notifications.map((notification) => ({
      ...notification,
      readAt: notification.readAt ?? readAt,
    })),
    unreadCount: 0,
  }
}
