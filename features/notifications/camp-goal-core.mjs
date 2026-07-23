import {
  buildCampGoalsMessage,
  buildScopedNotificationHref,
  NOTIFICATION_EVENT_TYPES,
} from "./core.mjs"

export function buildProfileDisplayName(profile = {}) {
  const name = [profile.first_name, profile.last_name]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim()

  if (name.length > 0) {
    return name
  }

  if (typeof profile.email === "string" && profile.email.trim().length > 0) {
    return profile.email.trim()
  }

  return "Crew member"
}

export function buildCampGoalTargetHref(input) {
  return buildScopedNotificationHref({
    pathname: `/team-camps/${input.campId}`,
    orgId: input.orgId,
    teamId: input.teamId,
    tab: "goals",
  })
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

export function buildCampGoalCrewRecipients(input) {
  const profileById = new Map(
    (input.profiles ?? []).map((profile) => [profile.id, profile]),
  )
  const seenProfileIds = new Set()
  const recipients = []

  for (const membership of input.memberships ?? []) {
    if (
      membership.role !== "crew" ||
      membership.is_active !== true ||
      membership.profile_id === input.actorProfileId ||
      seenProfileIds.has(membership.profile_id)
    ) {
      continue
    }

    const profile = profileById.get(membership.profile_id)

    if (!profile || profile.is_active !== true) {
      continue
    }

    seenProfileIds.add(membership.profile_id)
    recipients.push({
      email: typeof profile.email === "string" ? profile.email.trim() : "",
      emailNotificationsEnabled: profile.email_notifications_enabled !== false,
      name: buildProfileDisplayName(profile),
      profileId: membership.profile_id,
    })
  }

  return recipients
}

export function getExistingCampGoalNotificationRecipientIds(input) {
  const recipientIds = new Set()

  for (const row of input.existingRows ?? []) {
    if (row.event_type !== NOTIFICATION_EVENT_TYPES.CAMP_GOALS_ADDED) {
      continue
    }

    if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
      continue
    }

    if (row.metadata.campId !== input.campId) {
      continue
    }

    if (typeof row.recipient_profile_id === "string") {
      recipientIds.add(row.recipient_profile_id)
    }
  }

  return recipientIds
}

export function buildCampGoalNotificationRows(input) {
  const existingRecipientIds = getExistingCampGoalNotificationRecipientIds({
    campId: input.campId,
    existingRows: input.existingRows,
  })
  const message = buildCampGoalsMessage({
    actorName: input.actorName,
    campName: input.campName,
  })
  const targetHref = buildCampGoalTargetHref({
    campId: input.campId,
    orgId: input.orgId,
    teamId: input.teamId,
  })

  return input.recipients
    .filter((recipient) => !existingRecipientIds.has(recipient.profileId))
    .map((recipient) => ({
      actor_profile_id: input.actorProfileId,
      event_type: NOTIFICATION_EVENT_TYPES.CAMP_GOALS_ADDED,
      message,
      metadata: {
        campId: input.campId,
      },
      recipient_profile_id: recipient.profileId,
      target_href: targetHref,
      team_id: input.teamId,
    }))
}

export function getCampGoalEmailRecipients(recipients = []) {
  return recipients.filter(
    (recipient) =>
      typeof recipient.email === "string" &&
      recipient.email.includes("@") &&
      recipient.email.includes(".") &&
      recipient.emailNotificationsEnabled !== false,
  )
}

function formatCampGoalSubjectCampName(campName) {
  const normalizedCampName = String(campName || "this camp").trim() || "this camp"

  if (/\bcamp$/i.test(normalizedCampName)) {
    return normalizedCampName
  }

  return `${normalizedCampName} Camp`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildCampGoalEmailPayload(input) {
  const targetLabel = input.targetUrl || input.targetHref
  const targetUrl = escapeHtml(targetLabel)
  const preferencesLabel = input.preferencesUrl || "/settings?tab=notifications"
  const preferencesUrl = escapeHtml(preferencesLabel)
  const message = escapeHtml(input.message)
  const campName = escapeHtml(input.campName || "this camp")
  const subjectCampName = formatCampGoalSubjectCampName(input.campName)

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
    Camp goals are ready
  </h1>

  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #4b5563;">
    ${message}
  </p>

  <p style="margin: 0 0 28px;">
    <a
      href="${targetUrl}"
      style="display: inline-block; padding: 14px 20px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;"
    >
      Open camp goals
    </a>
  </p>

  <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
    The goals for ${campName} were shared with the active crew.
  </p>

  <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
    To stop receiving Dock Out update emails,
    <a
      href="${preferencesUrl}"
      style="color: #111827; font-weight: 600; text-decoration: underline;"
    >
      Manage email notifications
    </a>.
  </p>

  <p style="margin: 32px 0 0; font-size: 14px; color: #9ca3af;">
    See you on the water,<br />
    The Dock Out team
  </p>
</div>`.trim(),
    subject: `${input.actorName} added Goals for ${subjectCampName}.`,
    text: `${input.message}\n\nOpen camp goals: ${targetLabel}\n\nManage email notifications: ${preferencesLabel}`,
  }
}

export function buildCampGoalPushPayload(input) {
  return {
    body: input.message,
    tag: `camp-goals-${input.campId}`,
    title: "Camp goals",
    url: input.targetHref,
  }
}
