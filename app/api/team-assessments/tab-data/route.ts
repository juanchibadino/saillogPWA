import { NextResponse } from "next/server"

import {
  getTeamAssessmentsCreatedTabData,
  getTeamAssessmentsTemplatesTabData,
} from "@/features/assessments/data"
import { resolveTeamAssessmentsTabDataRequest } from "@/features/assessments/tab-data-route-state.mjs"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tabRequest = resolveTeamAssessmentsTabDataRequest({
    tabParam: requestUrl.searchParams.get("tab") ?? undefined,
    pageParam: requestUrl.searchParams.get("page") ?? undefined,
    loadMoreParam: requestUrl.searchParams.get("loadMore") ?? undefined,
  })

  if (!tabRequest) {
    return NextResponse.json({ error: "invalid_tab" }, { status: 400 })
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

  if (!accessContext.profile) {
    return NextResponse.json({ error: "profile_required" }, { status: 403 })
  }

  try {
    const data =
      tabRequest.requestedTab === "created"
        ? await getTeamAssessmentsCreatedTabData({
            activeTeamId: navigation.scope.activeTeamId,
            currentProfileId: accessContext.profile.id,
            page: tabRequest.requestedPage,
            accumulatePages: tabRequest.requestedLoadMoreMode,
          })
        : await getTeamAssessmentsTemplatesTabData({
            activeTeamId: navigation.scope.activeTeamId,
          })

    return NextResponse.json({ data, tab: tabRequest.requestedTab })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown tab data error"
    return NextResponse.json({ detail, error: "tab_data_failed" }, { status: 500 })
  }
}
