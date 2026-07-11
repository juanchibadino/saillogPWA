export function canEditCalendarPresence(input) {
  if (!input.targetProfileId || !input.currentProfileId) {
    return false
  }

  if (input.targetProfileId === input.currentProfileId) {
    return true
  }

  return input.canManageAnyPresence === true
}

export function isCalendarDateWithinRange(input) {
  if (!input.date || !input.startDate || !input.endDate) {
    return false
  }

  return input.startDate <= input.date && input.date <= input.endDate
}

export function isCalendarTargetInScope(input) {
  return Boolean(input.targetTeamId && input.scopeTeamId && input.targetTeamId === input.scopeTeamId)
}

export function validateCalendarDateRange(input) {
  if (!input.startDate || !input.endDate) {
    return false
  }

  return input.endDate >= input.startDate
}

export function normalizeCalendarActionReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  const url = new URL(value, "http://sailog.local")

  if (url.pathname !== "/team-calendar") {
    return null
  }

  return `${url.pathname}${url.search}`
}

export function buildCalendarActionRedirectPath(input) {
  const returnPath = normalizeCalendarActionReturnPath(input.returnPath)

  if (!returnPath) {
    const params = new URLSearchParams()

    if (input.scopeOrgId) {
      params.set("org", input.scopeOrgId)
    }

    if (input.scopeTeamId) {
      params.set("team", input.scopeTeamId)
    }

    if (input.memberId) {
      params.set("member", input.memberId)
    }

    if (input.eventFilter) {
      params.set("event", input.eventFilter)
    }

    if (input.timeFilter === "all") {
      params.set("time", "all")
    }

    if (input.status) {
      params.set("status", input.status)
    }

    if (input.error) {
      params.set("error", input.error)
    }

    const query = params.toString()
    return query.length > 0 ? `/team-calendar?${query}` : "/team-calendar"
  }

  const url = new URL(returnPath, "http://sailog.local")
  const params = url.searchParams

  params.delete("status")
  params.delete("error")

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  if (input.timeFilter === "all") {
    params.set("time", "all")
  } else {
    params.delete("time")
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname
}
