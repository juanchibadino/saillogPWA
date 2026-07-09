import { NextResponse } from "next/server"

import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type AssessmentBreadcrumbPayload = {
  team_name: string | null
  assessment_name: string | null
}

type RouteContext = {
  params: Promise<{ id: string }>
}

const emptyAssessmentBreadcrumbPayload: AssessmentBreadcrumbPayload = {
  team_name: null,
  assessment_name: null,
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
  const assessmentId = resolvedParams.id?.trim()

  if (!assessmentId) {
    return NextResponse.json(emptyAssessmentBreadcrumbPayload, { status: 400 })
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json(emptyAssessmentBreadcrumbPayload, { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const authenticatedContext = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context: authenticatedContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json(emptyAssessmentBreadcrumbPayload, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: runRow, error: runError } = await supabase
    .from("assessment_runs")
    .select("id,name,team_id,assessment_template_id")
    .eq("id", assessmentId)
    .eq("team_id", navigation.scope.activeTeamId)
    .maybeSingle()

  if (runError || !runRow) {
    return NextResponse.json(emptyAssessmentBreadcrumbPayload, { status: 404 })
  }

  let assessmentName = runRow.name ?? null

  if (runRow.assessment_template_id) {
    const { data: templateRow, error: templateError } = await supabase
      .from("assessment_templates")
      .select("id,name")
      .eq("id", runRow.assessment_template_id)
      .eq("team_id", navigation.scope.activeTeamId)
      .maybeSingle()

    if (!templateError && templateRow) {
      assessmentName = templateRow.name ?? assessmentName
    }
  }

  const activeTeamName =
    navigation.catalog.teamsByOrganizationId[navigation.scope.activeOrgId]?.find(
      (team) => team.id === navigation.scope?.activeTeamId,
    )?.name ?? null

  return NextResponse.json({
    team_name: activeTeamName,
    assessment_name: assessmentName,
  })
}
