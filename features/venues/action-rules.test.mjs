import assert from "node:assert/strict"
import test from "node:test"

import {
  buildVenueRedirectPath,
  resolveVenueUpdateDecision,
} from "./action-rules.mjs"

function buildUpdateInput(overrides = {}) {
  return {
    activeTeamInScope: true,
    canManageOrganizationOperations: true,
    organizationId: "org-1",
    scopeOrgId: "org-1",
    scopeTeamId: "team-1",
    teamVenue: {
      id: "team-venue-1",
      team_id: "team-1",
      venue_id: "venue-1",
    },
    teamVenueId: "team-venue-1",
    venue: {
      id: "venue-1",
      organization_id: "org-1",
    },
    venueId: "venue-1",
    ...overrides,
  }
}

test("builds Venue update redirects preserving selected tab year and scope", () => {
  assert.equal(
    buildVenueRedirectPath({
      status: "updated",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      redirectTo: "/venues/team-venue-1?tab=sessions&year=2026",
    }),
    "/venues/team-venue-1?tab=sessions&year=2026&status=updated&org=org-1&team=team-1",
  )

  assert.equal(
    buildVenueRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      redirectTo: "https://example.com/venues/team-venue-1?tab=reports&year=2026",
    }),
    "/venues?error=forbidden&org=org-1&team=team-1",
  )

  assert.equal(
    buildVenueRedirectPath({
      error: "forbidden",
      scopeOrgId: "org-1",
      scopeTeamId: "team-1",
      redirectTo: "/venues-admin?tab=reports&year=2026",
    }),
    "/venues?error=forbidden&org=org-1&team=team-1",
  )
})

test("allows Venue update only for the scoped team venue and organization", () => {
  assert.deepEqual(resolveVenueUpdateDecision(buildUpdateInput()), {
    allowed: true,
  })
})

test("forbids Venue update without organization operation permission", () => {
  assert.deepEqual(
    resolveVenueUpdateDecision(
      buildUpdateInput({
        canManageOrganizationOperations: false,
      }),
    ),
    {
      allowed: false,
      error: "forbidden",
    },
  )
})

test("forbids Venue update for stale active-team scope", () => {
  assert.deepEqual(
    resolveVenueUpdateDecision(
      buildUpdateInput({
        scopeTeamId: "team-2",
      }),
    ),
    {
      allowed: false,
      error: "forbidden",
    },
  )

  assert.deepEqual(
    resolveVenueUpdateDecision(
      buildUpdateInput({
        activeTeamInScope: false,
      }),
    ),
    {
      allowed: false,
      error: "forbidden",
    },
  )
})

test("forbids cross-organization Venue update attempts", () => {
  assert.deepEqual(
    resolveVenueUpdateDecision(
      buildUpdateInput({
        organizationId: "org-2",
      }),
    ),
    {
      allowed: false,
      error: "forbidden",
    },
  )

  assert.deepEqual(
    resolveVenueUpdateDecision(
      buildUpdateInput({
        venue: {
          id: "venue-1",
          organization_id: "org-2",
        },
      }),
    ),
    {
      allowed: false,
      error: "forbidden",
    },
  )
})
