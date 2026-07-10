import assert from "node:assert/strict"
import test from "node:test"

import {
  createMockSupabaseClient,
  createServerActionHarness,
  formDataFromObject,
} from "../testing/server-action-harness.mjs"
import { runUpdateVenueAction } from "./update-action-core.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const ORG_2 = "22222222-2222-4222-8222-222222222222"
const TEAM_1 = "33333333-3333-4333-8333-333333333333"
const TEAM_2 = "44444444-4444-4444-8444-444444444444"
const TEAM_VENUE_1 = "55555555-5555-4555-8555-555555555555"
const VENUE_1 = "66666666-6666-4666-8666-666666666666"
const REDIRECT_TO = `/venues/${TEAM_VENUE_1}?tab=reports&year=2026`

function buildAccessContext(overrides = {}) {
  return {
    effectiveRoles: {
      globalRole: null,
      organizationRoles: [],
      teamRoles: [],
    },
    organizationMemberships: [
      {
        organization_id: ORG_1,
        role: "organization_admin",
      },
    ],
    teamMemberships: [],
    user: {
      id: "77777777-7777-4777-8777-777777777777",
    },
    ...overrides,
  }
}

function buildTables(overrides = {}) {
  return {
    team_venues: [
      {
        id: TEAM_VENUE_1,
        team_id: TEAM_1,
        venue_id: VENUE_1,
      },
    ],
    teams: [
      {
        id: TEAM_1,
        is_active: true,
        organization_id: ORG_1,
      },
    ],
    venues: [
      {
        city: "Old City",
        country: "Old Country",
        id: VENUE_1,
        is_active: false,
        name: "Old Venue",
        organization_id: ORG_1,
      },
    ],
    ...overrides,
  }
}

function buildUpdateForm(overrides = {}) {
  return formDataFromObject({
    city: "Barcelona",
    country: "Spain",
    id: VENUE_1,
    isActive: "on",
    name: "Updated Venue",
    organizationId: ORG_1,
    redirectTo: REDIRECT_TO,
    scopeOrgId: ORG_1,
    scopeTeamId: TEAM_1,
    teamVenueId: TEAM_VENUE_1,
    ...overrides,
  })
}

async function runVenueUpdate(input = {}) {
  const supabase = createMockSupabaseClient({
    tables: buildTables(input.tables),
    updateErrors: input.updateErrors,
  })
  const harness = createServerActionHarness({
    accessContext: input.accessContext ?? buildAccessContext(),
    supabase,
  })
  const result = await harness.run((dependencies) =>
    runUpdateVenueAction(input.formData ?? buildUpdateForm(), dependencies),
  )

  return {
    result,
    supabase,
  }
}

test("updates Venue and redirects back to selected tab and year", async () => {
  const { result, supabase } = await runVenueUpdate()

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&status=updated&org=${ORG_1}&team=${TEAM_1}&cacheTeamVenue=${TEAM_VENUE_1}`,
    revalidatedPaths: ["/venues", `/venues/${TEAM_VENUE_1}`],
  })
  assert.deepEqual(supabase.rowsByTable.venues[0], {
    city: "Barcelona",
    country: "Spain",
    id: VENUE_1,
    is_active: true,
    name: "Updated Venue",
    organization_id: ORG_1,
  })
})

test("redirects forbidden before Venue update without organization permission", async () => {
  const { result, supabase } = await runVenueUpdate({
    accessContext: buildAccessContext({
      organizationMemberships: [],
    }),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&error=forbidden&org=${ORG_1}&team=${TEAM_1}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.venues[0].name, "Old Venue")
})

test("redirects forbidden for stale active-team scope", async () => {
  const { result, supabase } = await runVenueUpdate({
    formData: buildUpdateForm({
      scopeTeamId: TEAM_2,
    }),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&error=forbidden&org=${ORG_1}&team=${TEAM_2}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.venues[0].name, "Old Venue")
})

test("redirects forbidden for cross-organization update attempts", async () => {
  const { result, supabase } = await runVenueUpdate({
    accessContext: buildAccessContext({
      effectiveRoles: {
        globalRole: "super_admin",
        organizationRoles: [],
        teamRoles: [],
      },
    }),
    formData: buildUpdateForm({
      organizationId: ORG_2,
    }),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&error=forbidden&org=${ORG_1}&team=${TEAM_1}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.venues[0].name, "Old Venue")
})

test("redirects update_failed when Venue write is denied by RLS", async () => {
  const { result, supabase } = await runVenueUpdate({
    updateErrors: {
      venues: {
        message: "new row violates row-level security policy",
      },
    },
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&error=update_failed&org=${ORG_1}&team=${TEAM_1}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.venues[0].name, "Old Venue")
})

test("harness captures supplied dependencies and Next-style redirects", async () => {
  const supabase = createMockSupabaseClient({
    tables: buildTables(),
  })
  const calledRevalidations = []
  const harness = createServerActionHarness({
    createServerSupabaseClient: async () => supabase,
    redirect: (path) => {
      const error = new Error("NEXT_REDIRECT")
      error.digest = `NEXT_REDIRECT;replace;${path};307;`
      throw error
    },
    revalidatePath: (path) => {
      calledRevalidations.push(path)
    },
    requireAuthenticatedAccessContext: async () => buildAccessContext(),
  })

  const result = await harness.run((dependencies) =>
    runUpdateVenueAction(buildUpdateForm(), dependencies),
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `${REDIRECT_TO}&status=updated&org=${ORG_1}&team=${TEAM_1}&cacheTeamVenue=${TEAM_VENUE_1}`,
    revalidatedPaths: ["/venues", `/venues/${TEAM_VENUE_1}`],
  })
  assert.deepEqual(calledRevalidations, ["/venues", `/venues/${TEAM_VENUE_1}`])
  assert.equal(supabase.rowsByTable.venues[0].name, "Updated Venue")
})
