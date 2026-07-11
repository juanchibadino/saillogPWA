const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolveCalendarTimeFilter(value) {
  return value === "all" ? "all" : "future"
}

export function normalizeCalendarUuid(value) {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return UUID_PATTERN.test(normalized) ? normalized : undefined
}

export function resolveCalendarMemberFilter(value) {
  return normalizeCalendarUuid(value)
}

export function resolveCalendarEventFilter(value) {
  if (typeof value !== "string") {
    return undefined
  }

  const [sourceType, sourceId, extra] = value.split(":")

  if (extra || (sourceType !== "camp" && sourceType !== "event")) {
    return undefined
  }

  const normalizedSourceId = normalizeCalendarUuid(sourceId)

  if (!normalizedSourceId) {
    return undefined
  }

  return {
    sourceType,
    sourceId: normalizedSourceId,
    value: `${sourceType}:${normalizedSourceId}`,
  }
}

export function normalizeCalendarSelectedId(input) {
  if (!input.selectedId) {
    return undefined
  }

  if (!input.allowedIds.has(input.selectedId)) {
    return undefined
  }

  return input.selectedId
}

export function resolveTeamCalendarListRequest(input) {
  return {
    requestedMemberId: resolveCalendarMemberFilter(input.memberParam),
    requestedEventFilter: resolveCalendarEventFilter(input.eventParam),
    requestedTimeFilter: resolveCalendarTimeFilter(input.timeParam),
  }
}

function appendScopeParams(params, scope) {
  params.set("org", scope.activeOrgId)

  if (scope.activeTeamId) {
    params.set("team", scope.activeTeamId)
  }
}

export function buildTeamCalendarHref(input) {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.memberId) {
    params.set("member", input.memberId)
  }

  if (input.eventFilter?.value) {
    params.set("event", input.eventFilter.value)
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
