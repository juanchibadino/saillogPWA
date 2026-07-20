import "server-only"

import { TEAM_GEAR_PAGE_SIZE } from "@/features/gear/data-core.mjs"
import { getTeamGearResultsDataForSupabase } from "@/features/gear/data-results-core.mjs"
import {
  TEAM_GEAR_ALERT_STATE_OPTIONS,
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type GearCondition,
  type GearStatus,
  type GearType,
  type TeamGearAlertStateFilter,
  type TeamGearListItem,
  type TeamGearTwsOption,
} from "@/features/gear/shared"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export { TEAM_GEAR_PAGE_SIZE }

export type TeamGearChromeData = {
  selectedType?: GearType
  selectedStatus?: GearStatus
  selectedCondition?: GearCondition
  selectedAlertState?: TeamGearAlertStateFilter
  typeOptions: typeof TEAM_GEAR_TYPE_OPTIONS
  statusOptions: typeof TEAM_GEAR_STATUS_OPTIONS
  conditionOptions: typeof TEAM_GEAR_CONDITION_OPTIONS
  alertOptions: typeof TEAM_GEAR_ALERT_STATE_OPTIONS
}

export type TeamGearResultsData = {
  gearItems: TeamGearListItem[]
  twsOptions: TeamGearTwsOption[]
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  loadMoreMode: boolean
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

export function getTeamGearChromeData(input: {
  selectedType?: string
  selectedStatus?: string
  selectedCondition?: string
  selectedAlertState?: string
}): TeamGearChromeData {
  return {
    selectedType: normalizeFilterValue<GearType>({
      value: input.selectedType,
      allowedValues: new Set(TEAM_GEAR_TYPE_OPTIONS.map((option) => option.value)),
    }),
    selectedStatus: normalizeFilterValue<GearStatus>({
      value: input.selectedStatus,
      allowedValues: new Set(TEAM_GEAR_STATUS_OPTIONS.map((option) => option.value)),
    }),
    selectedCondition: normalizeFilterValue<GearCondition>({
      value: input.selectedCondition,
      allowedValues: new Set(TEAM_GEAR_CONDITION_OPTIONS.map((option) => option.value)),
    }),
    selectedAlertState: normalizeFilterValue<TeamGearAlertStateFilter>({
      value: input.selectedAlertState,
      allowedValues: new Set(TEAM_GEAR_ALERT_STATE_OPTIONS.map((option) => option.value)),
    }),
    typeOptions: TEAM_GEAR_TYPE_OPTIONS,
    statusOptions: TEAM_GEAR_STATUS_OPTIONS,
    conditionOptions: TEAM_GEAR_CONDITION_OPTIONS,
    alertOptions: TEAM_GEAR_ALERT_STATE_OPTIONS,
  }
}

export async function getTeamGearResultsData(input: {
  activeTeamId: string
  chromeData: TeamGearChromeData
  page: number
  accumulatePages: boolean
}): Promise<TeamGearResultsData> {
  const supabase = await createServerSupabaseClient()

  return getTeamGearResultsDataForSupabase({
    supabase,
    activeTeamId: input.activeTeamId,
    chromeData: input.chromeData,
    page: input.page,
    accumulatePages: input.accumulatePages,
  }) as Promise<TeamGearResultsData>
}
