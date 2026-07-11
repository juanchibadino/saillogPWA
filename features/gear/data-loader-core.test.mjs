import assert from "node:assert/strict"
import test from "node:test"

import { TEAM_GEAR_PAGE_SIZE } from "./data-core.mjs"
import { resolveTeamGearListRowsPage } from "./data-loader-core.mjs"

function createRpcSupabase(handler) {
  const calls = []

  return {
    calls,
    rpc(functionName, args) {
      calls.push({ functionName, args })
      return Promise.resolve(handler(functionName, args))
    },
  }
}

test("loads Team Gear rows through the computed RPC for alert-aware pagination", async () => {
  const supabase = createRpcSupabase((functionName, args) => {
    assert.equal(functionName, "get_team_gear_list_rows")
    assert.equal(args.p_alert, "critical")

    return {
      data: [
        {
          gear_item_id: "gear-26",
          total_count: 30,
        },
      ],
      error: null,
    }
  })

  const result = await resolveTeamGearListRowsPage({
    supabase,
    activeTeamId: "team-1",
    selectedType: "sails",
    selectedStatus: "active_training",
    selectedCondition: "used",
    selectedAlertState: "critical",
    requestedPage: 2,
    accumulatePages: false,
    pageSize: TEAM_GEAR_PAGE_SIZE,
  })

  assert.deepEqual(supabase.calls, [
    {
      functionName: "get_team_gear_list_rows",
      args: {
        p_team_id: "team-1",
        p_type: "sails",
        p_status: "active_training",
        p_condition: "used",
        p_alert: "critical",
        p_limit: 25,
        p_offset: 25,
      },
    },
  ])
  assert.equal(result.rows[0].gear_item_id, "gear-26")
  assert.equal(result.totalItems, 30)
  assert.deepEqual(result.pagination, {
    currentPage: 2,
    pageCount: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  })
})

test("clamps invalid high Team Gear pages by probing the computed RPC count", async () => {
  const supabase = createRpcSupabase((functionName, args) => {
    assert.equal(functionName, "get_team_gear_list_rows")

    if (args.p_offset === 0) {
      return {
        data: [
          {
            gear_item_id: "gear-1",
            total_count: 30,
          },
        ],
        error: null,
      }
    }

    if (args.p_offset === 25) {
      return {
        data: [
          {
            gear_item_id: "gear-26",
            total_count: 30,
          },
        ],
        error: null,
      }
    }

    return {
      data: [],
      error: null,
    }
  })

  const result = await resolveTeamGearListRowsPage({
    supabase,
    activeTeamId: "team-1",
    requestedPage: 9,
    accumulatePages: false,
    pageSize: TEAM_GEAR_PAGE_SIZE,
  })

  assert.deepEqual(
    supabase.calls.map((call) => call.args),
    [
      {
        p_team_id: "team-1",
        p_type: null,
        p_status: null,
        p_condition: null,
        p_alert: null,
        p_limit: 25,
        p_offset: 200,
      },
      {
        p_team_id: "team-1",
        p_type: null,
        p_status: null,
        p_condition: null,
        p_alert: null,
        p_limit: 1,
        p_offset: 0,
      },
      {
        p_team_id: "team-1",
        p_type: null,
        p_status: null,
        p_condition: null,
        p_alert: null,
        p_limit: 25,
        p_offset: 25,
      },
    ],
  )
  assert.equal(result.rows[0].gear_item_id, "gear-26")
  assert.equal(result.totalItems, 30)
  assert.deepEqual(result.pagination, {
    currentPage: 2,
    pageCount: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  })
})
