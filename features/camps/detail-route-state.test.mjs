import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCampDetailRedirectPath,
  buildTeamCampsRedirectPath,
  resolveCampDetailRouteRequest,
  resolveCampGoalsActionRedirect,
} from "./detail-route-state.mjs"

test("normalizes Camp detail tab, page, and notes offset params", () => {
  assert.deepEqual(
    resolveCampDetailRouteRequest({
      tabParam: "not-a-tab",
      pageParam: "-4",
      notesOffsetParam: "NaN",
    }),
    {
      selectedTab: "sessions",
      requestedPage: 1,
      requestedNotesOffset: 0,
    },
  )

  assert.deepEqual(
    resolveCampDetailRouteRequest({
      tabParam: "notes",
      pageParam: "3",
      notesOffsetParam: "20",
    }),
    {
      selectedTab: "notes",
      requestedPage: 3,
      requestedNotesOffset: 20,
    },
  )
})

test("builds Camp detail redirects preserving valid tab and page state", () => {
  assert.equal(
    buildCampDetailRedirectPath({
      campId: "camp-1",
      status: "goals_updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "goals",
      scopePage: 2,
    }),
    "/team-camps/camp-1?status=goals_updated&org=org-1&team=team-1&tab=goals&page=2",
  )

  assert.equal(
    buildCampDetailRedirectPath({
      campId: "camp-1",
      status: "goals_updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "unknown",
      scopePage: 0,
    }),
    "/team-camps/camp-1?status=goals_updated&org=org-1&team=team-1",
  )
})

test("builds Team Camps action redirects preserving list filters and page state", () => {
  for (const status of ["created", "updated", "deleted"]) {
    assert.equal(
      buildTeamCampsRedirectPath({
        status,
        scopeOrgId: "org-1",
        scopeTeamId: "team-1",
        scopeVenueId: "venue-1",
        scopeCampType: "regatta",
        scopeCampStatus: "active",
        scopePage: 3,
      }),
      `/team-camps?status=${status}&org=org-1&team=team-1&venue=venue-1&type=regatta&campStatus=active&page=3`,
    )
  }
})

test("builds Team Camps action redirects without invalid filters or page one", () => {
  assert.equal(
    buildTeamCampsRedirectPath({
      error: "invalid_input",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeVenueId: "venue-1",
      scopeCampType: "offshore",
      scopeCampStatus: "archived",
      scopePage: 1,
    }),
    "/team-camps?error=invalid_input&org=org-1&team=team-1&venue=venue-1",
  )
})

test("builds invalid Goals save redirect with preserved Camp detail state", () => {
  assert.equal(
    resolveCampGoalsActionRedirect({
      outcome: "invalid_input",
      campId: "camp-1",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "goals",
      scopePage: 2,
    }),
    "/team-camps/camp-1?error=invalid_input&org=org-1&team=team-1&tab=goals&page=2",
  )
})

test("builds forbidden Goals save redirect with preserved Camp detail state", () => {
  assert.equal(
    resolveCampGoalsActionRedirect({
      outcome: "forbidden",
      campId: "camp-1",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "goals",
      scopePage: 2,
    }),
    "/team-camps/camp-1?error=forbidden&org=org-1&team=team-1&tab=goals&page=2",
  )
})

test("builds missing Camp Goals save redirect as invalid input", () => {
  assert.equal(
    resolveCampGoalsActionRedirect({
      outcome: "missing_camp",
      campId: "camp-1",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "goals",
      scopePage: 2,
    }),
    "/team-camps/camp-1?error=invalid_input&org=org-1&team=team-1&tab=goals&page=2",
  )
})

test("builds successful Goals save redirect with preserved Camp detail state", () => {
  assert.equal(
    resolveCampGoalsActionRedirect({
      outcome: "saved",
      campId: "camp-1",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopeTab: "goals",
      scopePage: 2,
    }),
    "/team-camps/camp-1?status=goals_updated&org=org-1&team=team-1&tab=goals&page=2",
  )
})

test("builds missing required Goals save redirect back to Camp list", () => {
  assert.equal(
    resolveCampGoalsActionRedirect({
      outcome: "missing_required",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      scopePage: 3,
    }),
    "/team-camps?error=invalid_input&org=org-1&team=team-1&page=3",
  )
})
