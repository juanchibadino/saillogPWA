import assert from "node:assert/strict"
import test from "node:test"

import {
  createMockSupabaseClient,
  createServerActionHarness,
  formDataFromObject,
} from "../testing/server-action-harness.mjs"
import {
  runCreateGearItemAction,
  runRetireGearItemAction,
  runUpdateGearItemAction,
} from "./action-core.mjs"

const ORG_1 = "11111111-1111-4111-8111-111111111111"
const TEAM_1 = "22222222-2222-4222-8222-222222222222"
const TEAM_2 = "33333333-3333-4333-8333-333333333333"
const GEAR_1 = "44444444-4444-4444-8444-444444444444"
const ALERT_1 = "55555555-5555-4555-8555-555555555555"
const PROFILE_1 = "66666666-6666-4666-8666-666666666666"
const USER_1 = "77777777-7777-4777-8777-777777777777"
const PRESERVED_ROUTE_STATE =
  `org=${ORG_1}&team=${TEAM_1}&type=sails&statusFilter=active_training&condition=used&alert=warning&page=3&loadMore=1`

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
    gear_alert_rules: [
      {
        gear_item_id: GEAR_1,
        id: ALERT_1,
        is_refurbished_rule: false,
        metric: "usage_count",
        severity: "warning",
        threshold_value: 10,
      },
    ],
    gear_items: [
      {
        barcode: "BC-1",
        condition: "used",
        gear_type: "sails",
        id: GEAR_1,
        name: "Old Sail",
        serial_number: "SN-1",
        status: "active_training",
        team_id: TEAM_1,
      },
    ],
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
    ...overrides,
  }
}

function buildCreateForm(overrides = {}) {
  return formDataFromObject({
    alertRulesPayload: JSON.stringify([
      {
        isRefurbishedRule: false,
        metric: "usage_count",
        severity: "warning",
        thresholdValue: 5,
      },
    ]),
    barcode: "",
    condition: "used",
    gearType: "sails",
    name: "New Sail",
    scopeAlert: "warning",
    scopeCondition: "used",
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "active_training",
    scopeTeamId: TEAM_1,
    scopeType: "sails",
    serialNumber: " SN-2 ",
    status: "active_training",
    ...overrides,
  })
}

function buildUpdateForm(overrides = {}) {
  return formDataFromObject({
    alertRulesPayload: JSON.stringify([
      {
        isRefurbishedRule: true,
        metric: "usage_minutes",
        severity: "critical",
        thresholdValue: 60,
      },
    ]),
    barcode: "",
    condition: "refurbished",
    gearType: "running_rigging",
    id: GEAR_1,
    name: "Updated Line",
    scopeAlert: "warning",
    scopeCondition: "used",
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "active_training",
    scopeTeamId: TEAM_1,
    scopeType: "sails",
    serialNumber: "",
    status: "on_repair",
    ...overrides,
  })
}

function buildRetireForm(overrides = {}) {
  return formDataFromObject({
    id: GEAR_1,
    nextStatus: "retired_spare",
    scopeAlert: "warning",
    scopeCondition: "used",
    scopeLoadMore: "1",
    scopeOrgId: ORG_1,
    scopePage: "3",
    scopeStatus: "active_training",
    scopeTeamId: TEAM_1,
    scopeType: "sails",
    ...overrides,
  })
}

async function runGearAction(action, input = {}) {
  const supabase = createMockSupabaseClient({
    deleteErrors: input.deleteErrors,
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

test("creates Team Gear and preserves route state", async () => {
  const { result, supabase } = await runGearAction(runCreateGearItemAction, {
    formData: buildCreateForm(),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-gear?status=created&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: ["/team-gear"],
  })
  assert.deepEqual(supabase.rowsByTable.gear_items[1], {
    barcode: null,
    condition: "used",
    gear_type: "sails",
    id: "gear_items-2",
    name: "New Sail",
    serial_number: "SN-2",
    status: "active_training",
    team_id: TEAM_1,
  })
  assert.deepEqual(supabase.rowsByTable.gear_alert_rules[1], {
    gear_item_id: "gear_items-2",
    is_refurbished_rule: false,
    metric: "usage_count",
    severity: "warning",
    threshold_value: 5,
  })
})

test("updates Team Gear and replaces alert rules while preserving route state", async () => {
  const { result, supabase } = await runGearAction(runUpdateGearItemAction, {
    formData: buildUpdateForm(),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-gear?status=updated&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: ["/team-gear"],
  })
  assert.deepEqual(supabase.rowsByTable.gear_items[0], {
    barcode: null,
    condition: "refurbished",
    gear_type: "running_rigging",
    id: GEAR_1,
    name: "Updated Line",
    serial_number: null,
    status: "on_repair",
    team_id: TEAM_1,
  })
  assert.deepEqual(supabase.rowsByTable.gear_alert_rules, [
    {
      gear_item_id: GEAR_1,
      is_refurbished_rule: true,
      metric: "usage_minutes",
      severity: "critical",
      threshold_value: 60,
    },
  ])
})

test("retires Team Gear and preserves route state", async () => {
  const { result, supabase } = await runGearAction(runRetireGearItemAction, {
    formData: buildRetireForm(),
  })

  assert.deepEqual(result, {
    type: "redirect",
    path: `/team-gear?status=retired&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: ["/team-gear"],
  })
  assert.equal(supabase.rowsByTable.gear_items[0].status, "retired_spare")
})

test("redirects forbidden before create update and retire without Gear permission", async () => {
  const accessContext = buildAccessContext({
    teamMemberships: [],
  })

  const createResult = await runGearAction(runCreateGearItemAction, {
    accessContext,
    formData: buildCreateForm(),
  })
  const updateResult = await runGearAction(runUpdateGearItemAction, {
    accessContext,
    formData: buildUpdateForm(),
  })
  const retireResult = await runGearAction(runRetireGearItemAction, {
    accessContext,
    formData: buildRetireForm(),
  })

  assert.deepEqual(createResult.result, {
    type: "redirect",
    path: `/team-gear?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.deepEqual(updateResult.result, {
    type: "redirect",
    path: `/team-gear?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.deepEqual(retireResult.result, {
    type: "redirect",
    path: `/team-gear?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(createResult.supabase.rowsByTable.gear_items.length, 1)
  assert.equal(updateResult.supabase.rowsByTable.gear_items[0].name, "Old Sail")
  assert.equal(retireResult.supabase.rowsByTable.gear_items[0].status, "active_training")
})

test("redirects forbidden for cross-team update and retire attempts", async () => {
  const tables = {
    gear_items: [
      {
        barcode: "BC-2",
        condition: "used",
        gear_type: "sails",
        id: GEAR_1,
        name: "Other Team Sail",
        serial_number: "SN-2",
        status: "active_training",
        team_id: TEAM_2,
      },
    ],
  }

  const updateResult = await runGearAction(runUpdateGearItemAction, {
    formData: buildUpdateForm(),
    tables,
  })
  const retireResult = await runGearAction(runRetireGearItemAction, {
    formData: buildRetireForm(),
    tables,
  })

  assert.deepEqual(updateResult.result, {
    type: "redirect",
    path: `/team-gear?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.deepEqual(retireResult.result, {
    type: "redirect",
    path: `/team-gear?error=forbidden&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(updateResult.supabase.rowsByTable.gear_items[0].name, "Other Team Sail")
  assert.equal(retireResult.supabase.rowsByTable.gear_items[0].status, "active_training")
})

test("redirects invalid input for invalid create and update alert-rule payloads", async () => {
  const createResult = await runGearAction(runCreateGearItemAction, {
    formData: buildCreateForm({
      alertRulesPayload: JSON.stringify([
        {
          isRefurbishedRule: false,
          metric: "usage_count",
          severity: "warning",
          thresholdValue: 0,
        },
      ]),
    }),
  })
  const updateResult = await runGearAction(runUpdateGearItemAction, {
    formData: buildUpdateForm({
      alertRulesPayload: "{bad json",
    }),
  })

  assert.deepEqual(createResult.result, {
    type: "redirect",
    path: `/team-gear?error=invalid_input&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.deepEqual(updateResult.result, {
    type: "redirect",
    path: `/team-gear?error=invalid_input&${PRESERVED_ROUTE_STATE}`,
    revalidatedPaths: [],
  })
  assert.equal(createResult.supabase.rowsByTable.gear_items.length, 1)
  assert.equal(updateResult.supabase.rowsByTable.gear_items[0].name, "Old Sail")
  assert.deepEqual(updateResult.supabase.rowsByTable.gear_alert_rules, [
    {
      gear_item_id: GEAR_1,
      id: ALERT_1,
      is_refurbished_rule: false,
      metric: "usage_count",
      severity: "warning",
      threshold_value: 10,
    },
  ])
})
