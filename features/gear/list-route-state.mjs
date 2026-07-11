const TEAM_GEAR_TYPE_VALUES = new Set([
  "sails",
  "spars_and_foils",
  "running_rigging",
  "hardware_and_fittings",
])

const TEAM_GEAR_STATUS_VALUES = new Set([
  "active_regatta",
  "active_training",
  "retired_spare",
  "on_repair",
])

const TEAM_GEAR_CONDITION_VALUES = new Set(["new", "used", "refurbished"])
const TEAM_GEAR_ALERT_VALUES = new Set(["critical", "warning", "none"])

function normalizeFilterValue(value, allowedValues) {
  if (!value || !allowedValues.has(value)) {
    return undefined
  }

  return value
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

export function resolveTeamGearTypeFilter(value) {
  return normalizeFilterValue(value, TEAM_GEAR_TYPE_VALUES)
}

export function resolveTeamGearStatusFilter(value) {
  return normalizeFilterValue(value, TEAM_GEAR_STATUS_VALUES)
}

export function resolveTeamGearConditionFilter(value) {
  return normalizeFilterValue(value, TEAM_GEAR_CONDITION_VALUES)
}

export function resolveTeamGearAlertFilter(value) {
  return normalizeFilterValue(value, TEAM_GEAR_ALERT_VALUES)
}

export function resolveTeamGearListRequest(input) {
  return {
    requestedType: resolveTeamGearTypeFilter(input.typeParam),
    requestedStatusFilter: resolveTeamGearStatusFilter(input.statusFilterParam),
    requestedCondition: resolveTeamGearConditionFilter(input.conditionParam),
    requestedAlert: resolveTeamGearAlertFilter(input.alertParam),
    requestedPage: normalizeRequestedPage(input.pageParam),
    requestedLoadMoreMode: input.loadMoreParam === "1",
  }
}

export function resolveTeamGearPagination(input) {
  const pageCount = Math.max(
    1,
    Math.ceil(input.totalItems / input.pageSize),
  )
  const currentPage = Math.min(input.requestedPage, pageCount)

  return {
    currentPage,
    pageCount,
    hasPreviousPage: input.accumulatePages ? false : currentPage > 1,
    hasNextPage: currentPage < pageCount,
  }
}

export function buildTeamGearPageHref(input) {
  const search = input.search?.startsWith("?")
    ? input.search.slice(1)
    : input.search
  const params = new URLSearchParams(search)

  if (input.nextPage <= 1) {
    params.delete("page")
    params.delete("loadMore")
  } else {
    params.set("page", String(Math.floor(input.nextPage)))

    if (input.includeLoadMore) {
      params.set("loadMore", "1")
    } else {
      params.delete("loadMore")
    }
  }

  const nextSearch = params.toString()
  return nextSearch.length > 0 ? `${input.pathname}?${nextSearch}` : input.pathname
}

export function buildTeamGearFiltersHref(input) {
  const params = new URLSearchParams()

  if (input.scope.activeOrgId) {
    params.set("org", input.scope.activeOrgId)
  }

  if (input.scope.activeTeamId) {
    params.set("team", input.scope.activeTeamId)
  }

  const type = resolveTeamGearTypeFilter(input.type)
  const statusFilter = resolveTeamGearStatusFilter(input.statusFilter)
  const condition = resolveTeamGearConditionFilter(input.condition)
  const alert = resolveTeamGearAlertFilter(input.alert)

  if (type) {
    params.set("type", type)
  }

  if (statusFilter) {
    params.set("statusFilter", statusFilter)
  }

  if (condition) {
    params.set("condition", condition)
  }

  if (alert) {
    params.set("alert", alert)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-gear?${query}` : "/team-gear"
}

export function buildTeamGearRedirectPath(input) {
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

  const type = resolveTeamGearTypeFilter(input.scopeType)
  const statusFilter = resolveTeamGearStatusFilter(input.scopeStatus)
  const condition = resolveTeamGearConditionFilter(input.scopeCondition)
  const alert = resolveTeamGearAlertFilter(input.scopeAlert)

  if (type) {
    params.set("type", type)
  }

  if (statusFilter) {
    params.set("statusFilter", statusFilter)
  }

  if (condition) {
    params.set("condition", condition)
  }

  if (alert) {
    params.set("alert", alert)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(Math.floor(input.scopePage)))

    if (input.scopeLoadMore) {
      params.set("loadMore", "1")
    }
  }

  const query = params.toString()
  return query.length > 0 ? `/team-gear?${query}` : "/team-gear"
}
