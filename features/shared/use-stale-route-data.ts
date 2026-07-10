"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  buildScopedRouteCacheScopeKey,
  readScopedRouteCache,
  writeScopedRouteCache,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"

export type StaleRouteDataStatus =
  | "idle"
  | "cached"
  | "fresh"
  | "revalidating"
  | "error"

export type StaleRouteDataCacheMeta = {
  cachedAt: number
  staleAt: number
  expiresAt: number
  isStale: boolean
}

export type StaleRouteDataFetchContext = {
  cacheKey: string
  scope: ScopedRouteCacheScope
  scopeKey: string
  signal: AbortSignal
}

export type StaleRouteDataValidationContext = Omit<
  StaleRouteDataFetchContext,
  "signal"
>

export type UseStaleRouteDataInput<TPayload> = {
  cacheKey: string
  scope: ScopedRouteCacheScope
  staleMs: number
  fetchFreshData: (context: StaleRouteDataFetchContext) => Promise<TPayload>
  validateFreshPayload: (
    payload: TPayload,
    context: StaleRouteDataValidationContext,
  ) => boolean
  enabled?: boolean
  initialData?: TPayload | null
  maxAgeMs?: number
  storage?: Storage | null
}

export type UseStaleRouteDataResult<TPayload> = {
  status: StaleRouteDataStatus
  data: TPayload | null
  error: Error | null
  cacheMeta: StaleRouteDataCacheMeta | null
  isFetching: boolean
  isRevalidating: boolean
  hasData: boolean
  refresh: () => void
  retry: () => void
}

type StaleRouteDataState<TPayload> = Omit<
  UseStaleRouteDataResult<TPayload>,
  "hasData" | "refresh" | "retry"
>

function createIdleState<TPayload>(): StaleRouteDataState<TPayload> {
  return {
    status: "idle",
    data: null,
    error: null,
    cacheMeta: null,
    isFetching: false,
    isRevalidating: false,
  }
}

function createError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return new Error(value)
  }

  return new Error("Could not load fresh route data.")
}

function resolveInitialState<TPayload>(input: {
  enabled: boolean
  initialData?: TPayload | null
}): StaleRouteDataState<TPayload> {
  if (!input.enabled) {
    return createIdleState()
  }

  if (typeof input.initialData !== "undefined" && input.initialData !== null) {
    return {
      status: "fresh",
      data: input.initialData,
      error: null,
      cacheMeta: null,
      isFetching: false,
      isRevalidating: false,
    }
  }

  return createIdleState()
}

function getCacheMetaFromFreshWrite(input: {
  cachedAt: number
  staleMs: number
  maxAgeMs: number
}): StaleRouteDataCacheMeta {
  return {
    cachedAt: input.cachedAt,
    staleAt: input.cachedAt + input.staleMs,
    expiresAt: input.cachedAt + input.maxAgeMs,
    isStale: false,
  }
}

export function useStaleRouteData<TPayload>(
  input: UseStaleRouteDataInput<TPayload>,
): UseStaleRouteDataResult<TPayload> {
  const {
    cacheKey,
    enabled = true,
    fetchFreshData,
    initialData,
    maxAgeMs,
    staleMs,
    storage,
    validateFreshPayload,
  } = input
  const scope = useMemo<ScopedRouteCacheScope>(
    () => ({
      orgId: input.scope.orgId,
      teamId: input.scope.teamId,
    }),
    [input.scope.orgId, input.scope.teamId],
  )
  const scopeKey = useMemo(() => buildScopedRouteCacheScopeKey(scope), [scope])
  const identityKey = `${scopeKey}:${cacheKey}`
  const [refreshIndex, setRefreshIndex] = useState(0)
  const requestVersionRef = useRef(0)
  const activeIdentityRef = useRef<string | null>(null)
  const [state, setState] = useState<StaleRouteDataState<TPayload>>(() =>
    resolveInitialState({
      enabled,
      initialData,
    }),
  )

  const refresh = useCallback(() => {
    setRefreshIndex((currentValue) => currentValue + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      requestVersionRef.current += 1
      activeIdentityRef.current = identityKey
      setState(createIdleState<TPayload>())
      return
    }

    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion

    const controller = new AbortController()
    const didIdentityChange = activeIdentityRef.current !== identityKey
    activeIdentityRef.current = identityKey
    const cacheResult = didIdentityChange
      ? readScopedRouteCache<TPayload>({
          key: cacheKey,
          scope,
          storage,
        })
      : null

    setState((currentState) => {
      if (cacheResult?.status === "hit") {
        return {
          status: "cached",
          data: cacheResult.payload,
          error: null,
          cacheMeta: {
            cachedAt: cacheResult.cachedAt,
            staleAt: cacheResult.staleAt,
            expiresAt: cacheResult.expiresAt,
            isStale: cacheResult.isStale,
          },
          isFetching: true,
          isRevalidating: true,
        }
      }

      if (
        didIdentityChange &&
        typeof initialData !== "undefined" &&
        initialData !== null
      ) {
        return {
          status: "revalidating",
          data: initialData,
          error: null,
          cacheMeta: null,
          isFetching: true,
          isRevalidating: true,
        }
      }

      if (!didIdentityChange && currentState.data !== null) {
        return {
          ...currentState,
          status: "revalidating",
          error: null,
          isFetching: true,
          isRevalidating: true,
        }
      }

      return {
        ...createIdleState<TPayload>(),
        isFetching: true,
      }
    })

    async function loadFreshData(): Promise<void> {
      try {
        const payload = await fetchFreshData({
          cacheKey,
          scope,
          scopeKey,
          signal: controller.signal,
        })

        if (controller.signal.aborted || requestVersionRef.current !== requestVersion) {
          return
        }

        const validationContext: StaleRouteDataValidationContext = {
          cacheKey,
          scope,
          scopeKey,
        }

        if (!validateFreshPayload(payload, validationContext)) {
          throw new Error("Fresh route data failed scoped validation.")
        }

        const cachedAt = Date.now()
        const resolvedMaxAgeMs = maxAgeMs ?? 24 * 60 * 60 * 1000

        const didWriteCache = writeScopedRouteCache({
          key: cacheKey,
          scope,
          payload,
          staleMs,
          maxAgeMs: resolvedMaxAgeMs,
          now: cachedAt,
          storage,
        })

        setState({
          status: "fresh",
          data: payload,
          error: null,
          cacheMeta: didWriteCache
            ? getCacheMetaFromFreshWrite({
                cachedAt,
                staleMs,
                maxAgeMs: resolvedMaxAgeMs,
              })
            : null,
          isFetching: false,
          isRevalidating: false,
        })
      } catch (error) {
        if (controller.signal.aborted || requestVersionRef.current !== requestVersion) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          status: "error",
          error: createError(error),
          isFetching: false,
          isRevalidating: false,
        }))
      }
    }

    void loadFreshData()

    return () => {
      controller.abort()
    }
  }, [
    cacheKey,
    enabled,
    fetchFreshData,
    identityKey,
    initialData,
    maxAgeMs,
    refreshIndex,
    scope,
    scopeKey,
    staleMs,
    storage,
    validateFreshPayload,
  ])

  return {
    ...state,
    hasData: state.data !== null,
    refresh,
    retry: refresh,
  }
}
