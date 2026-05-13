import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import {
  TEAM_GEAR_ALERT_STATE_OPTIONS,
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type GearCondition,
  type GearStatus,
  type GearType,
  type TeamGearAlertRuleItem,
  type TeamGearAlertState,
  type TeamGearAlertStateFilter,
  type TeamGearListItem,
} from "@/features/gear/shared"

const GEAR_ITEMS_SELECT_COLUMNS =
  "id,team_id,name,gear_type,serial_number,barcode,status,condition,created_at"
const GEAR_ALERT_RULES_SELECT_COLUMNS =
  "id,gear_item_id,metric,severity,threshold_value,is_refurbished_rule"
const SESSION_GEAR_USAGE_SELECT_COLUMNS = "gear_item_id,session_id"
const SESSION_DURATION_SELECT_COLUMNS = "id,net_time_minutes,dock_out_at,dock_in_at"

export const TEAM_GEAR_PAGE_SIZE = 25

type GearItemRow = Pick<
  Database["public"]["Tables"]["gear_items"]["Row"],
  "id" | "team_id" | "name" | "gear_type" | "serial_number" | "barcode" | "status" | "condition" | "created_at"
>

type GearAlertRuleRow = Pick<
  Database["public"]["Tables"]["gear_alert_rules"]["Row"],
  "id" | "gear_item_id" | "metric" | "severity" | "threshold_value" | "is_refurbished_rule"
>

type SessionGearUsageRow = Pick<
  Database["public"]["Tables"]["session_gear_usage"]["Row"],
  "gear_item_id" | "session_id"
>

type SessionDurationRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "net_time_minutes" | "dock_out_at" | "dock_in_at"
>

export type TeamGearPageData = {
  gearItems: TeamGearListItem[]
  selectedType?: GearType
  selectedStatus?: GearStatus
  selectedCondition?: GearCondition
  selectedAlertState?: TeamGearAlertStateFilter
  currentPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)]
}

function normalizeFilterValue<T extends string>(input: {
  value?: string
  allowedValues: Set<T>
}): T | undefined {
  if (!input.value) {
    return undefined
  }

  if (!input.allowedValues.has(input.value as T)) {
    return undefined
  }

  return input.value as T
}

function resolveSessionUsageMinutes(session: SessionDurationRow): number {
  if (typeof session.net_time_minutes === "number" && session.net_time_minutes >= 0) {
    return session.net_time_minutes
  }

  if (!session.dock_out_at || !session.dock_in_at) {
    return 0
  }

  const dockOutDate = new Date(session.dock_out_at)
  const dockInDate = new Date(session.dock_in_at)

  if (Number.isNaN(dockOutDate.getTime()) || Number.isNaN(dockInDate.getTime())) {
    return 0
  }

  const diffMinutes = Math.floor((dockInDate.getTime() - dockOutDate.getTime()) / (60 * 1000))

  if (diffMinutes < 0) {
    return 0
  }

  return diffMinutes
}

function resolveAlertState(input: {
  condition: GearCondition
  usageCount: number
  usageMinutes: number
  rules: TeamGearAlertRuleItem[]
}): { state: TeamGearAlertState; triggeredCount: number } {
  let hasCritical = false
  let hasWarning = false
  let triggeredCount = 0

  for (const rule of input.rules) {
    if (rule.isRefurbishedRule && input.condition !== "refurbished") {
      continue
    }

    const currentValue = rule.metric === "usage_count" ? input.usageCount : input.usageMinutes

    if (currentValue < rule.thresholdValue) {
      continue
    }

    triggeredCount += 1

    if (rule.severity === "critical") {
      hasCritical = true
      continue
    }

    hasWarning = true
  }

  if (hasCritical) {
    return { state: "critical", triggeredCount }
  }

  if (hasWarning) {
    return { state: "warning", triggeredCount }
  }

  return { state: "none", triggeredCount: 0 }
}

export async function getTeamGearPageData(input: {
  activeTeamId: string
  selectedType?: string
  selectedStatus?: string
  selectedCondition?: string
  selectedAlertState?: string
  page: number
}): Promise<TeamGearPageData> {
  const supabase = await createServerSupabaseClient()

  const selectedType = normalizeFilterValue<GearType>({
    value: input.selectedType,
    allowedValues: new Set(TEAM_GEAR_TYPE_OPTIONS.map((option) => option.value)),
  })

  const selectedStatus = normalizeFilterValue<GearStatus>({
    value: input.selectedStatus,
    allowedValues: new Set(TEAM_GEAR_STATUS_OPTIONS.map((option) => option.value)),
  })

  const selectedCondition = normalizeFilterValue<GearCondition>({
    value: input.selectedCondition,
    allowedValues: new Set(TEAM_GEAR_CONDITION_OPTIONS.map((option) => option.value)),
  })

  const selectedAlertState = normalizeFilterValue<TeamGearAlertStateFilter>({
    value: input.selectedAlertState,
    allowedValues: new Set(TEAM_GEAR_ALERT_STATE_OPTIONS.map((option) => option.value)),
  })

  let gearQuery = supabase
    .from("gear_items")
    .select(GEAR_ITEMS_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (selectedType) {
    gearQuery = gearQuery.eq("gear_type", selectedType)
  }

  if (selectedStatus) {
    gearQuery = gearQuery.eq("status", selectedStatus)
  }

  if (selectedCondition) {
    gearQuery = gearQuery.eq("condition", selectedCondition)
  }

  const { data: gearData, error: gearError } = await gearQuery
    .order("name", { ascending: true })
    .order("created_at", { ascending: false })

  if (gearError) {
    throw new Error(`Could not load gear items: ${gearError.message}`)
  }

  const gearRows: GearItemRow[] = gearData ?? []
  const gearItemIds = gearRows.map((row) => row.id)

  if (gearItemIds.length === 0) {
    const currentPage = normalizePage(input.page)

    return {
      gearItems: [],
      selectedType,
      selectedStatus,
      selectedCondition,
      selectedAlertState,
      currentPage,
      hasPreviousPage: currentPage > 1,
      hasNextPage: false,
    }
  }

  const [{ data: alertRuleData, error: alertRuleError }, { data: sessionGearUsageData, error: sessionGearUsageError }] = await Promise.all([
    supabase
      .from("gear_alert_rules")
      .select(GEAR_ALERT_RULES_SELECT_COLUMNS)
      .in("gear_item_id", gearItemIds),
    supabase
      .from("session_gear_usage")
      .select(SESSION_GEAR_USAGE_SELECT_COLUMNS)
      .in("gear_item_id", gearItemIds),
  ])

  if (alertRuleError) {
    throw new Error(`Could not load gear alert rules: ${alertRuleError.message}`)
  }

  if (sessionGearUsageError) {
    throw new Error(`Could not load session gear usage: ${sessionGearUsageError.message}`)
  }

  const alertRuleRows: GearAlertRuleRow[] = alertRuleData ?? []
  const sessionGearUsageRows: SessionGearUsageRow[] = sessionGearUsageData ?? []

  const sessionIds = uniqueIds(sessionGearUsageRows.map((row) => row.session_id))
  let sessionDurationRows: SessionDurationRow[] = []

  if (sessionIds.length > 0) {
    const { data: sessionDurationData, error: sessionDurationError } = await supabase
      .from("sessions")
      .select(SESSION_DURATION_SELECT_COLUMNS)
      .in("id", sessionIds)

    if (sessionDurationError) {
      throw new Error(`Could not load session durations for gear usage: ${sessionDurationError.message}`)
    }

    sessionDurationRows = sessionDurationData ?? []
  }

  const alertRulesByGearItemId = new Map<string, TeamGearAlertRuleItem[]>()

  for (const row of alertRuleRows) {
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

  const sessionMinutesById = new Map(
    sessionDurationRows.map((row) => [row.id, resolveSessionUsageMinutes(row)]),
  )

  const usageByGearItemId = new Map<string, { usageCount: number; usageMinutes: number }>()

  for (const row of sessionGearUsageRows) {
    const existingUsage = usageByGearItemId.get(row.gear_item_id) ?? {
      usageCount: 0,
      usageMinutes: 0,
    }

    existingUsage.usageCount += 1
    existingUsage.usageMinutes += sessionMinutesById.get(row.session_id) ?? 0

    usageByGearItemId.set(row.gear_item_id, existingUsage)
  }

  const fullItems: TeamGearListItem[] = gearRows.map((row) => {
    const usage = usageByGearItemId.get(row.id) ?? {
      usageCount: 0,
      usageMinutes: 0,
    }

    const alertRules = alertRulesByGearItemId.get(row.id) ?? []
    const alert = resolveAlertState({
      condition: row.condition,
      usageCount: usage.usageCount,
      usageMinutes: usage.usageMinutes,
      rules: alertRules,
    })

    return {
      id: row.id,
      name: row.name,
      gearType: row.gear_type,
      serialNumber: row.serial_number,
      barcode: row.barcode,
      status: row.status,
      condition: row.condition,
      usageCount: usage.usageCount,
      usageMinutes: usage.usageMinutes,
      alertState: alert.state,
      triggeredAlertCount: alert.triggeredCount,
      alertRules,
    }
  })

  const filteredItems = selectedAlertState
    ? fullItems.filter((item) => item.alertState === selectedAlertState)
    : fullItems

  const totalItems = filteredItems.length
  const maxPage = Math.max(1, Math.ceil(totalItems / TEAM_GEAR_PAGE_SIZE))
  const currentPage = Math.min(normalizePage(input.page), maxPage)
  const offset = (currentPage - 1) * TEAM_GEAR_PAGE_SIZE
  const visibleItems = filteredItems.slice(offset, offset + TEAM_GEAR_PAGE_SIZE)

  return {
    gearItems: visibleItems,
    selectedType,
    selectedStatus,
    selectedCondition,
    selectedAlertState,
    currentPage,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < maxPage,
  }
}
