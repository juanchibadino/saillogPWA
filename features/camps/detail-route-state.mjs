export const CAMP_DETAIL_TABS = ["sessions", "goals", "notes"]

export function resolveCampDetailTab(value) {
  return CAMP_DETAIL_TABS.includes(value) ? value : "sessions"
}

export function normalizeCampDetailPage(value) {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

export function normalizeCampDetailNotesOffset(value) {
  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
}

export function resolveCampDetailRouteRequest(input) {
  return {
    selectedTab: resolveCampDetailTab(input.tabParam),
    requestedPage: normalizeCampDetailPage(input.pageParam),
    requestedNotesOffset: normalizeCampDetailNotesOffset(input.notesOffsetParam),
  }
}

export function buildTeamCampsRedirectPath(input) {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  if (input.scopeVenueId) {
    params.set("venue", input.scopeVenueId)
  }

  if (
    input.scopeCampType === "training" ||
    input.scopeCampType === "regatta" ||
    input.scopeCampType === "mixed"
  ) {
    params.set("type", input.scopeCampType)
  }

  if (input.scopeCampStatus === "active" || input.scopeCampStatus === "inactive") {
    params.set("campStatus", input.scopeCampStatus)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(Math.floor(input.scopePage)))
  }

  const query = params.toString()
  return query.length > 0 ? `/team-camps?${query}` : "/team-camps"
}

export function buildCampDetailRedirectPath(input) {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set("org", input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set("team", input.scopeTeamId)
  }

  if (CAMP_DETAIL_TABS.includes(input.scopeTab)) {
    params.set("tab", input.scopeTab)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(Math.floor(input.scopePage)))
  }

  const query = params.toString()
  const basePath = `/team-camps/${input.campId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}

export function resolveCampGoalsActionRedirect(input) {
  if (
    input.outcome === "missing_required" ||
    !input.campId ||
    !input.scopeOrgId ||
    !input.scopeTeamId
  ) {
    return buildTeamCampsRedirectPath({
      error: "invalid_input",
      scopeOrgId: input.scopeOrgId,
      scopeTeamId: input.scopeTeamId,
      scopeVenueId: input.scopeVenueId,
      scopePage: input.scopePage,
    })
  }

  if (input.outcome === "invalid_input" || input.outcome === "missing_camp") {
    return buildCampDetailRedirectPath({
      campId: input.campId,
      error: "invalid_input",
      scopeOrgId: input.scopeOrgId,
      scopeTeamId: input.scopeTeamId,
      scopeTab: input.scopeTab,
      scopePage: input.scopePage,
    })
  }

  if (input.outcome === "forbidden") {
    return buildCampDetailRedirectPath({
      campId: input.campId,
      error: "forbidden",
      scopeOrgId: input.scopeOrgId,
      scopeTeamId: input.scopeTeamId,
      scopeTab: input.scopeTab,
      scopePage: input.scopePage,
    })
  }

  if (input.outcome === "update_failed") {
    return buildCampDetailRedirectPath({
      campId: input.campId,
      error: "update_failed",
      scopeOrgId: input.scopeOrgId,
      scopeTeamId: input.scopeTeamId,
      scopeTab: input.scopeTab,
      scopePage: input.scopePage,
    })
  }

  return buildCampDetailRedirectPath({
    campId: input.campId,
    status: "goals_updated",
    scopeOrgId: input.scopeOrgId,
    scopeTeamId: input.scopeTeamId,
    scopeTab: input.scopeTab,
    scopePage: input.scopePage,
  })
}
