import { TEAM_GEAR_PAGE_SIZE } from "./data-core.mjs"
import { resolveTeamGearListRowsPage } from "./data-loader-core.mjs"

const GEAR_ALERT_RULES_SELECT_COLUMNS =
  "id,gear_item_id,metric,severity,threshold_value,is_refurbished_rule"

async function getAlertRulesByGearItemId(input) {
  if (input.gearItemIds.length === 0) {
    return new Map()
  }

  const { data, error } = await input.supabase
    .from("gear_alert_rules")
    .select(GEAR_ALERT_RULES_SELECT_COLUMNS)
    .in("gear_item_id", input.gearItemIds)

  if (error) {
    throw new Error(`Could not load gear alert rules: ${error.message}`)
  }

  const alertRulesByGearItemId = new Map()

  for (const row of data ?? []) {
    const existingRules = alertRulesByGearItemId.get(row.gear_item_id) ?? []
    existingRules.push({
      id: row.id,
      metric: row.metric,
      severity: row.severity,
      thresholdValue: row.threshold_value,
      isRefurbishedRule: row.is_refurbished_rule,
    })
    alertRulesByGearItemId.set(row.gear_item_id, existingRules)
  }

  for (const [gearItemId, rules] of alertRulesByGearItemId.entries()) {
    rules.sort((left, right) => {
      if (left.metric !== right.metric) {
        return left.metric.localeCompare(right.metric)
      }

      if (left.severity !== right.severity) {
        return left.severity.localeCompare(right.severity)
      }

      return left.thresholdValue - right.thresholdValue
    })

    alertRulesByGearItemId.set(gearItemId, rules)
  }

  return alertRulesByGearItemId
}

function mapTeamGearListRows(input) {
  return input.rows.map((row) => {
    return {
      id: row.gear_item_id,
      name: row.name,
      gearType: row.gear_type,
      serialNumber: row.serial_number,
      barcode: row.barcode,
      status: row.status,
      condition: row.condition,
      usageCount: Number(row.usage_count),
      usageMinutes: Number(row.usage_minutes),
      alertState: row.alert_state,
      triggeredAlertCount: Number(row.triggered_alert_count),
      alertRules: input.alertRulesByGearItemId.get(row.gear_item_id) ?? [],
    }
  })
}

export async function getTeamGearResultsDataForSupabase(input) {
  const listRowsPage = await resolveTeamGearListRowsPage({
    supabase: input.supabase,
    activeTeamId: input.activeTeamId,
    selectedType: input.chromeData.selectedType,
    selectedStatus: input.chromeData.selectedStatus,
    selectedCondition: input.chromeData.selectedCondition,
    selectedAlertState: input.chromeData.selectedAlertState,
    requestedPage: input.page,
    accumulatePages: input.accumulatePages,
    pageSize: TEAM_GEAR_PAGE_SIZE,
  })
  const alertRulesByGearItemId = await getAlertRulesByGearItemId({
    supabase: input.supabase,
    gearItemIds: listRowsPage.rows.map((row) => row.gear_item_id),
  })
  const pagination = listRowsPage.pagination

  return {
    gearItems: mapTeamGearListRows({
      rows: listRowsPage.rows,
      alertRulesByGearItemId,
    }),
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
    loadMoreMode: input.accumulatePages,
  }
}
