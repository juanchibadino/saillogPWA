import { NextResponse } from "next/server"

import {
  getSessionDetailSetupData,
  getSessionDetailShellData,
} from "@/features/sessions/detail-data"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type RouteContext = {
  params: Promise<{ id: string }>
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
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 })
  }

  const requestUrl = new URL(request.url)
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const authenticatedContext = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context: authenticatedContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json({ error: "scope_required" }, { status: 403 })
  }

  const shellData = await getSessionDetailShellData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    sessionId,
  })

  if (!shellData) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 })
  }

  const canManageSession = canManageTeamSessions({
    context: authenticatedContext,
    organizationId: navigation.scope.activeOrgId,
    teamId: shellData.team.id,
  })

  if (!canManageSession) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const data = await getSessionDetailSetupData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: shellData.team.id,
      sessionId: shellData.session.id,
      teamVenueId: shellData.camp.team_venue_id,
    })

    return NextResponse.json({ data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown setup data error"
    return NextResponse.json({ detail, error: "setup_data_failed" }, { status: 500 })
  }
}
