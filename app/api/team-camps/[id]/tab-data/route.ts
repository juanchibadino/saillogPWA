import { NextResponse } from "next/server"

import {
  getCampDetailShellData,
  getCampDetailTabData,
} from "@/features/camps/detail-data"
import { CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import type { CampDetailTab } from "@/features/camps/detail-types"
import { buildCampDetailTabCacheMetadata } from "@/features/camps/camp-detail-tab-cache"
import { resolveTeamSessionsListRequest } from "@/features/sessions/list-route-state.mjs"
import { buildApiSliceErrorPayload } from "@/features/shared/api-slice-contracts"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

function resolveTab(value: string | null): CampDetailTab | null {
  if (!value) {
    return null
  }

  return CAMP_DETAIL_TABS.includes(value as CampDetailTab)
    ? (value as CampDetailTab)
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
  const campId = resolvedParams.id?.trim()

  if (!campId) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_camp_id" }),
      { status: 400 },
    )
  }

  const requestUrl = new URL(request.url)
  const tab = resolveTab(requestUrl.searchParams.get("tab"))

  if (!tab) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "invalid_tab" }),
      { status: 400 },
    )
  }

  const parsedNotesOffset = Number.parseInt(
    requestUrl.searchParams.get("notesOffset") ?? "0",
    10,
  )
  const notesSessionOffset = Number.isFinite(parsedNotesOffset)
    ? Math.max(0, parsedNotesOffset)
    : 0

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

  const shellData = await getCampDetailShellData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    campId,
  })

  if (!shellData) {
    return NextResponse.json(
      buildApiSliceErrorPayload({ error: "camp_not_found" }),
      { status: 404 },
    )
  }

  const {
    requestedHighlight,
    requestedLoadMoreMode,
    requestedPage,
  } = resolveTeamSessionsListRequest({
    highlightParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("highlight") ?? undefined,
    ),
    loadMoreParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("loadMore") ?? undefined,
    ),
    pageParam: getSingleSearchParamValue(
      requestUrl.searchParams.get("page") ?? undefined,
    ),
  })

  try {
    const data = await getCampDetailTabData({
      activeTeamId: shellData.teamVenue.team_id,
      accumulatePages: requestedLoadMoreMode,
      camp: shellData.camp,
      notesSessionOffset,
      page: requestedPage,
      selectedHighlight: requestedHighlight,
      tab,
      teamVenue: shellData.teamVenue,
    })
    const tabPage = tab === "sessions" ? requestedPage : 1
    const tabHighlight = tab === "sessions" ? requestedHighlight : undefined
    const tabLoadMore = tab === "sessions" && requestedLoadMoreMode
    const tabNotesOffset = tab === "notes" ? notesSessionOffset : 0
    const cache = buildCampDetailTabCacheMetadata({
      scope: {
        orgId: navigation.scope.activeOrgId,
        teamId: navigation.scope.activeTeamId,
      },
      campId: shellData.camp.id,
      tab,
      highlight: tabHighlight,
      loadMore: tabLoadMore,
      notesOffset: tabNotesOffset,
      page: tabPage,
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
