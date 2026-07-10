export function getSafeVenueRedirectTarget(value) {
  if (!value) {
    return null
  }

  if (!value.startsWith("/")) {
    return null
  }

  const [pathname] = value.split("?")

  if (pathname !== "/venues" && !pathname.startsWith("/venues/")) {
    return null
  }

  return value
}

export function buildVenueRedirectPath(input) {
  const basePath = getSafeVenueRedirectTarget(input.redirectTo) ?? "/venues"
  const [pathname, queryString = ""] = basePath.split("?")
  const params = new URLSearchParams(queryString)

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

  if (input.cacheTeamVenueId) {
    params.set("cacheTeamVenue", input.cacheTeamVenueId)
  }

  const query = params.toString()
  return query.length > 0 ? `${pathname}?${query}` : pathname
}

export function resolveVenueUpdateDecision(input) {
  if (!input.scopeOrgId || !input.scopeTeamId) {
    return {
      allowed: false,
      error: "invalid_input",
    }
  }

  if (!input.canManageOrganizationOperations) {
    return {
      allowed: false,
      error: "forbidden",
    }
  }

  if (input.organizationId !== input.scopeOrgId) {
    return {
      allowed: false,
      error: "forbidden",
    }
  }

  if (!input.activeTeamInScope) {
    return {
      allowed: false,
      error: "forbidden",
    }
  }

  if (
    !input.teamVenue ||
    input.teamVenue.id !== input.teamVenueId ||
    input.teamVenue.team_id !== input.scopeTeamId ||
    input.teamVenue.venue_id !== input.venueId
  ) {
    return {
      allowed: false,
      error: "forbidden",
    }
  }

  if (
    !input.venue ||
    input.venue.id !== input.venueId ||
    input.venue.organization_id !== input.scopeOrgId
  ) {
    return {
      allowed: false,
      error: "forbidden",
    }
  }

  return {
    allowed: true,
  }
}
