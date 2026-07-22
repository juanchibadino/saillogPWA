import { NextResponse } from "next/server"

import { getTeamExpensesReportData } from "@/features/expenses/data"
import { resolveTeamExpensesListRequest } from "@/features/expenses/list-route-state.mjs"
import { generateTeamExpensesPdf } from "@/features/expenses/pdf"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import {
  canManageTeamFinance,
  canManageTeamSessions,
} from "@/lib/auth/capabilities"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

function buildContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const context = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json({ error: "scope_required" }, { status: 403 })
  }

  const {
    requestedCampId,
    requestedCrewFilter,
    requestedMemberId,
    requestedScope,
    requestedType,
    requestedVenueId,
    requestedYear,
  } = resolveTeamExpensesListRequest({
    campParam: requestUrl.searchParams.get("camp") ?? undefined,
    crewParam: requestUrl.searchParams.get("crew") ?? undefined,
    loadMoreParam: undefined,
    memberParam: requestUrl.searchParams.get("member") ?? undefined,
    pageParam: undefined,
    scopeParam: requestUrl.searchParams.get("scope") ?? undefined,
    typeParam: requestUrl.searchParams.get("type") ?? undefined,
    venueParam: requestUrl.searchParams.get("venue") ?? undefined,
    yearParam: requestUrl.searchParams.get("year") ?? undefined,
  }) as {
    requestedCampId?: string
    requestedCrewFilter?: string
    requestedMemberId?: string
    requestedScope?: string
    requestedType?: string
    requestedVenueId?: string
    requestedYear?: number
  }
  const currentProfileId = context.profile?.id ?? context.user.id
  const canManageExpenseRows = canManageTeamSessions({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })
  const canManageTeamFinanceRows = canManageTeamFinance({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })

  try {
    const reportData = await getTeamExpensesReportData({
      activeOrganizationId: navigation.scope.activeOrgId,
      activeTeamId: navigation.scope.activeTeamId,
      canManageTeamFinance: canManageTeamFinanceRows,
      canManageTeamSessions: canManageExpenseRows,
      currentProfileId,
      requestedCampId,
      requestedCrewFilter,
      requestedMemberId,
      requestedScope,
      requestedType,
      requestedVenueId,
      requestedYear,
    })
    const pdf = await generateTeamExpensesPdf({
      baseUrl: requestUrl.origin,
      data: reportData,
    })

    return new NextResponse(Buffer.from(pdf.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(pdf.fileName),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown expense report error"

    if (message.includes("team_expense_report_scope_unavailable")) {
      return NextResponse.json({ error: "team_scope_unavailable" }, { status: 403 })
    }

    return NextResponse.json(
      { error: "team_expenses_pdf_failed", detail: message },
      { status: 500 },
    )
  }
}
