import { z } from "zod"

import { canManageTeamSessionsFromAccess } from "../../lib/auth/capability-rules.mjs"
import { buildTeamGearRedirectPath } from "./list-route-state.mjs"
import { getDefaultTwsMultiplier } from "./tws-multiplier-defaults.mjs"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const optionalTrimmedIdentifierSchema = z
  .string()
  .trim()
  .max(120)
  .optional()

const gearAlertRuleRowInputSchema = z.object({
  metric: z.enum(["usage_count", "usage_minutes"]),
  severity: z.enum(["warning", "critical"]),
  thresholdValue: z.number().int().positive(),
})

const gearAlertRuleGroupInputSchema = z
  .object({
    metric: z.enum(["usage_count", "usage_minutes"]),
    pastDueThresholdValue: z.number().int().positive(),
    nearLimitThresholdValue: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (rule) =>
      rule.nearLimitThresholdValue == null ||
      rule.nearLimitThresholdValue < rule.pastDueThresholdValue,
  )

const gearAlertRuleGroupsInputSchema = z
  .array(gearAlertRuleGroupInputSchema)
  .max(2)
  .refine((rules) => new Set(rules.map((rule) => rule.metric)).size === rules.length)
  .transform((rules) =>
    rules.flatMap((rule) => {
      const expandedRules = [
        {
          metric: rule.metric,
          severity: "warning",
          thresholdValue: rule.pastDueThresholdValue,
        },
      ]

      if (rule.nearLimitThresholdValue != null) {
        expandedRules.push({
          metric: rule.metric,
          severity: "critical",
          thresholdValue: rule.nearLimitThresholdValue,
        })
      }

      return expandedRules
    }),
  )

const gearTwsMultiplierInputSchema = z.object({
  optionId: z.string().uuid(),
  usageMinutesMultiplier: z.number().min(0).max(9999),
  usageCountMultiplier: z.number().min(0).max(9999),
})

const baseGearItemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gearType: z.enum([
    "sails",
    "spars_and_foils",
    "running_rigging",
    "hardware_and_fittings",
  ]),
  serialNumber: optionalTrimmedIdentifierSchema,
  barcode: optionalTrimmedIdentifierSchema,
  status: z.enum(["active_regatta", "active_training", "retired_spare", "on_repair"]),
  condition: z.enum(["new", "used", "refurbished"]),
  alertRules: z.array(gearAlertRuleRowInputSchema).max(4),
})

const createGearItemInputSchema = baseGearItemInputSchema
const updateGearItemInputSchema = baseGearItemInputSchema.extend({
  id: z.string().uuid(),
})
const retireGearItemInputSchema = z.object({
  id: z.string().uuid(),
  nextStatus: z.enum(["retired_spare", "on_repair", "active_training", "active_regatta"]),
})

function getFormString(formData, key) {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function parseOptionalPage(value) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.floor(parsed)
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseAlertRulesPayload(value) {
  if (!value) {
    return null
  }

  let parsed

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  const parsedRules = gearAlertRuleGroupsInputSchema.safeParse(parsed)

  if (!parsedRules.success) {
    return null
  }

  return parsedRules.data
}

function parseTwsMultipliersPayload(value) {
  if (!value) {
    return null
  }

  let parsed

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  const parsedMultipliers = z.array(gearTwsMultiplierInputSchema).safeParse(parsed)

  if (!parsedMultipliers.success) {
    return null
  }

  const uniqueMultipliersByOptionId = new Map()

  for (const multiplier of parsedMultipliers.data) {
    uniqueMultipliersByOptionId.set(multiplier.optionId, multiplier)
  }

  if (uniqueMultipliersByOptionId.size !== parsedMultipliers.data.length) {
    return null
  }

  return parsedMultipliers.data
}

function hasCustomTwsMultiplier(input) {
  const defaultMultiplier = input.defaultMultiplier

  return (
    Math.abs(input.multiplier.usageMinutesMultiplier - defaultMultiplier) > 0.0001 ||
    Math.abs(input.multiplier.usageCountMultiplier - defaultMultiplier) > 0.0001
  )
}

function getScopeFromFormData(formData) {
  const scopeOrgId = getFormString(formData, "scopeOrgId")
  const scopeTeamId = getFormString(formData, "scopeTeamId")
  const scope = {
    scopeType: getFormString(formData, "scopeType"),
    scopeStatus: getFormString(formData, "scopeStatus"),
    scopeCondition: getFormString(formData, "scopeCondition"),
    scopeAlert: getFormString(formData, "scopeAlert"),
    scopePage: parseOptionalPage(getFormString(formData, "scopePage")),
    scopeLoadMore: getFormString(formData, "scopeLoadMore") === "1",
  }

  if (
    (typeof scopeOrgId === "string" && !isUuid(scopeOrgId)) ||
    (typeof scopeTeamId === "string" && !isUuid(scopeTeamId))
  ) {
    return scope
  }

  return {
    ...scope,
    ...(scopeOrgId ? { scopeOrgId } : {}),
    ...(scopeTeamId ? { scopeTeamId } : {}),
  }
}

function redirectWith(dependencies, input) {
  dependencies.redirect(buildTeamGearRedirectPath(input))
}

function canManageGear(input) {
  return canManageTeamSessionsFromAccess({
    context: input.context,
    organizationId: input.scopeOrgId,
    teamId: input.scopeTeamId,
  })
}

async function resolveTeamOrganizationId(input) {
  const { data, error } = await input.supabase
    .from("teams")
    .select("organization_id")
    .eq("id", input.scopeTeamId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.organization_id
}

async function resolveScopedGearItem(input) {
  const { data, error } = await input.supabase
    .from("gear_items")
    .select("id,team_id")
    .eq("id", input.id)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

async function ensureValidWriteScope(input) {
  const resolvedOrganizationId = await resolveTeamOrganizationId({
    scopeTeamId: input.scope.scopeTeamId,
    supabase: input.supabase,
  })

  return (
    typeof resolvedOrganizationId === "string" &&
    resolvedOrganizationId === input.scope.scopeOrgId
  )
}

function revalidateGearList(dependencies) {
  dependencies.revalidatePath("/team-gear")
}

export async function runCreateGearItemAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedAlertRules = parseAlertRulesPayload(getFormString(formData, "alertRulesPayload"))
  const parsedInput = createGearItemInputSchema.safeParse({
    name: getFormString(formData, "name"),
    gearType: getFormString(formData, "gearType"),
    serialNumber: getFormString(formData, "serialNumber"),
    barcode: getFormString(formData, "barcode"),
    status: getFormString(formData, "status"),
    condition: getFormString(formData, "condition"),
    alertRules: parsedAlertRules,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageGear({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const hasValidScope = await ensureValidWriteScope({ scope, supabase })

  if (!hasValidScope) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const { data: insertedGearItem, error: insertError } = await supabase
    .from("gear_items")
    .insert({
      team_id: scope.scopeTeamId,
      name: parsedInput.data.name,
      gear_type: parsedInput.data.gearType,
      serial_number: normalizeOptionalText(parsedInput.data.serialNumber),
      barcode: normalizeOptionalText(parsedInput.data.barcode),
      status: parsedInput.data.status,
      condition: parsedInput.data.condition,
    })
    .select("id")
    .single()

  if (insertError || !insertedGearItem) {
    redirectWith(dependencies, {
      error: "create_failed",
      ...scope,
    })
    return
  }

  if (parsedInput.data.alertRules.length > 0) {
    const { error: insertRulesError } = await supabase.from("gear_alert_rules").insert(
      parsedInput.data.alertRules.map((rule) => ({
        gear_item_id: insertedGearItem.id,
        metric: rule.metric,
        severity: rule.severity,
        threshold_value: rule.thresholdValue,
      })),
    )

    if (insertRulesError) {
      await supabase.from("gear_items").delete().eq("id", insertedGearItem.id)

      redirectWith(dependencies, {
        error: "create_failed",
        ...scope,
      })
      return
    }
  }

  revalidateGearList(dependencies)
  redirectWith(dependencies, {
    status: "created",
    ...scope,
  })
}

export async function runUpdateGearItemAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedAlertRules = parseAlertRulesPayload(getFormString(formData, "alertRulesPayload"))
  const parsedInput = updateGearItemInputSchema.safeParse({
    id: getFormString(formData, "id"),
    name: getFormString(formData, "name"),
    gearType: getFormString(formData, "gearType"),
    serialNumber: getFormString(formData, "serialNumber"),
    barcode: getFormString(formData, "barcode"),
    status: getFormString(formData, "status"),
    condition: getFormString(formData, "condition"),
    alertRules: parsedAlertRules,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageGear({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const scopedGearItem = await resolveScopedGearItem({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
    supabase,
  })

  if (!scopedGearItem) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const { error: updateError } = await supabase
    .from("gear_items")
    .update({
      name: parsedInput.data.name,
      gear_type: parsedInput.data.gearType,
      serial_number: normalizeOptionalText(parsedInput.data.serialNumber),
      barcode: normalizeOptionalText(parsedInput.data.barcode),
      status: parsedInput.data.status,
      condition: parsedInput.data.condition,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  const { error: deleteRulesError } = await supabase
    .from("gear_alert_rules")
    .delete()
    .eq("gear_item_id", parsedInput.data.id)

  if (deleteRulesError) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  if (parsedInput.data.alertRules.length > 0) {
    const { error: insertRulesError } = await supabase.from("gear_alert_rules").insert(
      parsedInput.data.alertRules.map((rule) => ({
        gear_item_id: parsedInput.data.id,
        metric: rule.metric,
        severity: rule.severity,
        threshold_value: rule.thresholdValue,
      })),
    )

    if (insertRulesError) {
      redirectWith(dependencies, {
        error: "update_failed",
        ...scope,
      })
      return
    }
  }

  revalidateGearList(dependencies)
  redirectWith(dependencies, {
    status: "updated",
    ...scope,
  })
}

export async function runRetireGearItemAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedInput = retireGearItemInputSchema.safeParse({
    id: getFormString(formData, "id"),
    nextStatus: getFormString(formData, "nextStatus"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageGear({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const scopedGearItem = await resolveScopedGearItem({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
    supabase,
  })

  if (!scopedGearItem) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const { error: updateError } = await supabase
    .from("gear_items")
    .update({
      status: parsedInput.data.nextStatus,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  revalidateGearList(dependencies)
  redirectWith(dependencies, {
    status: parsedInput.data.nextStatus === "retired_spare" ? "retired" : "updated",
    ...scope,
  })
}

export async function runUpdateGearTwsMultipliersAction(formData, dependencies) {
  const context = await dependencies.requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const parsedMultipliers = parseTwsMultipliersPayload(
    getFormString(formData, "multipliersPayload"),
  )
  const parsedInput = z
    .object({
      id: z.string().uuid(),
      multipliers: z.array(gearTwsMultiplierInputSchema).max(500),
    })
    .safeParse({
      id: getFormString(formData, "id"),
      multipliers: parsedMultipliers,
    })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  if (
    !canManageGear({
      context,
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
    })
  ) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const supabase = await dependencies.createServerSupabaseClient()
  const scopedGearItem = await resolveScopedGearItem({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
    supabase,
  })

  if (!scopedGearItem) {
    redirectWith(dependencies, {
      error: "forbidden",
      ...scope,
    })
    return
  }

  const { data: twsItem, error: twsItemError } = await supabase
    .from("team_setup_items")
    .select("id")
    .eq("team_id", scope.scopeTeamId)
    .eq("key", "tws")
    .eq("metric_group", "weather")
    .eq("input_kind", "multi_select")
    .eq("is_active", true)
    .maybeSingle()

  if (twsItemError) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  if (!twsItem) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const { data: optionRows, error: optionRowsError } = await supabase
    .from("team_setup_item_options")
    .select("id,position")
    .eq("team_setup_item_id", twsItem.id)
    .eq("is_active", true)
    .order("position", { ascending: true })

  if (optionRowsError || !optionRows) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  const activeOptionIds = optionRows.map((row) => row.id)
  const activeOptionIdSet = new Set(activeOptionIds)
  const defaultMultiplierByOptionId = new Map(
    optionRows.map((row, index) => [
      row.id,
      getDefaultTwsMultiplier(index + 1, optionRows.length),
    ]),
  )

  if (
    activeOptionIds.length === 0 ||
    parsedInput.data.multipliers.some((multiplier) => !activeOptionIdSet.has(multiplier.optionId))
  ) {
    redirectWith(dependencies, {
      error: "invalid_input",
      ...scope,
    })
    return
  }

  const { error: deleteMultipliersError } = await supabase
    .from("gear_tws_option_multipliers")
    .delete()
    .eq("gear_item_id", parsedInput.data.id)
    .in("team_setup_item_option_id", activeOptionIds)

  if (deleteMultipliersError) {
    redirectWith(dependencies, {
      error: "update_failed",
      ...scope,
    })
    return
  }

  const rowsToInsert = parsedInput.data.multipliers
    .filter((multiplier) =>
      hasCustomTwsMultiplier({
        multiplier,
        defaultMultiplier: defaultMultiplierByOptionId.get(multiplier.optionId) ?? 1,
      }),
    )
    .map((multiplier) => ({
      gear_item_id: parsedInput.data.id,
      team_setup_item_option_id: multiplier.optionId,
      usage_minutes_multiplier: multiplier.usageMinutesMultiplier,
      usage_count_multiplier: multiplier.usageCountMultiplier,
    }))

  if (rowsToInsert.length > 0) {
    const { error: insertMultipliersError } = await supabase
      .from("gear_tws_option_multipliers")
      .insert(rowsToInsert)

    if (insertMultipliersError) {
      redirectWith(dependencies, {
        error: "update_failed",
        ...scope,
      })
      return
    }
  }

  revalidateGearList(dependencies)
  redirectWith(dependencies, {
    status: "tws_multipliers_updated",
    ...scope,
  })
}
