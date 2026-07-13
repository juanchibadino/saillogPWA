import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

export const TEAM_ASSESSMENT_TABS = ["created", "templates"] as const
export const ASSESSMENT_DETAIL_RETURN_TO_QUERY_KEY = "returnTo"

export type TeamAssessmentTab = (typeof TEAM_ASSESSMENT_TABS)[number]

function appendScopeParams(params: URLSearchParams, scope: NavigationScope): void {
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }
}

export function buildTeamAssessmentsHref(input: {
  scope: NavigationScope
  tab?: TeamAssessmentTab
  page?: number
  loadMore?: boolean
  templateId?: string
  newTemplate?: boolean
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.tab && input.tab !== "created") {
    params.set("tab", input.tab)
  }

  if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 1) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  if (input.templateId) {
    params.set("template", input.templateId)
  }

  if (input.newTemplate) {
    params.set("new", "template")
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  return query.length > 0 ? `/team-assessments?${query}` : "/team-assessments"
}

export function buildAssessmentDetailHref(input: {
  scope: NavigationScope
  assessmentId: string
  returnTo?: string
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()
  appendScopeParams(params, input.scope)

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.returnTo) {
    params.set(ASSESSMENT_DETAIL_RETURN_TO_QUERY_KEY, input.returnTo)
  }

  const query = params.toString()
  const basePath = `/team-assessments/${input.assessmentId}`
  return query.length > 0 ? `${basePath}?${query}` : basePath
}
