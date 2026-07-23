const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

export function normalizeCalendarFeedToken(value) {
  if (typeof value !== "string") {
    return null
  }

  const token = value.trim()
  return TOKEN_PATTERN.test(token) ? token : null
}

export function buildTeamCalendarFeedPath(token, options = {}) {
  const normalizedToken = normalizeCalendarFeedToken(token)

  if (!normalizedToken) {
    return null
  }

  const path = `/api/team-calendar/feed/${encodeURIComponent(normalizedToken)}.ics`
  return options.download ? `${path}?download=1` : path
}

export function buildTeamCalendarFeedUrl(input) {
  const path = buildTeamCalendarFeedPath(input.token, {
    download: input.download === true,
  })

  if (!path) {
    return null
  }

  return new URL(path, input.origin).toString()
}

export function canManageTeamCalendarFeed(input) {
  return Boolean(
    input.activeTeamId &&
      input.targetTeamId &&
      input.activeTeamId === input.targetTeamId &&
      input.canManageTeamSessions === true,
  )
}

export function resolveTeamCalendarFeedMutation(input) {
  const mode = input.mode === "rotate" ? "rotate" : "ensure"
  const existingFeed =
    input.existingFeed && input.existingFeed.isActive ? input.existingFeed : null
  const nextFeed = {
    createdByProfileId: input.actorProfileId,
    teamId: input.teamId,
    token: input.nextToken,
  }

  if (mode === "ensure" && existingFeed) {
    return {
      type: "reuse",
      feed: existingFeed,
    }
  }

  if (mode === "rotate" && existingFeed) {
    return {
      type: "rotate",
      deactivateFeedId: existingFeed.id,
      nextFeed,
    }
  }

  return {
    type: "create",
    nextFeed,
  }
}
