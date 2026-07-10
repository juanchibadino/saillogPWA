"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import {
  getRouteCacheInvalidationScopeKey,
  invalidateCampDetailRouteCache,
  invalidateCampMutationRouteCache,
  invalidateSessionAssetRouteCache,
  invalidateSessionMutationRouteCache,
  invalidateVenueDetailRouteCache,
  invalidateVenueMutationRouteCache,
  type CampDetailCacheTab,
  type RouteCacheInvalidationScope,
  type SessionAssetCacheTab,
  type VenueDetailCacheTab,
} from "@/features/shared/scoped-route-cache-invalidation"

type BaseRouteCacheInvalidationProps = {
  scope: RouteCacheInvalidationScope
  searchParamName?: "result" | "status"
  successStatuses?: readonly string[]
}

type RouteCacheInvalidationOnSuccessProps =
  | (BaseRouteCacheInvalidationProps & {
      campId?: string | null
      mutation: "session"
      sessionId?: string | null
      teamVenueId?: string | null
    })
  | (BaseRouteCacheInvalidationProps & {
      mutation: "session-assets"
      sessionId: string
      tabs?: readonly SessionAssetCacheTab[]
    })
  | (BaseRouteCacheInvalidationProps & {
      campId?: string | null
      mutation: "camp"
      teamVenueId?: string | null
    })
  | (BaseRouteCacheInvalidationProps & {
      campId: string
      mutation: "camp-detail"
      tabs?: readonly CampDetailCacheTab[]
    })
  | (BaseRouteCacheInvalidationProps & {
      mutation: "venue"
      teamVenueId?: string | null
    })
  | (BaseRouteCacheInvalidationProps & {
      mutation: "venue-detail"
      tabs?: readonly VenueDetailCacheTab[]
      teamVenueId: string
    })

const DEFAULT_SUCCESS_STATUSES: Record<
  RouteCacheInvalidationOnSuccessProps["mutation"],
  readonly string[]
> = {
  session: ["created", "updated", "deleted"],
  "session-assets": ["asset_uploaded", "asset_deleted"],
  camp: ["created", "updated", "deleted"],
  "camp-detail": ["goals_updated"],
  venue: ["linked_existing", "created_and_linked", "updated", "deleted"],
  "venue-detail": [
    "report_created",
    "template_saved",
    "run_saved",
    "run_published",
    "run_closed",
    "answers_saved",
    "wind_pattern_created",
    "wind_pattern_updated",
    "wind_pattern_archived",
    "wind_pattern_restored",
  ],
}

function getVenueDetailCacheTabsForStatus(
  status: string,
): readonly VenueDetailCacheTab[] | undefined {
  if (status === "report_created") {
    return ["reports"]
  }

  if (
    status === "wind_pattern_created" ||
    status === "wind_pattern_updated" ||
    status === "wind_pattern_archived" ||
    status === "wind_pattern_restored"
  ) {
    return ["wind-patterns"]
  }

  if (
    status === "template_saved" ||
    status === "run_saved" ||
    status === "run_published" ||
    status === "run_closed" ||
    status === "answers_saved"
  ) {
    return ["assessments"]
  }

  return undefined
}

function buildInvalidationSignature(
  status: string,
  props: RouteCacheInvalidationOnSuccessProps,
): string {
  const scopeKey = getRouteCacheInvalidationScopeKey(props.scope)

  if (props.mutation === "session") {
    return [
      props.mutation,
      status,
      scopeKey,
      props.sessionId ?? "",
      props.campId ?? "",
      props.teamVenueId ?? "",
    ].join(":")
  }

  if (props.mutation === "session-assets") {
    return [
      props.mutation,
      status,
      scopeKey,
      props.sessionId,
      props.tabs?.join(",") ?? "",
    ].join(":")
  }

  if (props.mutation === "camp") {
    return [
      props.mutation,
      status,
      scopeKey,
      props.campId ?? "",
      props.teamVenueId ?? "",
    ].join(":")
  }

  if (props.mutation === "camp-detail") {
    return [
      props.mutation,
      status,
      scopeKey,
      props.campId,
      props.tabs?.join(",") ?? "",
    ].join(":")
  }

  if (props.mutation === "venue") {
    return [
      props.mutation,
      status,
      scopeKey,
      props.teamVenueId ?? "",
    ].join(":")
  }

  return [
    props.mutation,
    status,
    scopeKey,
    props.teamVenueId,
    props.tabs?.join(",") ?? "",
  ].join(":")
}

export function RouteCacheInvalidationOnSuccess(
  props: RouteCacheInvalidationOnSuccessProps,
) {
  const searchParams = useSearchParams()
  const searchParamName = props.searchParamName ?? "status"
  const lastSignatureRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const status = searchParams.get(searchParamName)

    if (!status) {
      return
    }

    const successStatuses = props.successStatuses ?? DEFAULT_SUCCESS_STATUSES[props.mutation]

    if (!successStatuses.includes(status)) {
      return
    }

    const signature = buildInvalidationSignature(status, props)

    if (lastSignatureRef.current === signature) {
      return
    }

    lastSignatureRef.current = signature

    if (props.mutation === "session") {
      invalidateSessionMutationRouteCache({
        scope: props.scope,
        sessionId: props.sessionId,
        campId: props.campId,
        teamVenueId: props.teamVenueId,
      })
      return
    }

    if (props.mutation === "session-assets") {
      invalidateSessionAssetRouteCache({
        scope: props.scope,
        sessionId: props.sessionId,
        tabs: props.tabs,
      })
      return
    }

    if (props.mutation === "camp") {
      invalidateCampMutationRouteCache({
        scope: props.scope,
        campId: props.campId,
        teamVenueId: props.teamVenueId,
      })
      return
    }

    if (props.mutation === "camp-detail") {
      invalidateCampDetailRouteCache({
        scope: props.scope,
        campId: props.campId,
        tabs: props.tabs,
      })
      return
    }

    if (props.mutation === "venue") {
      invalidateVenueMutationRouteCache({
        scope: props.scope,
        teamVenueId: props.teamVenueId,
      })
      return
    }

    invalidateVenueDetailRouteCache({
      scope: props.scope,
      teamVenueId: props.teamVenueId,
      tabs: props.tabs ?? getVenueDetailCacheTabsForStatus(status),
    })
  }, [props, searchParamName, searchParams])

  return null
}
