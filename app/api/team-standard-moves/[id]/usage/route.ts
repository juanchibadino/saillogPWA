import { NextResponse } from "next/server"

import { getTeamStandardMoveUsageData } from "@/features/standard-moves/data"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
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
  const standardMoveId = resolvedParams.id?.trim()

  if (!standardMoveId) {
    return NextResponse.json({ error: "invalid_standard_move_id" }, { status: 400 })
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

  try {
    const data = await getTeamStandardMoveUsageData({
      activeTeamId: navigation.scope.activeTeamId,
      standardMoveId,
    })

    if (!data) {
      return NextResponse.json(
        { error: "standard_move_not_found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown standard move usage error"
    return NextResponse.json(
      { detail, error: "standard_move_usage_failed" },
      { status: 500 },
    )
  }
}
