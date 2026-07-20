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

export function buildGearAlertMessage(input) {
  const gearName = normalizeNotificationText(input.gearName) || "Gear item"
  const mode = input.alertState === "critical" ? "critical" : "warning"

  return `${gearName} is in ${mode} mode. Review the Gear thresholds.`
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
