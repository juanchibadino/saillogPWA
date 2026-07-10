import { NextResponse } from "next/server"

import {
  getSessionDetailShellData,
  getSessionDetailTabData,
} from "@/features/sessions/detail-data"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import {
  buildSessionDetailTabCacheMetadata,
  isSessionAssetTab,
} from "@/features/sessions/session-detail-tab-cache"
import {
  buildApiSliceErrorPayload,
} from "@/features/shared/api-slice-contracts"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

function resolveTab(value: string | null): SessionDetailTab | null {
  if (!value) {
    return null
  }

  return SESSION_DETAIL_TABS.includes(value as SessionDetailTab)
    ? (value as SessionDetailTab)
    : null
}

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const sessionId = resolvedParams.id?.trim()

  if (!sessionId) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_session_id" }),
      { status: 400 },
    )
  }

  const requestUrl = new URL(request.url)
  const tab = resolveTab(requestUrl.searchParams.get("tab"))
  const parsedAssetOffset = Number.parseInt(requestUrl.searchParams.get("assetOffset") ?? "0", 10)
  const assetOffset = Number.isFinite(parsedAssetOffset)
    ? Math.max(0, parsedAssetOffset)
    : 0

  if (!tab) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_tab" }),
      { status: 400 },
    )
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "unauthorized" }),
      { status: 401 },
    )
  }

  const authenticatedContext = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context: authenticatedContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "scope_required" }),
      { status: 403 },
    )
  }

  const shellData = await getSessionDetailShellData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    sessionId,
  })

  if (!shellData) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "session_not_found" }),
      { status: 404 },
    )
  }

  try {
    const data = await getSessionDetailTabData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: shellData.team.id,
      assetOffset,
      goals: shellData.session.goals,
      sessionId: shellData.session.id,
      tab,
      teamVenueId: shellData.camp.team_venue_id,
    })
    const cache = buildSessionDetailTabCacheMetadata({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      sessionId: shellData.session.id,
      tab,
      assetOffset: isSessionAssetTab(tab) ? assetOffset : 0,
      catalogOffset: 0,
    })

    return NextResponse.json({ cache, data, tab })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown tab data error"
    return NextResponse.json(
      buildApiSliceErrorPayload({
        detail,
        error: "tab_data_failed",
        retryable: true,
      }),
      { status: 500 },
    )
  }
}
