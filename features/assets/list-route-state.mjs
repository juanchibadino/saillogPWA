const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const TEAM_ASSET_TABS = ["images", "files"]

export function resolveTeamAssetTab(value) {
  return value === "files" ? "files" : "images"
}

export function normalizeRequestedPage(value) {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

export function normalizeRequestedYear(value) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return undefined
  }

  return Math.floor(parsed)
}

export function normalizeRequestedUuid(value) {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()

  return UUID_PATTERN.test(normalized) ? normalized : undefined
}

export function resolveTeamAssetsListRequest(input) {
  return {
    requestedTab: resolveTeamAssetTab(input.tabParam),
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
    requestedVenueId: normalizeRequestedUuid(input.venueParam),
    requestedYear: normalizeRequestedYear(input.yearParam),
    requestedCampId: normalizeRequestedUuid(input.campParam),
    requestedSessionId: normalizeRequestedUuid(input.sessionParam),
  }
}

function appendScopeParams(params, scope) {
  params.set("org", scope.activeOrgId)

  if (scope.activeTeamId) {
    params.set("team", scope.activeTeamId)
  }
}

export function buildTeamAssetsHref(input) {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab === "files") {
    params.set("tab", "files")
  }

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  if (typeof input.year === "number" && Number.isFinite(input.year)) {
    params.set("year", String(Math.floor(input.year)))
  }

  if (input.campId) {
    params.set("camp", input.campId)
  }

  if (input.sessionId) {
    params.set("session", input.sessionId)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.loadMore === true) {
    params.set("loadMore", "1")
  }

  return `/team-assets?${params.toString()}`
}
