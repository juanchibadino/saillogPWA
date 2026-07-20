import type { Database } from "@/types/database"

export type GearType = Database["public"]["Enums"]["gear_type"]
export type GearStatus = Database["public"]["Enums"]["gear_status"]
export type GearCondition = Database["public"]["Enums"]["gear_condition"]
export type TeamGearAlertState = Database["public"]["Enums"]["gear_alert_state"]

export type TeamGearAlertStateFilter = Exclude<TeamGearAlertState, "none"> | "none"

export type TeamGearAlertRuleItem = {
  id: string
  metric: Database["public"]["Enums"]["gear_alert_metric"]
  severity: Database["public"]["Enums"]["gear_alert_severity"]
  thresholdValue: number
  isRefurbishedRule: boolean
}

export type TeamGearTwsOption = {
  id: string
  value: string
  label: string
  position: number
}

export type TeamGearTwsMultiplier = {
  optionId: string
  usageMinutesMultiplier: number
  usageCountMultiplier: number
}

export type TeamGearListItem = {
  id: string
  name: string
  gearType: GearType
  serialNumber: string | null
  barcode: string | null
  status: GearStatus
  condition: GearCondition
  usageCount: number
  usageMinutes: number
  alertState: TeamGearAlertState
  triggeredAlertCount: number
  alertRules: TeamGearAlertRuleItem[]
  twsMultipliers: TeamGearTwsMultiplier[]
}

export const TEAM_GEAR_TYPE_OPTIONS: Array<{ value: GearType; label: string }> = [
  { value: "sails", label: "Sails" },
  { value: "spars_and_foils", label: "Spars & Foils" },
  { value: "running_rigging", label: "Running Rigging" },
  { value: "hardware_and_fittings", label: "Hardware & Fittings" },
]

export const TEAM_GEAR_STATUS_OPTIONS: Array<{ value: GearStatus; label: string }> = [
  { value: "active_regatta", label: "Active Regatta" },
  { value: "active_training", label: "Active Training" },
  { value: "retired_spare", label: "Retired/Spare" },
  { value: "on_repair", label: "On Repair" },
]

export const TEAM_GEAR_CONDITION_OPTIONS: Array<{ value: GearCondition; label: string }> = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "refurbished", label: "Refurbished" },
]

export const TEAM_GEAR_ALERT_STATE_OPTIONS: Array<{
  value: TeamGearAlertStateFilter
  label: string
}> = [
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "none", label: "No Alerts" },
]
