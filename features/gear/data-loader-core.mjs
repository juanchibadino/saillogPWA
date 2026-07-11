import { resolveTeamGearVisibleRange } from "./data-core.mjs"
import { resolveTeamGearPagination } from "./list-route-state.mjs"

function buildTeamGearListRowsRpcArgs(input) {
  return {
    p_team_id: input.activeTeamId,
    p_type: input.selectedType ?? null,
    p_status: input.selectedStatus ?? null,
    p_condition: input.selectedCondition ?? null,
    p_alert: input.selectedAlertState ?? null,
    p_limit: input.limit,
    p_offset: input.offset,
  }
}

function resolveVisibleCount(range) {
  return range.rangeEnd - range.rangeStart + 1
}

function getTotalItems(rows) {
  return rows[0]?.total_count ?? 0
}

async function loadTeamGearListRowsPage(input) {
  const args = buildTeamGearListRowsRpcArgs(input)
  const { data, error } = await input.supabase.rpc("get_team_gear_list_rows", args)

  if (error) {
    throw new Error(`Could not load computed gear list rows: ${error.message}`)
  }

  const rows = data ?? []

  return {
    args,
    rows,
    totalItems: getTotalItems(rows),
  }
}

function rangesMatch(left, right) {
  return left.rangeStart === right.rangeStart && left.rangeEnd === right.rangeEnd
}

export async function resolveTeamGearListRowsPage(input) {
  const requestedRange = resolveTeamGearVisibleRange({
    currentPage: input.requestedPage,
    accumulatePages: input.accumulatePages,
    pageSize: input.pageSize,
  })
  const requestedPage = await loadTeamGearListRowsPage({
    ...input,
    limit: resolveVisibleCount(requestedRange),
    offset: requestedRange.rangeStart,
  })
  let totalItems = requestedPage.totalItems

  if (requestedPage.rows.length === 0 && requestedRange.rangeStart > 0) {
    const countProbe = await loadTeamGearListRowsPage({
      ...input,
      limit: 1,
      offset: 0,
    })
    totalItems = countProbe.totalItems
  }

  const pagination = resolveTeamGearPagination({
    requestedPage: input.requestedPage,
    totalItems,
    accumulatePages: input.accumulatePages,
    pageSize: input.pageSize,
  })

  if (totalItems === 0) {
    return {
      rows: [],
      totalItems,
      pagination,
    }
  }

  const resolvedRange = resolveTeamGearVisibleRange({
    currentPage: pagination.currentPage,
    accumulatePages: input.accumulatePages,
    pageSize: input.pageSize,
  })

  if (rangesMatch(requestedRange, resolvedRange) && requestedPage.rows.length > 0) {
    return {
      rows: requestedPage.rows,
      totalItems,
      pagination,
    }
  }

  const resolvedPage = await loadTeamGearListRowsPage({
    ...input,
    limit: resolveVisibleCount(resolvedRange),
    offset: resolvedRange.rangeStart,
  })

  return {
    rows: resolvedPage.rows,
    totalItems,
    pagination,
  }
}
