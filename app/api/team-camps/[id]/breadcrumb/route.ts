import { NextResponse } from "next/server"

import { getCampDetailShellData } from "@/features/camps/detail-data"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type CampBreadcrumbPayload = {
  team_name: string | null
  venue_name: string | null
  camp_name: string | null
  team_venue_id: string | null
}

type RouteContext = {
  params: Promise<{ id: string }>
}

const emptyCampBreadcrumbPayload: CampBreadcrumbPayload = {
  team_name: null,
  venue_name: null,
  camp_name: null,
  team_venue_id: null,
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
  const campId = resolvedParams.id?.trim()

  if (!campId) {
    return NextResponse.json(emptyCampBreadcrumbPayload, { status: 400 })
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json(emptyCampBreadcrumbPayload, { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const authenticatedContext = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context: authenticatedContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json(emptyCampBreadcrumbPayload, { status: 403 })
  }

  const shellData = await getCampDetailShellData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    campId,
  })

  if (!shellData) {
    return NextResponse.json(emptyCampBreadcrumbPayload, { status: 404 })
  }

  const activeTeamName =
    navigation.catalog.teamsByOrganizationId[navigation.scope.activeOrgId]?.find(
      (team) => team.id === navigation.scope?.activeTeamId,
    )?.name ?? null

  return NextResponse.json({
    team_name: activeTeamName,
    venue_name: shellData.camp.venueName,
    camp_name: shellData.camp.name,
    team_venue_id: shellData.teamVenue.id,
  })
}
