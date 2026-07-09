import assert from "node:assert/strict"
import test from "node:test"

import {
  createMockSupabaseClient,
  createServerActionHarness,
  formDataFromObject,
} from "../testing/server-action-harness.mjs"
import {
  runArchiveTeamStandardMoveAction,
  runCreateTeamStandardMoveAction,
  runRestoreTeamStandardMoveAction,
  runUpdateTeamStandardMoveAction,
} from "./action-core.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const ORG_2 = "22222222-2222-4222-8222-222222222222"
const TEAM_1 = "33333333-3333-4333-8333-333333333333"
const TEAM_2 = "44444444-4444-4444-8444-444444444444"
const MOVE_1 = "55555555-5555-4555-8555-555555555555"
const PROFILE_1 = "66666666-6666-4666-8666-666666666666"
const USER_1 = "77777777-7777-4777-8777-777777777777"
const PRESERVED_ROUTE_STATE =
  `org=${ORG_1}&team=${TEAM_1}&statusFilter=archived&page=3&loadMore=1`

function buildAccessContext(overrides = {}) {
  return {
    effectiveRoles: {
      globalRole: null,
      organizationRoles: [],
      teamRoles: [],
    },
    organizationMemberships: [],
    profile: {
      id: PROFILE_1,
    },
    teamMemberships: [
      {
        is_active: true,
        role: "team_admin",
        team_id: TEAM_1,
      },
    ],
    user: {
      id: USER_1,
    },
    ...overrides,
  }
}

function buildTables(overrides = {}) {
  return {
    teams: [
      {
        id: TEAM_1,
        organization_id: ORG_1,
      },
      {
        id: TEAM_2,
        organization_id: ORG_1,
      },
    ],
    team_standard_moves: [
      {
        description: "Old description",
        id: MOVE_1,
        is_active: true,
        name: "Old Move",
        team_id: TEAM_1,
      },
    ],
    ...overrides,
  }
}

function buildCreateForm(overrides = {}) {
  return formDataFromObject({
    description: "Fresh description",
    name: "New Move",
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "archived",
    scopeTeamId: TEAM_1,
    ...overrides,
  })
}

function buildUpdateForm(overrides = {}) {
  return formDataFromObject({
    description: "",
    id: MOVE_1,
    name: "Updated Move",
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "archived",
    scopeTeamId: TEAM_1,
    ...overrides,
  })
}

function buildToggleForm(overrides = {}) {
  return formDataFromObject({
    id: MOVE_1,
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "archived",
    scopeTeamId: TEAM_1,
    ...overrides,
  })
}

async function runStandardMoveAction(action, input = {}) {
  const supabase = createMockSupabaseClient({
    insertErrors: input.insertErrors,
    selectErrors: input.selectErrors,
    tables: buildTables(input.tables),
    updateErrors: input.updateErrors,
  })
  const harness = createServerActionHarness({
    accessContext: input.accessContext ?? buildAccessContext(),
    supabase,
  })
  const result = await harness.run((dependencies) =>
    action(input.formData, dependencies),
  )

  return {
    result,
    supabase,
  }
}

test("creates Team Standard Move and preserves route state", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runCreateTeamStandardMoveAction,
    {
      formData: buildCreateForm(),
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?status=created&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [
      "/team-standard-moves",
      "/team-sessions",
      "/team-camps",
      "/team-notes",
    ],
  })
  assert.deepEqual(supabase.rowsByTable.team_standard_moves[1], {
    created_by_profile_id: PROFILE_1,
    description: "Fresh description",
    name: "New Move",
    team_id: TEAM_1,
  })
})

test("updates Team Standard Move and preserves route state", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runUpdateTeamStandardMoveAction,
    {
      formData: buildUpdateForm(),
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?status=updated&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [
      "/team-standard-moves",
      "/team-sessions",
      "/team-camps",
      "/team-notes",
    ],
  })
  assert.deepEqual(supabase.rowsByTable.team_standard_moves[0], {
    description: null,
    id: MOVE_1,
    is_active: true,
    name: "Updated Move",
    team_id: TEAM_1,
  })
})

test("archives Team Standard Move and preserves route state", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runArchiveTeamStandardMoveAction,
    {
      formData: buildToggleForm(),
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?status=archived&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [
      "/team-standard-moves",
      "/team-sessions",
      "/team-camps",
      "/team-notes",
    ],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].is_active, false)
})

test("restores Team Standard Move and preserves route state", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runRestoreTeamStandardMoveAction,
    {
      formData: buildToggleForm(),
      tables: {
        team_standard_moves: [
          {
            description: "Old description",
            id: MOVE_1,
            is_active: false,
            name: "Old Move",
            team_id: TEAM_1,
          },
        ],
      },
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?status=restored&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [
      "/team-standard-moves",
      "/team-sessions",
      "/team-camps",
      "/team-notes",
    ],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].is_active, true)
})

test("redirects forbidden before create without Team Standard Move permission", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runCreateTeamStandardMoveAction,
    {
      accessContext: buildAccessContext({
        teamMemberships: [],
      }),
      formData: buildCreateForm(),
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves.length, 1)
})

test("redirects forbidden before update without Team Standard Move permission", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runUpdateTeamStandardMoveAction,
    {
      accessContext: buildAccessContext({
        teamMemberships: [],
      }),
      formData: buildUpdateForm(),
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].name, "Old Move")
})

test("redirects forbidden for cross-team update attempts", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runUpdateTeamStandardMoveAction,
    {
      formData: buildUpdateForm(),
      tables: {
        team_standard_moves: [
          {
            description: "Other team description",
            id: MOVE_1,
            is_active: true,
            name: "Other Team Move",
            team_id: TEAM_2,
          },
        ],
      },
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.deepEqual(supabase.rowsByTable.team_standard_moves[0], {
    description: "Other team description",
    id: MOVE_1,
    is_active: true,
    name: "Other Team Move",
    team_id: TEAM_2,
  })
})

test("redirects forbidden for cross-team archive attempts", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runArchiveTeamStandardMoveAction,
    {
      formData: buildToggleForm(),
      tables: {
        team_standard_moves: [
          {
            description: "Other team description",
            id: MOVE_1,
            is_active: true,
            name: "Other Team Move",
            team_id: TEAM_2,
          },
        ],
      },
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].is_active, true)
})

test("redirects forbidden for cross-team restore attempts", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runRestoreTeamStandardMoveAction,
    {
      formData: buildToggleForm(),
      tables: {
        team_standard_moves: [
          {
            description: "Other team description",
            id: MOVE_1,
            is_active: false,
            name: "Other Team Move",
            team_id: TEAM_2,
          },
        ],
      },
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].is_active, false)
})

test("redirects invalid input for stale team and organization scope", async () => {
  const { result, supabase } = await runStandardMoveAction(
    runUpdateTeamStandardMoveAction,
    {
      accessContext: buildAccessContext({
        effectiveRoles: {
          globalRole: "super_admin",
          organizationRoles: [],
          teamRoles: [],
        },
        teamMemberships: [],
      }),
      formData: buildUpdateForm(),
      tables: {
        teams: [
          {
            id: TEAM_1,
            organization_id: ORG_2,
          },
        ],
      },
    },
  )

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-standard-moves?error=invalid_input&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(supabase.rowsByTable.team_standard_moves[0].name, "Old Move")
})
