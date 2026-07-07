import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamAssessmentsPageHref,
  buildTeamAssessmentsRedirectPath,
  getTeamAssessmentStatusMessage,
  resolveAssessmentPagination,
  resolveTeamAssessmentsListRequest,
} from "./list-route-state.mjs"

test("resolves Team Assessments list request params defensively", () => {
  assert.deepEqual(
    resolveTeamAssessmentsListRequest({
      tabParam: "other",
      pageParam: "-2",
      loadMoreParam: "1",
      templateParam: "template-1",
      newParam: "template",
    }),
    {
      requestedTab: "created",
      requestedPage: 1,
      requestedLoadMoreMode: true,
      requestedTemplateId: undefined,
      requestedNewTemplate: false,
    },
  )

  assert.deepEqual(
    resolveTeamAssessmentsListRequest({
      tabParam: "templates",
      pageParam: "5",
      loadMoreParam: "1",
      templateParam: "template-1",
      newParam: undefined,
    }),
    {
      requestedTab: "templates",
      requestedPage: 5,
      requestedLoadMoreMode: false,
      requestedTemplateId: "template-1",
      requestedNewTemplate: false,
    },
  )
})

test("keeps template editor state out of created route-state requests", () => {
  assert.deepEqual(
    resolveTeamAssessmentsListRequest({
      tabParam: "created",
      pageParam: "2",
      loadMoreParam: "1",
      templateParam: "template-1",
      newParam: "template",
    }),
    {
      requestedTab: "created",
      requestedPage: 2,
      requestedLoadMoreMode: true,
      requestedTemplateId: undefined,
      requestedNewTemplate: false,
    },
  )

  assert.deepEqual(
    resolveTeamAssessmentsListRequest({
      tabParam: "templates",
      pageParam: "2",
      loadMoreParam: "1",
      templateParam: "template-1",
      newParam: "template",
    }),
    {
      requestedTab: "templates",
      requestedPage: 2,
      requestedLoadMoreMode: false,
      requestedTemplateId: "template-1",
      requestedNewTemplate: true,
    },
  )
})

test("resolves Team Assessments pagination with mobile accumulation", () => {
  assert.deepEqual(
    resolveAssessmentPagination({
      requestedPage: 8,
      totalItems: 21,
      accumulatePages: false,
      pageSize: 10,
    }),
    {
      currentPage: 3,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: false,
    },
  )

  assert.deepEqual(
    resolveAssessmentPagination({
      requestedPage: 2,
      totalItems: 21,
      accumulatePages: true,
      pageSize: 10,
    }),
    {
      currentPage: 2,
      pageCount: 3,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  )
})

test("builds assessment page hrefs and clears template editor params", () => {
  assert.equal(
    buildTeamAssessmentsPageHref({
      pathname: "/team-assessments",
      search: "org=org-1&team=team-1&tab=templates&template=template-1",
      nextPage: 2,
    }),
    "/team-assessments?org=org-1&team=team-1&tab=templates&page=2",
  )

  assert.equal(
    buildTeamAssessmentsPageHref({
      pathname: "/team-assessments",
      search: "org=org-1&team=team-1&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-assessments?org=org-1&team=team-1",
  )
})

test("builds mobile load more hrefs for created assessments", () => {
  assert.equal(
    buildTeamAssessmentsPageHref({
      pathname: "/team-assessments",
      search: "org=org-1&team=team-1",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-assessments?org=org-1&team=team-1&page=2&loadMore=1",
  )

  assert.equal(
    buildTeamAssessmentsPageHref({
      pathname: "/team-assessments",
      search: "org=org-1&team=team-1&tab=templates&template=template-1&loadMore=1",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-assessments?org=org-1&team=team-1&tab=templates&page=2",
  )

  assert.equal(
    buildTeamAssessmentsPageHref({
      pathname: "/team-assessments",
      search: "org=org-1&team=team-1&page=2&loadMore=1",
      nextPage: 1,
      includeLoadMore: true,
    }),
    "/team-assessments?org=org-1&team=team-1",
  )
})

test("maps assessment action status codes to visible feedback messages", () => {
  assert.equal(
    getTeamAssessmentStatusMessage("template_saved"),
    "Assessment template saved successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("run_published"),
    "Assessment created successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("run_closed"),
    "Assessment closed successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("run_deleted"),
    "Assessment deleted successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("answers_saved"),
    "Assessment answers saved successfully.",
  )
})

test("builds status redirects that match list feedback readers", () => {
  for (const [status, message] of [
    ["template_saved", "Assessment template saved successfully."],
    ["run_published", "Assessment created successfully."],
    ["run_closed", "Assessment closed successfully."],
    ["run_deleted", "Assessment deleted successfully."],
    ["answers_saved", "Assessment answers saved successfully."],
  ]) {
    assert.equal(getTeamAssessmentStatusMessage(status), message)
    assert.equal(
      buildTeamAssessmentsRedirectPath({
        returnPath: "/team-assessments?error=save_failed&loadMore=1",
        scopeOrgId: "org-1",
        scopeTeamId: "team-1",
        status,
      }),
      `/team-assessments?status=${status}&org=org-1&team=team-1`,
    )
  }
})

test("keeps legacy assessment status aliases readable", () => {
  assert.equal(
    getTeamAssessmentStatusMessage("created"),
    "Assessment created successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("closed"),
    "Assessment closed successfully.",
  )
  assert.equal(
    getTeamAssessmentStatusMessage("deleted"),
    "Assessment deleted successfully.",
  )
  assert.equal(getTeamAssessmentStatusMessage("unknown"), null)
  assert.equal(getTeamAssessmentStatusMessage(undefined), null)
})

test("builds redirects preserving scope and template editor state", () => {
  assert.equal(
    buildTeamAssessmentsRedirectPath({
      returnPath: "/team-assessments?org=old&team=old&tab=templates&new=template",
      status: "template_saved",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      tab: "templates",
      templateId: "template-1",
    }),
    "/team-assessments?org=org-1&team=team-1&tab=templates&status=template_saved&template=template-1",
  )

  assert.equal(
    buildTeamAssessmentsRedirectPath({
      returnPath: "/team-assessments/run-1?org=org-1&team=team-1",
      error: "answer_failed",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
    }),
    "/team-assessments/run-1?org=org-1&team=team-1&error=answer_failed",
  )
})
