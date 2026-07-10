import {
  buildScopedRouteCacheKey,
  buildScopedRouteCacheScopeKey,
  normalizeScopedRouteCacheFilters,
  type ScopedRouteCacheFilters,
  type ScopedRouteCacheKeyInput,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"

export type ApiSliceCacheMetadata = {
  key: string
  scope: ScopedRouteCacheScope
  scopeKey: string
  route: string
  entityId: string | number | null
  tab: string | number | null
  year: string | number | null
  filters: string
  page: string | number | null
}

export type ApiSliceErrorPayload = {
  error: string
  detail?: string
  retryable: boolean
}

function normalizeMetadataValue(
  value: string | number | null | undefined,
): string | number | null {
  return typeof value === "undefined" ? null : value
}

export function buildApiSliceCacheMetadata(
  input: ScopedRouteCacheKeyInput,
): ApiSliceCacheMetadata {
  return {
    key: buildScopedRouteCacheKey(input),
    scope: input.scope,
    scopeKey: buildScopedRouteCacheScopeKey(input.scope),
    route: input.route,
    entityId: normalizeMetadataValue(input.entityId),
    tab: normalizeMetadataValue(input.tab),
    year: normalizeMetadataValue(input.year),
    filters: normalizeScopedRouteCacheFilters(input.filters),
    page: normalizeMetadataValue(input.page),
  }
}

export function buildApiSliceErrorPayload(input: {
  detail?: string
  error: string
  retryable?: boolean
}): ApiSliceErrorPayload {
  return {
    error: input.error,
    detail: input.detail,
    retryable: input.retryable === true,
  }
}

export function buildListCacheFilters(
  filters: Record<string, string | number | boolean | null | undefined>,
): ScopedRouteCacheFilters {
  return filters
}
