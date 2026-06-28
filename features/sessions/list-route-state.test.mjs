import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamSessionsPageHref,
  buildTeamSessionsRedirectPath,
  normalizeSelectedId,
  resolveSessionPagination,
  resolveTeamSessionsListRequest,
} from "./list-route-state.mjs"

test("normalizes invalid Team Sessions venue and camp filters away", () => {
  assert.equal(
    normalizeSelectedId({
      selectedId: "venue-missing",
      allowedIds: new Set(["venue-1", "venue-2"]),
    }),
    undefined,
  )
  assert.equal(
    normalizeSelectedId({
      selectedId: "camp-missing",
      allowedIds: new Set(["camp-1", "camp-2"]),
    }),
    undefined,
  )
  assert.equal(
    normalizeSelectedId({
      selectedId: "camp-1",
      allowedIds: new Set(["camp-1", "camp-2"]),
    }),
    "camp-1",
  )
})

test("resolves Team Sessions list request params defensively", () => {
  assert.deepEqual(
    resolveTeamSessionsListRequest({
      pageParam: "-8",
      loadMoreParam: "0",
      highlightParam: "maybe",
    }),
    {
      requestedPage: 1,
      requestedLoadMoreMode: false,
      requestedHighlight: undefined,
    },
  )
  assert.deepEqual(
    resolveTeamSessionsListRequest({
      pageParam: "3",
      loadMoreParam: "1",
      highlightParam: "yes",
    }),
    {
      requestedPage: 3,
      requestedLoadMoreMode: true,
      requestedHighlight: "yes",
    },
  )
})

test("resolves desktop pagination and mobile accumulation flags", () => {
  assert.deepEqual(
    resolveSessionPagination({
      requestedPage: 7,
      totalItems: 24,
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
    resolveSessionPagination({
      requestedPage: 2,
      totalItems: 24,
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

test("builds desktop page navigation hrefs while preserving filters", () => {
  assert.equal(
    buildTeamSessionsPageHref({
      pathname: "/team-sessions",
      search: "org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=yes&page=1",
      nextPage: 2,
    }),
    "/team-sessions?org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=yes&page=2",
  )
  assert.equal(
    buildTeamSessionsPageHref({
      pathname: "/team-sessions",
      search: "org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=no&page=3&loadMore=1",
      nextPage: 1,
    }),
    "/team-sessions?org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=no",
  )
})

test("builds mobile Load more hrefs with accumulation enabled", () => {
  assert.equal(
    buildTeamSessionsPageHref({
      pathname: "/team-sessions",
      search: "org=org-1&team=team-1&highlight=yes",
      nextPage: 2,
      includeLoadMore: true,
    }),
    "/team-sessions?org=org-1&team=team-1&highlight=yes&page=2&loadMore=1",
  )
})

test("builds create update and delete redirects preserving scope filters and page", () => {
  assert.equal(
    buildTeamSessionsRedirectPath({
      status: "created",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampId: "camp-1",
      scopeHighlight: "yes",
      scopePage: 3,
    }),
    "/team-sessions?status=created&org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=yes&page=3",
  )
  assert.equal(
    buildTeamSessionsRedirectPath({
      status: "updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampId: "camp-1",
      scopeHighlight: "no",
      scopePage: 2,
    }),
    "/team-sessions?status=updated&org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=no&page=2",
  )
  assert.equal(
    buildTeamSessionsRedirectPath({
      status: "deleted",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampId: "camp-1",
      scopeHighlight: "yes",
      scopePage: 4,
    }),
    "/team-sessions?status=deleted&org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=yes&page=4",
  )
})

test("builds forbidden create and update redirects with preserved scope", () => {
  assert.equal(
    buildTeamSessionsRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampId: "camp-1",
      scopeHighlight: "yes",
      scopePage: 2,
    }),
    "/team-sessions?error=forbidden&org=org-1&team=team-1&venue=venue-1&camp=camp-1&highlight=yes&page=2",
  )
})

test("builds session action redirects back to camp detail when requested", () => {
  assert.equal(
    buildTeamSessionsRedirectPath({
      returnPath: "/team-camps/camp-1?tab=sessions&org=org-1&team=team-1&highlight=no&page=2&loadMore=1",
      status: "updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampId: "camp-1",
      scopeHighlight: "yes",
      scopePage: 3,
    }),
    "/team-camps/camp-1?tab=sessions&org=org-1&team=team-1&highlight=yes&page=3&status=updated&venue=venue-1&camp=camp-1",
  )
  assert.equal(
    buildTeamSessionsRedirectPath({
      returnPath: "https://example.com/team-camps/camp-1",
      status: "deleted",
      scopeOrgId: "org-1",
    }),
    "/team-sessions?status=deleted&org=org-1",
  )
})
