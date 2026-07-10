const CACHE_KEY_ROOT = "sailog:v1"
const EMPTY_SEGMENT = "_"
const NO_TEAM_SEGMENT = "no-team"
const DEFAULT_ROUTE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const SCOPED_ROUTE_CACHE_SCHEMA_VERSION = 1
export const SCOPED_ROUTE_LIST_STALE_MS = 2 * 60 * 1000
export const SCOPED_ROUTE_DETAIL_TAB_STALE_MS = 5 * 60 * 1000
export const SCOPED_ROUTE_CACHE_MAX_AGE_MS = DEFAULT_ROUTE_CACHE_MAX_AGE_MS

type PrimitiveFilterValue = string | number | boolean | null

export type ScopedRouteCacheFilterValue =
  | PrimitiveFilterValue
  | readonly PrimitiveFilterValue[]
  | undefined

export type ScopedRouteCacheFilters =
  | string
  | URLSearchParams
  | Record<string, ScopedRouteCacheFilterValue>
  | null
  | undefined

export type ScopedRouteCacheScope = {
  orgId: string
  teamId: string | null
}

export type ScopedRouteCacheKeyInput = {
  scope: ScopedRouteCacheScope
  route: string
  entityId?: string | number | null
  tab?: string | null
  year?: string | number | null
  filters?: ScopedRouteCacheFilters
  page?: string | number | null
}

export type ScopedRouteCachePrefixInput = {
  scope?: ScopedRouteCacheScope
  route?: string
  entityId?: string | number | null
  tab?: string | null
  year?: string | number | null
}

export type ScopedRouteCacheWriteInput<TPayload> = {
  key: string
  scope: ScopedRouteCacheScope
  payload: TPayload
  staleMs: number
  maxAgeMs?: number
  now?: number
  storage?: Storage | null
}

export type ScopedRouteCacheHit<TPayload> = {
  status: "hit"
  payload: TPayload
  cachedAt: number
  staleAt: number
  expiresAt: number
  isStale: boolean
}

export type ScopedRouteCacheMissReason =
  | "storage_unavailable"
  | "not_found"
  | "parse_error"
  | "schema_mismatch"
  | "scope_mismatch"
  | "expired"

export type ScopedRouteCacheMiss = {
  status: "miss"
  reason: ScopedRouteCacheMissReason
}

export type ScopedRouteCacheReadResult<TPayload> =
  | ScopedRouteCacheHit<TPayload>
  | ScopedRouteCacheMiss

type ScopedRouteCacheEnvelope<TPayload> = {
  schemaVersion: number
  scopeKey: string
  cachedAt: number
  staleAt: number
  expiresAt: number
  payload: TPayload
}

function getNow(inputNow?: number): number {
  return typeof inputNow === "number" && Number.isFinite(inputNow)
    ? inputNow
    : Date.now()
}

function getRouteCacheStorage(storage?: Storage | null): Storage | null {
  if (typeof storage !== "undefined") {
    return storage
  }

  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage
}

function normalizeSegment(value: string | number | null | undefined): string {
  if (typeof value === "undefined" || value === null || value === "") {
    return EMPTY_SEGMENT
  }

  return String(value)
}

function encodeSegment(value: string | number | null | undefined): string {
  return encodeURIComponent(normalizeSegment(value))
}

function normalizeFilterValue(value: ScopedRouteCacheFilterValue): string {
  if (typeof value === "undefined") {
    return EMPTY_SEGMENT
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => normalizeFilterValue(item)).join(",")}]`
  }

  if (value === null) {
    return "null"
  }

  return String(value)
}

export function buildScopedRouteCacheScopeKey(
  scope: ScopedRouteCacheScope,
): string {
  return `${scope.orgId}:${scope.teamId ?? NO_TEAM_SEGMENT}`
}

export function normalizeScopedRouteCacheFilters(
  filters: ScopedRouteCacheFilters,
): string {
  if (!filters) {
    return EMPTY_SEGMENT
  }

  if (typeof filters === "string") {
    return filters.trim().length > 0 ? filters : EMPTY_SEGMENT
  }

  if (filters instanceof URLSearchParams) {
    const entries = Array.from(filters.entries()).sort(([leftKey, leftValue], [
      rightKey,
      rightValue,
    ]) => {
      const keyComparison = leftKey.localeCompare(rightKey)
      return keyComparison === 0 ? leftValue.localeCompare(rightValue) : keyComparison
    })

    if (entries.length === 0) {
      return EMPTY_SEGMENT
    }

    return entries
      .map(([key, value]) => `${key}=${value}`)
      .join("&")
  }

  const entries = Object.entries(filters)
    .filter((entry): entry is [string, Exclude<ScopedRouteCacheFilterValue, undefined>] => {
      const [, value] = entry
      return typeof value !== "undefined"
    })
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  if (entries.length === 0) {
    return EMPTY_SEGMENT
  }

  return entries
    .map(([key, value]) => `${key}=${normalizeFilterValue(value)}`)
    .join("&")
}

export function buildScopedRouteCacheKey(
  input: ScopedRouteCacheKeyInput,
): string {
  const teamSegment = input.scope.teamId ?? NO_TEAM_SEGMENT
  const filtersSegment = normalizeScopedRouteCacheFilters(input.filters)

  return [
    CACHE_KEY_ROOT,
    encodeSegment(input.scope.orgId),
    encodeSegment(teamSegment),
    encodeSegment(input.route),
    encodeSegment(input.entityId),
    encodeSegment(input.tab),
    encodeSegment(input.year),
    encodeSegment(filtersSegment),
    encodeSegment(input.page),
  ].join(":")
}

export function buildScopedRouteCachePrefix(
  input: ScopedRouteCachePrefixInput = {},
): string {
  const segments = [CACHE_KEY_ROOT]

  if (input.scope) {
    segments.push(encodeSegment(input.scope.orgId))
    segments.push(encodeSegment(input.scope.teamId ?? NO_TEAM_SEGMENT))
  }

  if (typeof input.route !== "undefined") {
    segments.push(encodeSegment(input.route))
  }

  if (typeof input.entityId !== "undefined") {
    segments.push(encodeSegment(input.entityId))
  }

  if (typeof input.tab !== "undefined") {
    segments.push(encodeSegment(input.tab))
  }

  if (typeof input.year !== "undefined") {
    segments.push(encodeSegment(input.year))
  }

  return segments.join(":")
}

function isCacheEnvelope(value: unknown): value is ScopedRouteCacheEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.schemaVersion === "number" &&
    typeof record.scopeKey === "string" &&
    typeof record.cachedAt === "number" &&
    typeof record.staleAt === "number" &&
    typeof record.expiresAt === "number" &&
    "payload" in record
  )
}

export function writeScopedRouteCache<TPayload>(
  input: ScopedRouteCacheWriteInput<TPayload>,
): boolean {
  const storage = getRouteCacheStorage(input.storage)

  if (!storage) {
    return false
  }

  const now = getNow(input.now)
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_ROUTE_CACHE_MAX_AGE_MS
  const envelope: ScopedRouteCacheEnvelope<TPayload> = {
    schemaVersion: SCOPED_ROUTE_CACHE_SCHEMA_VERSION,
    scopeKey: buildScopedRouteCacheScopeKey(input.scope),
    cachedAt: now,
    staleAt: now + input.staleMs,
    expiresAt: now + maxAgeMs,
    payload: input.payload,
  }

  try {
    storage.setItem(input.key, JSON.stringify(envelope))
    return true
  } catch {
    return false
  }
}

export function readScopedRouteCache<TPayload>(input: {
  key: string
  scope: ScopedRouteCacheScope
  now?: number
  storage?: Storage | null
}): ScopedRouteCacheReadResult<TPayload> {
  const storage = getRouteCacheStorage(input.storage)

  if (!storage) {
    return {
      status: "miss",
      reason: "storage_unavailable",
    }
  }

  let rawValue: string | null

  try {
    rawValue = storage.getItem(input.key)
  } catch {
    return {
      status: "miss",
      reason: "storage_unavailable",
    }
  }

  if (!rawValue) {
    return {
      status: "miss",
      reason: "not_found",
    }
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(rawValue)
  } catch {
    storage.removeItem(input.key)
    return {
      status: "miss",
      reason: "parse_error",
    }
  }

  if (
    !isCacheEnvelope(parsedValue) ||
    parsedValue.schemaVersion !== SCOPED_ROUTE_CACHE_SCHEMA_VERSION
  ) {
    storage.removeItem(input.key)
    return {
      status: "miss",
      reason: "schema_mismatch",
    }
  }

  if (parsedValue.scopeKey !== buildScopedRouteCacheScopeKey(input.scope)) {
    return {
      status: "miss",
      reason: "scope_mismatch",
    }
  }

  const now = getNow(input.now)

  if (parsedValue.expiresAt <= now) {
    storage.removeItem(input.key)
    return {
      status: "miss",
      reason: "expired",
    }
  }

  return {
    status: "hit",
    payload: parsedValue.payload as TPayload,
    cachedAt: parsedValue.cachedAt,
    staleAt: parsedValue.staleAt,
    expiresAt: parsedValue.expiresAt,
    isStale: parsedValue.staleAt <= now,
  }
}

export function clearScopedRouteCacheByPrefix(input: {
  prefix: string
  storage?: Storage | null
}): number {
  const storage = getRouteCacheStorage(input.storage)

  if (!storage) {
    return 0
  }

  let removedCount = 0

  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)

      if (key && (key === input.prefix || key.startsWith(`${input.prefix}:`))) {
        storage.removeItem(key)
        removedCount += 1
      }
    }
  } catch {
    return removedCount
  }

  return removedCount
}

export function clearScopedRouteCache(input: {
  scope?: ScopedRouteCacheScope
  route?: string
  entityId?: string | number | null
  tab?: string | null
  year?: string | number | null
  storage?: Storage | null
} = {}): number {
  return clearScopedRouteCacheByPrefix({
    prefix: buildScopedRouteCachePrefix(input),
    storage: input.storage,
  })
}
