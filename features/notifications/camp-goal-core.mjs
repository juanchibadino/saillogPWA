import {
  buildCampGoalsMessage,
  buildScopedNotificationHref,
  buildUpdateNotificationEmailPayload,
  NOTIFICATION_EVENT_TYPES,
} from "./core.mjs"

export { buildUpdateNotificationSettingsHref } from "./core.mjs"

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

export function buildCampGoalEmailPayload(input) {
  const subjectCampName = formatCampGoalSubjectCampName(input.campName)

  return buildUpdateNotificationEmailPayload({
    ctaLabel: "Open camp goals",
    heading: "Camp goals are ready",
    message: input.message,
    preferencesUrl: input.preferencesUrl,
    subject: `${input.actorName} added Goals for ${subjectCampName}.`,
    targetHref: input.targetHref,
    targetUrl: input.targetUrl,
  })
}

export function buildCampGoalPushPayload(input) {
  return {
    body: input.message,
    tag: `camp-goals-${input.campId}`,
    title: "Camp goals",
    url: input.targetHref,
  }
}
