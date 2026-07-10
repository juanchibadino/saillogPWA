"use client"

import {
  clearScopedRouteCache,
  buildScopedRouteCacheScopeKey,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"

type NavigationLikeScope = {
  activeOrgId: string
  activeTeamId: string | null
}

export type RouteCacheInvalidationScope =
  | ScopedRouteCacheScope
  | NavigationLikeScope

export type SessionDetailCacheTab =
  | "info"
  | "goals"
  | "results"
  | "images"
  | "analytics"
  | "gear"

export type SessionAssetCacheTab = "images" | "analytics"
export type CampDetailCacheTab = "sessions" | "goals" | "notes"
export type VenueDetailCacheTab =
  | "camps"
  | "sessions"
  | "wind-patterns"
  | "assessments"
  | "reports"

const SESSION_ASSET_CACHE_TABS: SessionAssetCacheTab[] = ["images", "analytics"]
const SESSION_DETAIL_CACHE_TABS: SessionDetailCacheTab[] = [
  "info",
  "goals",
  "results",
  "images",
  "analytics",
  "gear",
]
const CAMP_DETAIL_CACHE_TABS: CampDetailCacheTab[] = ["sessions", "goals", "notes"]
const VENUE_DETAIL_CACHE_TABS: VenueDetailCacheTab[] = [
  "camps",
  "sessions",
  "wind-patterns",
  "assessments",
  "reports",
]

function toScopedRouteCacheScope(
  scope: RouteCacheInvalidationScope,
): ScopedRouteCacheScope {
  if ("orgId" in scope) {
    return scope
  }

  return {
    orgId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  }
}

function normalizeOptionalId(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function clearRoute(input: {
  entityId?: string | null
  route: string
  scope: ScopedRouteCacheScope
  tab?: string | null
}): number {
  return clearScopedRouteCache({
    scope: input.scope,
    route: input.route,
    entityId: input.entityId,
    tab: input.tab,
  })
}

export function getRouteCacheInvalidationScopeKey(
  scope: RouteCacheInvalidationScope,
): string {
  return buildScopedRouteCacheScopeKey(toScopedRouteCacheScope(scope))
}

export function invalidateSessionMutationRouteCache(input: {
  campId?: string | null
  scope: RouteCacheInvalidationScope
  sessionId?: string | null
  teamVenueId?: string | null
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const campId = normalizeOptionalId(input.campId)
  const sessionId = normalizeOptionalId(input.sessionId)
  const teamVenueId = normalizeOptionalId(input.teamVenueId)
  let removedCount = 0

  removedCount += clearRoute({ scope, route: "team-venues:list" })
  removedCount += clearRoute({ scope, route: "team-camps:list" })
  removedCount += clearRoute({ scope, route: "team-sessions:list" })

  if (sessionId) {
    removedCount += clearRoute({
      scope,
      route: "team-sessions:tab-data",
      entityId: sessionId,
    })
  }

  if (campId) {
    removedCount += clearRoute({
      scope,
      route: "team-camps:tab-data",
      entityId: campId,
      tab: "sessions",
    })
    removedCount += clearRoute({
      scope,
      route: "team-camps:tab-data",
      entityId: campId,
      tab: "notes",
    })
  }

  if (teamVenueId) {
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: teamVenueId,
      tab: "sessions",
    })
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: teamVenueId,
      tab: "reports",
    })
  }

  return removedCount
}

export function invalidateSessionDetailRouteCache(input: {
  scope: RouteCacheInvalidationScope
  sessionId: string
  tabs?: readonly SessionDetailCacheTab[]
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const tabs = input.tabs && input.tabs.length > 0 ? input.tabs : SESSION_DETAIL_CACHE_TABS
  let removedCount = 0

  for (const tab of tabs) {
    removedCount += clearRoute({
      scope,
      route: "team-sessions:tab-data",
      entityId: input.sessionId,
      tab,
    })
  }

  return removedCount
}

export function invalidateSessionAssetRouteCache(input: {
  scope: RouteCacheInvalidationScope
  sessionId: string
  tabs?: readonly SessionAssetCacheTab[]
}): number {
  const tabs = input.tabs && input.tabs.length > 0 ? input.tabs : SESSION_ASSET_CACHE_TABS
  return invalidateSessionDetailRouteCache({
    scope: input.scope,
    sessionId: input.sessionId,
    tabs,
  })
}

export function invalidateCampMutationRouteCache(input: {
  campId?: string | null
  scope: RouteCacheInvalidationScope
  teamVenueId?: string | null
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const campId = normalizeOptionalId(input.campId)
  const teamVenueId = normalizeOptionalId(input.teamVenueId)
  let removedCount = 0

  removedCount += clearRoute({ scope, route: "team-venues:list" })
  removedCount += clearRoute({ scope, route: "team-camps:list" })
  removedCount += clearRoute({ scope, route: "team-sessions:list" })

  if (campId) {
    removedCount += clearRoute({
      scope,
      route: "team-camps:tab-data",
      entityId: campId,
    })
  }

  if (teamVenueId) {
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: teamVenueId,
      tab: "camps",
    })
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: teamVenueId,
      tab: "sessions",
    })
  }

  return removedCount
}

export function invalidateCampDetailRouteCache(input: {
  campId: string
  scope: RouteCacheInvalidationScope
  tabs?: readonly CampDetailCacheTab[]
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const tabs = input.tabs && input.tabs.length > 0 ? input.tabs : CAMP_DETAIL_CACHE_TABS
  let removedCount = 0

  for (const tab of tabs) {
    removedCount += clearRoute({
      scope,
      route: "team-camps:tab-data",
      entityId: input.campId,
      tab,
    })
  }

  return removedCount
}

export function invalidateVenueMutationRouteCache(input: {
  scope: RouteCacheInvalidationScope
  teamVenueId?: string | null
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const teamVenueId = normalizeOptionalId(input.teamVenueId)
  let removedCount = 0

  removedCount += clearRoute({ scope, route: "team-venues:list" })
  removedCount += clearRoute({ scope, route: "team-camps:list" })
  removedCount += clearRoute({ scope, route: "team-sessions:list" })

  if (teamVenueId) {
    removedCount += clearRoute({
      scope,
      route: "venues:chrome",
      entityId: teamVenueId,
    })
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: teamVenueId,
    })
  }

  return removedCount
}

export function invalidateVenueDetailRouteCache(input: {
  scope: RouteCacheInvalidationScope
  tabs?: readonly VenueDetailCacheTab[]
  teamVenueId: string
}): number {
  const scope = toScopedRouteCacheScope(input.scope)
  const tabs = input.tabs && input.tabs.length > 0 ? input.tabs : VENUE_DETAIL_CACHE_TABS
  let removedCount = 0

  for (const tab of tabs) {
    removedCount += clearRoute({
      scope,
      route: "venues:tab-data",
      entityId: input.teamVenueId,
      tab,
    })
  }

  if (tabs.includes("wind-patterns")) {
    removedCount += clearRoute({
      scope,
      route: "team-sessions:tab-data",
    })
  }

  return removedCount
}
