import { TEAM_GEAR_PAGE_SIZE } from "./data-core.mjs"
import { resolveTeamGearListRowsPage } from "./data-loader-core.mjs"

const GEAR_ALERT_RULES_SELECT_COLUMNS =
  "id,gear_item_id,metric,severity,threshold_value"
const GEAR_TWS_MULTIPLIERS_SELECT_COLUMNS =
  "gear_item_id,team_setup_item_option_id,usage_minutes_multiplier,usage_count_multiplier"
const TWS_OPTIONS_SELECT_COLUMNS = "id,value,label,position"

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

async function getTwsOptions(input) {
  const { data: twsItem, error: twsItemError } = await input.supabase
    .from("team_setup_items")
    .select("id")
    .eq("team_id", input.activeTeamId)
    .eq("key", "tws")
    .eq("metric_group", "weather")
    .eq("input_kind", "multi_select")
    .eq("is_active", true)
    .maybeSingle()

  if (twsItemError) {
    throw new Error(`Could not load TWS setup item: ${twsItemError.message}`)
  }

  if (!twsItem) {
    return []
  }

  const { data, error } = await input.supabase
    .from("team_setup_item_options")
    .select(TWS_OPTIONS_SELECT_COLUMNS)
    .eq("team_setup_item_id", twsItem.id)
    .eq("is_active", true)
    .order("position", { ascending: true })

  if (error) {
    throw new Error(`Could not load TWS setup options: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    value: row.value,
    label: row.label,
    position: row.position,
  }))
}

async function getTwsMultipliersByGearItemId(input) {
  if (input.gearItemIds.length === 0) {
    return new Map()
  }

  const { data, error } = await input.supabase
    .from("gear_tws_option_multipliers")
    .select(GEAR_TWS_MULTIPLIERS_SELECT_COLUMNS)
    .in("gear_item_id", input.gearItemIds)

  if (error) {
    throw new Error(`Could not load gear TWS multipliers: ${error.message}`)
  }

  const multipliersByGearItemId = new Map()

  for (const row of data ?? []) {
    const existingMultipliers = multipliersByGearItemId.get(row.gear_item_id) ?? []
    existingMultipliers.push({
      optionId: row.team_setup_item_option_id,
      usageMinutesMultiplier: Number(row.usage_minutes_multiplier),
      usageCountMultiplier: Number(row.usage_count_multiplier),
    })
    multipliersByGearItemId.set(row.gear_item_id, existingMultipliers)
  }

  return multipliersByGearItemId
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
      twsMultipliers: input.twsMultipliersByGearItemId.get(row.gear_item_id) ?? [],
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
  const twsOptions = await getTwsOptions({
    supabase: input.supabase,
    activeTeamId: input.activeTeamId,
  })
  const twsMultipliersByGearItemId = await getTwsMultipliersByGearItemId({
    supabase: input.supabase,
    gearItemIds: listRowsPage.rows.map((row) => row.gear_item_id),
  })
  const pagination = listRowsPage.pagination

  return {
    gearItems: mapTeamGearListRows({
      rows: listRowsPage.rows,
      alertRulesByGearItemId,
      twsMultipliersByGearItemId,
    }),
    twsOptions,
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
    loadMoreMode: input.accumulatePages,
  }
}
