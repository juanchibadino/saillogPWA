import assert from "node:assert/strict"
import test from "node:test"

import { getTeamGearResultsDataForSupabase } from "./data-results-core.mjs"
import { getDefaultTwsMultiplier } from "./tws-multiplier-defaults.mjs"

function buildDefaultTwsMultiplierList(optionCount) {
  return Array.from({ length: optionCount }, (_, index) =>
    getDefaultTwsMultiplier(index + 1, optionCount),
  )
}

test("resolves ordered TWS default multiplier ladders", () => {
  assert.deepEqual(buildDefaultTwsMultiplierList(1), [1])
  assert.deepEqual(buildDefaultTwsMultiplierList(2), [0.5, 1])
  assert.deepEqual(buildDefaultTwsMultiplierList(3), [0.4, 0.6, 1])
  assert.deepEqual(buildDefaultTwsMultiplierList(4), [0.3, 0.5, 0.7, 1])
  assert.deepEqual(buildDefaultTwsMultiplierList(5), [0.2, 0.4, 0.6, 0.8, 1])
  assert.deepEqual(buildDefaultTwsMultiplierList(6), [0.1, 0.28, 0.46, 0.64, 0.82, 1])
})

function createResultsLoaderSupabase() {
  const calls = []

  return {
    calls,
    from(tableName) {
      calls.push({ type: "from", tableName })

      return {
        filters: [],
        select(columns) {
          calls.push({ type: "select", tableName, columns })
          return this
        },
        eq(column, value) {
          calls.push({ type: "eq", tableName, column, value })
          this.filters.push({ column, value })
          return this
        },
        order(column, options) {
          calls.push({ type: "order", tableName, column, options })
          return this
        },
        maybeSingle() {
          calls.push({ type: "maybeSingle", tableName })

          if (tableName === "team_setup_items") {
            return Promise.resolve({
              data: {
                id: "tws-item-1",
              },
              error: null,
            })
          }

          return Promise.resolve({ data: null, error: null })
        },
        in(column, values) {
          calls.push({ type: "in", tableName, column, values })

          if (tableName === "gear_tws_option_multipliers") {
            return Promise.resolve({
              data: [
                {
                  gear_item_id: "gear-26",
                  team_setup_item_option_id: "tws-option-1",
                  usage_count_multiplier: 1.25,
                  usage_minutes_multiplier: 0.2,
                },
              ],
              error: null,
            })
          }

          assert.equal(tableName, "gear_alert_rules")

          return Promise.resolve({
            data: [
                {
                  gear_item_id: "gear-26",
                  id: "rule-2",
                  metric: "usage_minutes",
                  severity: "critical",
                  threshold_value: 90,
                },
                {
                  gear_item_id: "gear-26",
                  id: "rule-1",
                  metric: "usage_count",
                  severity: "warning",
                  threshold_value: 4,
              },
            ],
            error: null,
          })
        },
        then(resolve, reject) {
          try {
            if (tableName === "team_setup_item_options") {
              Promise.resolve({
                data: [
                  {
                    id: "tws-option-1",
                    label: "ST 0-4",
                    position: 1,
                    value: "ST 0-4",
                  },
                  {
                    id: "tws-option-2",
                    label: "DT 5-8",
                    position: 2,
                    value: "DT 5-8",
                  },
                ],
                error: null,
              }).then(resolve, reject)
              return
            }

            Promise.resolve({ data: [], error: null }).then(resolve, reject)
          } catch (error) {
            reject(error)
          }
        },
      }
    },
    rpc(functionName, args) {
      calls.push({ type: "rpc", functionName, args })

      assert.equal(functionName, "get_team_gear_list_rows")

      return Promise.resolve({
        data: [
          {
            alert_state: "warning",
            barcode: "BC-26",
            condition: "used",
            created_at: "2026-07-11T00:00:00.000Z",
            gear_item_id: "gear-26",
            gear_type: "sails",
            name: "Past Due Main",
            serial_number: "SN-26",
            status: "active_training",
            team_id: "team-1",
            total_count: 30,
            triggered_alert_count: 2,
            usage_count: 4,
            usage_minutes: 120,
          },
          {
            alert_state: "critical",
            barcode: null,
            condition: "used",
            created_at: "2026-07-11T00:00:00.000Z",
            gear_item_id: "gear-27",
            gear_type: "sails",
            name: "Near Limit Jib",
            serial_number: null,
            status: "active_training",
            team_id: "team-1",
            total_count: 30,
            triggered_alert_count: 1,
            usage_count: 2,
            usage_minutes: 45,
          },
        ],
        error: null,
      })
    },
  }
}

test("loads Team Gear results through the computed RPC and hydrates only visible alert rules", async () => {
  const supabase = createResultsLoaderSupabase()

  const result = await getTeamGearResultsDataForSupabase({
    supabase,
    activeTeamId: "team-1",
    chromeData: {
      selectedAlertState: "critical",
      selectedCondition: "used",
      selectedStatus: "active_training",
      selectedType: "sails",
    },
    page: 2,
    accumulatePages: false,
  })

  assert.deepEqual(supabase.calls[0], {
    type: "rpc",
    functionName: "get_team_gear_list_rows",
    args: {
      p_alert: "critical",
      p_condition: "used",
      p_limit: 25,
      p_offset: 25,
      p_status: "active_training",
      p_team_id: "team-1",
      p_type: "sails",
    },
  })
  assert.deepEqual(
    supabase.calls.filter((call) => call.type === "from").map((call) => call.tableName),
    [
      "gear_alert_rules",
      "team_setup_items",
      "team_setup_item_options",
      "gear_tws_option_multipliers",
    ],
  )
  assert.deepEqual(
    supabase.calls.find(
      (call) => call.type === "in" && call.tableName === "gear_alert_rules",
    ),
    {
      type: "in",
      tableName: "gear_alert_rules",
      column: "gear_item_id",
      values: ["gear-26", "gear-27"],
    },
  )
  assert.deepEqual(result, {
    gearItems: [
      {
        alertRules: [
          {
            id: "rule-1",
            metric: "usage_count",
            severity: "warning",
            thresholdValue: 4,
          },
          {
            id: "rule-2",
            metric: "usage_minutes",
            severity: "critical",
            thresholdValue: 90,
          },
        ],
        alertState: "warning",
        barcode: "BC-26",
        condition: "used",
        gearType: "sails",
        id: "gear-26",
        name: "Past Due Main",
        serialNumber: "SN-26",
        status: "active_training",
        triggeredAlertCount: 2,
        twsMultipliers: [
          {
            optionId: "tws-option-1",
            usageCountMultiplier: 1.25,
            usageMinutesMultiplier: 0.2,
          },
        ],
        usageCount: 4,
        usageMinutes: 120,
      },
      {
        alertRules: [],
        alertState: "critical",
        barcode: null,
        condition: "used",
        gearType: "sails",
        id: "gear-27",
        name: "Near Limit Jib",
        serialNumber: null,
        status: "active_training",
        triggeredAlertCount: 1,
        twsMultipliers: [],
        usageCount: 2,
        usageMinutes: 45,
      },
    ],
    twsOptions: [
      {
        id: "tws-option-1",
        label: "ST 0-4",
        position: 1,
        value: "ST 0-4",
      },
      {
        id: "tws-option-2",
        label: "DT 5-8",
        position: 2,
        value: "DT 5-8",
      },
    ],
    currentPage: 2,
    hasNextPage: false,
    hasPreviousPage: true,
    loadMoreMode: false,
    pageCount: 2,
  })
  assert.equal(
    supabase.calls.some((call) =>
      ["gear_items", "session_gear_usage", "sessions"].includes(call.tableName),
    ),
    false,
  )
})
