import { NextResponse } from "next/server"

import {
  getSessionDetailGearCatalogData,
  getSessionDetailGearItemByBarcode,
  getSessionDetailShellData,
  getSessionDetailStandardMovesCatalogData,
  getSessionDetailWindPatternsCatalogData,
  resolveSessionDetailGearTypeFilter,
} from "@/features/sessions/detail-data"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

type SessionCatalogKind = "standardMoves" | "windPatterns" | "gear" | "gearBarcode"

function resolveCatalogKind(value: string | null): SessionCatalogKind | null {
  if (
    value === "standardMoves" ||
    value === "windPatterns" ||
    value === "gear" ||
    value === "gearBarcode"
  ) {
    return value
  }

  return null
}

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

function parseCatalogOffset(value: string | null): number {
  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const sessionId = resolvedParams.id?.trim()

  if (!sessionId) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 })
  }

  const requestUrl = new URL(request.url)
  const catalog = resolveCatalogKind(requestUrl.searchParams.get("catalog"))

  if (!catalog) {
    return NextResponse.json({ error: "invalid_catalog" }, { status: 400 })
  }

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

  const offset = parseCatalogOffset(requestUrl.searchParams.get("offset"))
  const search = requestUrl.searchParams.get("search") ?? ""

  try {
    if (catalog === "standardMoves") {
      const linkedStandardMoveIds = requestUrl.searchParams.getAll("linkedStandardMoveId")
      const data = await getSessionDetailStandardMovesCatalogData({
        activeTeamId: shellData.team.id,
        linkedStandardMoveIds,
        offset,
        search,
      })

      return NextResponse.json({ catalog, data })
    }

    if (catalog === "windPatterns") {
      const linkedWindPatternIds = requestUrl.searchParams.getAll("linkedWindPatternId")
      const data = await getSessionDetailWindPatternsCatalogData({
        linkedWindPatternIds,
        offset,
        search,
        teamVenueId: shellData.camp.team_venue_id,
      })

      return NextResponse.json({ catalog, data })
    }

    if (catalog === "gearBarcode") {
      const gearItem = await getSessionDetailGearItemByBarcode({
        activeTeamId: shellData.team.id,
        barcode: requestUrl.searchParams.get("barcode") ?? "",
      })

      return NextResponse.json({
        catalog,
        data: {
          gearItem,
        },
      })
    }

    const linkedGearItemIds = requestUrl.searchParams.getAll("linkedGearItemId")
    const data = await getSessionDetailGearCatalogData({
      activeTeamId: shellData.team.id,
      gearType: resolveSessionDetailGearTypeFilter(requestUrl.searchParams.get("gearType")),
      linkedGearItemIds,
      offset,
      search,
    })

    return NextResponse.json({ catalog, data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown catalog data error"
    return NextResponse.json({ detail, error: "catalog_data_failed" }, { status: 500 })
  }
}
