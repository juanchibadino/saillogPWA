"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createGearItemInputSchema,
  gearAlertRuleInputSchema,
  updateGearItemInputSchema,
} from "@/lib/validation/gear"

type GearActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
  scopeType?: string
  scopeStatus?: string
  scopeCondition?: string
  scopeAlert?: string
  scopePage?: number
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function parseOptionalPage(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.floor(parsed)
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseAlertRulesPayload(value: string | undefined) {
  if (!value) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  const rulesSchema = z.array(gearAlertRuleInputSchema)
  const parsedRules = rulesSchema.safeParse(parsed)

  if (!parsedRules.success) {
    return null
  }

  return parsedRules.data
}

function getScopeFromFormData(formData: FormData): GearActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const scopeType = getFormString(formData, "scopeType")
  const scopeStatus = getFormString(formData, "scopeStatus")
  const scopeCondition = getFormString(formData, "scopeCondition")
  const scopeAlert = getFormString(formData, "scopeAlert")
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"))

  if (!parsedScope.success) {
    return {
      scopeType,
      scopeStatus,
      scopeCondition,
      scopeAlert,
      scopePage,
    }
  }

  return {
    ...parsedScope.data,
    scopeType,
    scopeStatus,
    scopeCondition,
    scopeAlert,
    scopePage,
  }
}

function buildTeamGearRedirectPath(input: {
  status?: "created" | "updated" | "retired"
  error?: "invalid_input" | "forbidden" | "create_failed" | "update_failed"
  scopeOrgId?: string
  scopeTeamId?: string
  scopeType?: string
  scopeStatus?: string
  scopeCondition?: string
  scopeAlert?: string
  scopePage?: number
}): string {
  const params = new URLSearchParams()

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId)
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId)
  }

  if (input.scopeType) {
    params.set("type", input.scopeType)
  }

  if (input.scopeStatus) {
    params.set("statusFilter", input.scopeStatus)
  }

  if (input.scopeCondition) {
    params.set("condition", input.scopeCondition)
  }

  if (input.scopeAlert) {
    params.set("alert", input.scopeAlert)
  }

  if (input.scopePage && input.scopePage > 1) {
    params.set("page", String(input.scopePage))
  }

  const query = params.toString()
  return query.length > 0 ? `/team-gear?${query}` : "/team-gear"
}

async function resolveTeamOrganizationId(teamId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    return null
  }

  return teamRow?.organization_id ?? null
}

async function resolveScopedGearItem(input: { id: string; scopeTeamId: string }) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
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

export async function createGearItemAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
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
    redirect(
      buildTeamGearRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamGearRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const resolvedOrganizationId = await resolveTeamOrganizationId(scope.scopeTeamId)

  if (!resolvedOrganizationId || resolvedOrganizationId !== scope.scopeOrgId) {
    redirect(
      buildTeamGearRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: insertedGearItem, error: insertError } = await supabase
    .from("gear_items")
    .insert({
      team_id: scope.scopeTeamId,
      name: parsedInput.data.name,
      gear_type: parsedInput.data.gearType,
      serial_number: normalizeOptionalText(parsedInput.data.serialNumber ?? undefined),
      barcode: normalizeOptionalText(parsedInput.data.barcode ?? undefined),
      status: parsedInput.data.status,
      condition: parsedInput.data.condition,
    })
    .select("id")
    .single()

  if (insertError || !insertedGearItem) {
    redirect(
      buildTeamGearRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.alertRules.length > 0) {
    const { error: insertRulesError } = await supabase.from("gear_alert_rules").insert(
      parsedInput.data.alertRules.map((rule) => ({
        gear_item_id: insertedGearItem.id,
        metric: rule.metric,
        severity: rule.severity,
        threshold_value: rule.thresholdValue,
        is_refurbished_rule: rule.isRefurbishedRule,
      })),
    )

    if (insertRulesError) {
      await supabase.from("gear_items").delete().eq("id", insertedGearItem.id)

      redirect(
        buildTeamGearRedirectPath({
          error: "create_failed",
          ...scope,
        }),
      )
    }
  }

  revalidatePath("/team-gear")

  redirect(
    buildTeamGearRedirectPath({
      status: "created",
      ...scope,
    }),
  )
}

export async function updateGearItemAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
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
    redirect(
      buildTeamGearRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamGearRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedGearItem = await resolveScopedGearItem({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedGearItem) {
    redirect(
      buildTeamGearRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()

  const { error: updateError } = await supabase
    .from("gear_items")
    .update({
      name: parsedInput.data.name,
      gear_type: parsedInput.data.gearType,
      serial_number: normalizeOptionalText(parsedInput.data.serialNumber ?? undefined),
      barcode: normalizeOptionalText(parsedInput.data.barcode ?? undefined),
      status: parsedInput.data.status,
      condition: parsedInput.data.condition,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildTeamGearRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  const { error: deleteRulesError } = await supabase
    .from("gear_alert_rules")
    .delete()
    .eq("gear_item_id", parsedInput.data.id)

  if (deleteRulesError) {
    redirect(
      buildTeamGearRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  if (parsedInput.data.alertRules.length > 0) {
    const { error: insertRulesError } = await supabase.from("gear_alert_rules").insert(
      parsedInput.data.alertRules.map((rule) => ({
        gear_item_id: parsedInput.data.id,
        metric: rule.metric,
        severity: rule.severity,
        threshold_value: rule.thresholdValue,
        is_refurbished_rule: rule.isRefurbishedRule,
      })),
    )

    if (insertRulesError) {
      redirect(
        buildTeamGearRedirectPath({
          error: "update_failed",
          ...scope,
        }),
      )
    }
  }

  revalidatePath("/team-gear")

  redirect(
    buildTeamGearRedirectPath({
      status: "updated",
      ...scope,
    }),
  )
}

export async function retireGearItemAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)

  const parsedInput = z
    .object({
      id: z.string().uuid(),
      nextStatus: z.enum(["retired_spare", "on_repair", "active_training", "active_regatta"]),
    })
    .safeParse({
      id: getFormString(formData, "id"),
      nextStatus: getFormString(formData, "nextStatus"),
    })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamGearRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    )
  }

  if (
    !canManageTeamSessions({
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamGearRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const scopedGearItem = await resolveScopedGearItem({
    id: parsedInput.data.id,
    scopeTeamId: scope.scopeTeamId,
  })

  if (!scopedGearItem) {
    redirect(
      buildTeamGearRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase
    .from("gear_items")
    .update({
      status: parsedInput.data.nextStatus,
    })
    .eq("id", parsedInput.data.id)

  if (updateError) {
    redirect(
      buildTeamGearRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    )
  }

  revalidatePath("/team-gear")

  redirect(
    buildTeamGearRedirectPath({
      status: parsedInput.data.nextStatus === "retired_spare" ? "retired" : "updated",
      ...scope,
    }),
  )
}
