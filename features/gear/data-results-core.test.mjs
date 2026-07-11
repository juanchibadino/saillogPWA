import assert from "node:assert/strict"
import test from "node:test"

import { getTeamGearResultsDataForSupabase } from "./data-results-core.mjs"

function createResultsLoaderSupabase() {
  const calls = []

  return {
    calls,
    from(tableName) {
      calls.push({ type: "from", tableName })

      assert.equal(tableName, "gear_alert_rules")

      return {
        select(columns) {
          calls.push({ type: "select", tableName, columns })
          return this
        },
        in(column, values) {
          calls.push({ type: "in", tableName, column, values })

          return Promise.resolve({
            data: [
              {
                gear_item_id: "gear-26",
                id: "rule-2",
                is_refurbished_rule: false,
                metric: "usage_minutes",
                severity: "critical",
                threshold_value: 90,
              },
              {
                gear_item_id: "gear-26",
                id: "rule-1",
                is_refurbished_rule: true,
                metric: "usage_count",
                severity: "warning",
                threshold_value: 4,
              },
            ],
            error: null,
          })
        },
      }
    },
    rpc(functionName, args) {
      calls.push({ type: "rpc", functionName, args })

      assert.equal(functionName, "get_team_gear_list_rows")

      return Promise.resolve({
        data: [
          {
            alert_state: "critical",
            barcode: "BC-26",
            condition: "used",
            created_at: "2026-07-11T00:00:00.000Z",
            gear_item_id: "gear-26",
            gear_type: "sails",
            name: "Critical Main",
            serial_number: "SN-26",
            status: "active_training",
            team_id: "team-1",
            total_count: 30,
            triggered_alert_count: 2,
            usage_count: 4,
            usage_minutes: 120,
          },
          {
            alert_state: "warning",
            barcode: null,
            condition: "used",
            created_at: "2026-07-11T00:00:00.000Z",
            gear_item_id: "gear-27",
            gear_type: "sails",
            name: "Watch Jib",
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
    ["gear_alert_rules"],
  )
  assert.deepEqual(
    supabase.calls.find((call) => call.type === "in"),
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
            isRefurbishedRule: true,
            metric: "usage_count",
            severity: "warning",
            thresholdValue: 4,
          },
          {
            id: "rule-2",
            isRefurbishedRule: false,
            metric: "usage_minutes",
            severity: "critical",
            thresholdValue: 90,
          },
        ],
        alertState: "critical",
        barcode: "BC-26",
        condition: "used",
        gearType: "sails",
        id: "gear-26",
        name: "Critical Main",
        serialNumber: "SN-26",
        status: "active_training",
        triggeredAlertCount: 2,
        usageCount: 4,
        usageMinutes: 120,
      },
      {
        alertRules: [],
        alertState: "warning",
        barcode: null,
        condition: "used",
        gearType: "sails",
        id: "gear-27",
        name: "Watch Jib",
        serialNumber: null,
        status: "active_training",
        triggeredAlertCount: 1,
        usageCount: 2,
        usageMinutes: 45,
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
