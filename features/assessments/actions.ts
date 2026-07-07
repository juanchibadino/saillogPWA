"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { buildTeamAssessmentsRedirectPath } from "@/features/assessments/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  assessmentDefinitionInputSchema,
  assessmentRunLifecycleInputSchema,
  submitAssessmentAnswersInputSchema,
  upsertAssessmentRunInputSchema,
  upsertAssessmentTemplateInputSchema,
  type AssessmentDefinitionInput,
} from "@/lib/validation/assessments"
import { scopeFormInputSchema } from "@/lib/validation/navigation"

type AssessmentErrorCode =
  | "invalid_input"
  | "forbidden"
  | "save_failed"
  | "delete_failed"
  | "close_failed"
  | "answer_failed"

type AssessmentStatusCode =
  | "template_saved"
  | "run_published"
  | "run_deleted"
  | "run_closed"
  | "answers_saved"

type AssessmentScope = {
  scopeOrgId?: string
  scopeTeamId?: string
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function parseOptionalUuid(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseDefinitionJson(value: string | undefined): AssessmentDefinitionInput | null {
  if (!value) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  const parsedDefinition = assessmentDefinitionInputSchema.safeParse(parsed)
  return parsedDefinition.success ? parsedDefinition.data : null
}

function parseCampIds(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.filter((item): item is string => typeof item === "string")
}

function parseAnswersPayload(value: string | undefined):
  | Array<{ questionId: string; scaleOptionId: string | null }>
  | null {
  if (!value) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) {
    return null
  }

  return parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>

      return {
        questionId: typeof row.questionId === "string" ? row.questionId : "",
        scaleOptionId:
          typeof row.scaleOptionId === "string" || row.scaleOptionId === null
            ? row.scaleOptionId
            : null,
      }
    })
}

function getScopeFromFormData(formData: FormData): AssessmentScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  return parsedScope.success ? parsedScope.data : {}
}

function buildRedirect(input: {
  returnPath?: string
  scope: AssessmentScope
  tab?: "created" | "templates"
  templateId?: string
  status?: AssessmentStatusCode
  error?: AssessmentErrorCode
}): string {
  return buildTeamAssessmentsRedirectPath({
    returnPath: input.returnPath,
    scopeOrgId: input.scope.scopeOrgId,
    scopeTeamId: input.scope.scopeTeamId,
    tab: input.tab,
    templateId: input.templateId,
    status: input.status,
    error: input.error,
  })
}

function categoryUsesModes(
  category: AssessmentDefinitionInput["categories"][number],
): category is Extract<AssessmentDefinitionInput["categories"][number], { modes: unknown }> {
  return Array.isArray((category as { modes?: unknown }).modes)
}

async function ensureTeamVenueBelongsToScope(input: {
  teamVenueId: string
  teamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("team_venues")
    .select("id")
    .eq("id", input.teamVenueId)
    .eq("team_id", input.teamId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data)
}

async function ensureTemplateBelongsToTeam(input: {
  templateId: string
  teamId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("assessment_templates")
    .select("id")
    .eq("id", input.templateId)
    .eq("team_id", input.teamId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data)
}

async function ensureRunBelongsToScope(input: {
  runId: string
  teamId: string
  teamVenueId: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("assessment_runs")
    .select("id")
    .eq("id", input.runId)
    .eq("team_id", input.teamId)
    .eq("team_venue_id", input.teamVenueId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data)
}

async function replaceTemplateDefinition(input: {
  templateId: string
  definition: AssessmentDefinitionInput
}): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error: deleteScaleOptionsError } = await supabase
    .from("assessment_template_scale_options")
    .delete()
    .eq("assessment_template_id", input.templateId)

  if (deleteScaleOptionsError) {
    throw new Error(deleteScaleOptionsError.message)
  }

  const { error: deleteCategoriesError } = await supabase
    .from("assessment_template_categories")
    .delete()
    .eq("assessment_template_id", input.templateId)

  if (deleteCategoriesError) {
    throw new Error(deleteCategoriesError.message)
  }

  const { error: insertScaleOptionsError } = await supabase
    .from("assessment_template_scale_options")
    .insert(
      input.definition.scaleOptions.map((option, index) => ({
        assessment_template_id: input.templateId,
        label: option.label,
        position: index + 1,
      })),
    )

  if (insertScaleOptionsError) {
    throw new Error(insertScaleOptionsError.message)
  }

  const { data: insertedCategories, error: insertCategoriesError } = await supabase
    .from("assessment_template_categories")
    .insert(
      input.definition.categories.map((category, index) => ({
        assessment_template_id: input.templateId,
        name: category.name,
        position: index + 1,
      })),
    )
    .select("id,position")

  if (insertCategoriesError) {
    throw new Error(insertCategoriesError.message)
  }

  const categories = (insertedCategories ?? []).sort(
    (left, right) => left.position - right.position,
  )

  for (let categoryIndex = 0; categoryIndex < input.definition.categories.length; categoryIndex += 1) {
    const categoryDefinition = input.definition.categories[categoryIndex]
    const insertedCategory = categories[categoryIndex]

    if (!insertedCategory) {
      throw new Error("Could not resolve inserted template category.")
    }

    if (categoryUsesModes(categoryDefinition)) {
      const { data: insertedModes, error: insertModesError } = await supabase
        .from("assessment_template_modes")
        .insert(
          categoryDefinition.modes.map((mode, modeIndex) => ({
            assessment_template_category_id: insertedCategory.id,
            name: mode.name,
            position: modeIndex + 1,
          })),
        )
        .select("id,position")

      if (insertModesError) {
        throw new Error(insertModesError.message)
      }

      const modes = (insertedModes ?? []).sort((left, right) => left.position - right.position)
      let globalQuestionPosition = 1

      for (let modeIndex = 0; modeIndex < categoryDefinition.modes.length; modeIndex += 1) {
        const modeDefinition = categoryDefinition.modes[modeIndex]
        const insertedMode = modes[modeIndex]

        if (!insertedMode) {
          throw new Error("Could not resolve inserted template mode.")
        }

        const { error: insertQuestionsError } = await supabase
          .from("assessment_template_questions")
          .insert(
            modeDefinition.questions.map((question) => ({
              assessment_template_category_id: insertedCategory.id,
              assessment_template_mode_id: insertedMode.id,
              prompt: question.prompt,
              position: globalQuestionPosition++,
              is_required: question.isRequired,
            })),
          )

        if (insertQuestionsError) {
          throw new Error(insertQuestionsError.message)
        }
      }
    } else {
      const { error: insertQuestionsError } = await supabase
        .from("assessment_template_questions")
        .insert(
          categoryDefinition.questions.map((question, questionIndex) => ({
            assessment_template_category_id: insertedCategory.id,
            prompt: question.prompt,
            position: questionIndex + 1,
            is_required: question.isRequired,
          })),
        )

      if (insertQuestionsError) {
        throw new Error(insertQuestionsError.message)
      }
    }
  }
}

async function replaceRunDefinition(input: {
  runId: string
  definition: AssessmentDefinitionInput
  campIds: string[]
}): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error: insertScaleOptionsError } = await supabase
    .from("assessment_run_scale_options")
    .insert(
      input.definition.scaleOptions.map((option, index) => ({
        assessment_run_id: input.runId,
        label: option.label,
        position: index + 1,
      })),
    )

  if (insertScaleOptionsError) {
    throw new Error(insertScaleOptionsError.message)
  }

  const { data: insertedCategories, error: insertCategoriesError } = await supabase
    .from("assessment_run_categories")
    .insert(
      input.definition.categories.map((category, index) => ({
        assessment_run_id: input.runId,
        name: category.name,
        position: index + 1,
      })),
    )
    .select("id,position")

  if (insertCategoriesError) {
    throw new Error(insertCategoriesError.message)
  }

  const categories = (insertedCategories ?? []).sort(
    (left, right) => left.position - right.position,
  )

  for (let categoryIndex = 0; categoryIndex < input.definition.categories.length; categoryIndex += 1) {
    const categoryDefinition = input.definition.categories[categoryIndex]
    const insertedCategory = categories[categoryIndex]

    if (!insertedCategory) {
      throw new Error("Could not resolve inserted run category.")
    }

    if (categoryUsesModes(categoryDefinition)) {
      const { data: insertedModes, error: insertModesError } = await supabase
        .from("assessment_run_modes")
        .insert(
          categoryDefinition.modes.map((mode, modeIndex) => ({
            assessment_run_category_id: insertedCategory.id,
            name: mode.name,
            position: modeIndex + 1,
          })),
        )
        .select("id,position")

      if (insertModesError) {
        throw new Error(insertModesError.message)
      }

      const modes = (insertedModes ?? []).sort((left, right) => left.position - right.position)
      let globalQuestionPosition = 1

      for (let modeIndex = 0; modeIndex < categoryDefinition.modes.length; modeIndex += 1) {
        const modeDefinition = categoryDefinition.modes[modeIndex]
        const insertedMode = modes[modeIndex]

        if (!insertedMode) {
          throw new Error("Could not resolve inserted run mode.")
        }

        const { error: insertQuestionsError } = await supabase
          .from("assessment_run_questions")
          .insert(
            modeDefinition.questions.map((question) => ({
              assessment_run_category_id: insertedCategory.id,
              assessment_run_mode_id: insertedMode.id,
              prompt: question.prompt,
              position: globalQuestionPosition++,
              is_required: question.isRequired,
            })),
          )

        if (insertQuestionsError) {
          throw new Error(insertQuestionsError.message)
        }
      }
    } else {
      const { error: insertQuestionsError } = await supabase
        .from("assessment_run_questions")
        .insert(
          categoryDefinition.questions.map((question, questionIndex) => ({
            assessment_run_category_id: insertedCategory.id,
            prompt: question.prompt,
            position: questionIndex + 1,
            is_required: question.isRequired,
          })),
        )

      if (insertQuestionsError) {
        throw new Error(insertQuestionsError.message)
      }
    }
  }

  const { error: insertRunCampsError } = await supabase
    .from("assessment_run_camps")
    .insert(
      input.campIds.map((campId) => ({
        assessment_run_id: input.runId,
        camp_id: campId,
      })),
    )

  if (insertRunCampsError) {
    throw new Error(insertRunCampsError.message)
  }
}

function revalidateAssessmentPaths(input: {
  runId?: string
  teamVenueId?: string
}): void {
  revalidatePath("/team-assessments")

  if (input.runId) {
    revalidatePath(`/team-assessments/${input.runId}`)
  }

  if (input.teamVenueId) {
    revalidatePath(`/venues/${input.teamVenueId}`)
    revalidatePath("/venues")
  }
}

async function buildRunName(input: {
  campIds: string[]
  fallbackTemplateName?: string
}): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("camps")
    .select("name")
    .in("id", input.campIds)

  if (error) {
    return "Assessment for selected camps"
  }

  const campNames = (data ?? [])
    .map((camp) => camp.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
  const suffix = campNames.length > 0 ? campNames.join(", ") : "selected camps"
  const prefix = input.fallbackTemplateName?.trim() || "Assessment"

  return `${prefix} for ${suffix}`.slice(0, 120)
}

export async function saveAssessmentTemplateAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const returnPath = getFormString(formData, "returnPath")
  const templateId = parseOptionalUuid(getFormString(formData, "templateId"))
  const definition = parseDefinitionJson(getFormString(formData, "definitionJson"))

  const parsedInput = upsertAssessmentTemplateInputSchema.safeParse({
    templateId,
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
    teamId: scope.scopeTeamId,
    definition,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "templates",
        error: "invalid_input",
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: parsedInput.data.teamId,
    })
  ) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "templates",
        error: "forbidden",
      }),
    )
  }

  if (parsedInput.data.templateId) {
    const templateInScope = await ensureTemplateBelongsToTeam({
      templateId: parsedInput.data.templateId,
      teamId: parsedInput.data.teamId,
    })

    if (!templateInScope) {
      redirect(
        buildRedirect({
          returnPath,
          scope,
          tab: "templates",
          error: "forbidden",
        }),
      )
    }
  }

  const supabase = await createServerSupabaseClient()
  let resolvedTemplateId = parsedInput.data.templateId

  if (resolvedTemplateId) {
    const { error: updateError } = await supabase
      .from("assessment_templates")
      .update({
        name: parsedInput.data.name,
        description: parsedInput.data.description?.trim() || null,
        is_active: true,
      })
      .eq("id", resolvedTemplateId)
      .eq("team_id", parsedInput.data.teamId)

    if (updateError) {
      redirect(
        buildRedirect({
          returnPath,
          scope,
          tab: "templates",
          error: "save_failed",
        }),
      )
    }
  } else {
    const { data: insertData, error: insertError } = await supabase
      .from("assessment_templates")
      .insert({
        team_id: parsedInput.data.teamId,
        name: parsedInput.data.name,
        description: parsedInput.data.description?.trim() || null,
        created_by_profile_id: context.user.id,
        is_active: true,
      })
      .select("id")
      .single()

    if (insertError || !insertData) {
      redirect(
        buildRedirect({
          returnPath,
          scope,
          tab: "templates",
          error: "save_failed",
        }),
      )
    }

    resolvedTemplateId = insertData.id
  }

  try {
    await replaceTemplateDefinition({
      templateId: resolvedTemplateId,
      definition: parsedInput.data.definition,
    })
  } catch {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "templates",
        error: "save_failed",
      }),
    )
  }

  revalidateAssessmentPaths({})
  redirect(
    buildRedirect({
      returnPath,
      scope,
      tab: "templates",
      templateId: resolvedTemplateId,
      status: "template_saved",
    }),
  )
}

export async function createAssessmentRunAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const returnPath = getFormString(formData, "returnPath")
  const teamVenueId = parseOptionalUuid(getFormString(formData, "teamVenueId"))
  const templateId = parseOptionalUuid(getFormString(formData, "templateId"))
  const definition = parseDefinitionJson(getFormString(formData, "definitionJson"))
  const campIds = parseCampIds(getFormString(formData, "campIdsJson"))

  const parsedInput = upsertAssessmentRunInputSchema.safeParse({
    teamId: scope.scopeTeamId,
    teamVenueId,
    templateId,
    name: "Assessment for selected camps",
    description: "",
    campIds,
    definition,
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "invalid_input",
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: parsedInput.data.teamId,
    })
  ) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "forbidden",
      }),
    )
  }

  const [teamVenueInScope, templateInScope] = await Promise.all([
    ensureTeamVenueBelongsToScope({
      teamVenueId: parsedInput.data.teamVenueId,
      teamId: parsedInput.data.teamId,
    }),
    ensureTemplateBelongsToTeam({
      templateId: parsedInput.data.templateId,
      teamId: parsedInput.data.teamId,
    }),
  ])

  if (!teamVenueInScope || !templateInScope) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "forbidden",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: templateRow } = await supabase
    .from("assessment_templates")
    .select("name")
    .eq("id", parsedInput.data.templateId)
    .eq("team_id", parsedInput.data.teamId)
    .maybeSingle()
  const runName = await buildRunName({
    campIds: parsedInput.data.campIds,
    fallbackTemplateName: templateRow?.name,
  })
  const publishedAt = new Date().toISOString()
  const { data: runData, error: insertError } = await supabase
    .from("assessment_runs")
    .insert({
      team_id: parsedInput.data.teamId,
      team_venue_id: parsedInput.data.teamVenueId,
      assessment_template_id: parsedInput.data.templateId,
      name: runName,
      description: null,
      status: "published",
      published_at: publishedAt,
      closed_at: null,
      created_by_profile_id: context.user.id,
    })
    .select("id")
    .single()

  if (insertError || !runData) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "save_failed",
      }),
    )
  }

  try {
    await replaceRunDefinition({
      runId: runData.id,
      definition: parsedInput.data.definition,
      campIds: parsedInput.data.campIds,
    })
  } catch {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "save_failed",
      }),
    )
  }

  const { data: crewMemberships, error: membershipsError } = await supabase
    .from("team_memberships")
    .select("profile_id")
    .eq("team_id", parsedInput.data.teamId)
    .eq("role", "crew")
    .eq("is_active", true)

  if (membershipsError) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        tab: "created",
        error: "save_failed",
      }),
    )
  }

  const profileIds = Array.from(
    new Set((crewMemberships ?? []).map((membership) => membership.profile_id)),
  )

  if (profileIds.length > 0) {
    const { error: insertRespondentsError } = await supabase
      .from("assessment_run_respondents")
      .insert(
        profileIds.map((profileId) => ({
          assessment_run_id: runData.id,
          profile_id: profileId,
          responded_at: null,
        })),
      )

    if (insertRespondentsError) {
      redirect(
        buildRedirect({
          returnPath,
          scope,
          tab: "created",
          error: "save_failed",
        }),
      )
    }
  }

  revalidateAssessmentPaths({
    runId: runData.id,
    teamVenueId: parsedInput.data.teamVenueId,
  })
  redirect(
    buildRedirect({
      returnPath,
      scope,
      tab: "created",
      status: "run_published",
    }),
  )
}

export async function closeAssessmentRunAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const returnPath = getFormString(formData, "returnPath")
  const parsedInput = assessmentRunLifecycleInputSchema.safeParse({
    runId: getFormString(formData, "runId"),
    teamId: scope.scopeTeamId,
    teamVenueId: getFormString(formData, "teamVenueId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "invalid_input",
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: parsedInput.data.teamId,
    })
  ) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const runInScope = await ensureRunBelongsToScope({
    runId: parsedInput.data.runId,
    teamId: parsedInput.data.teamId,
    teamVenueId: parsedInput.data.teamVenueId,
  })

  if (!runInScope) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: closeError } = await supabase
    .from("assessment_runs")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", parsedInput.data.runId)
    .eq("team_id", parsedInput.data.teamId)
    .eq("team_venue_id", parsedInput.data.teamVenueId)

  if (closeError) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "close_failed",
      }),
    )
  }

  revalidateAssessmentPaths({
    runId: parsedInput.data.runId,
    teamVenueId: parsedInput.data.teamVenueId,
  })
  redirect(
    buildRedirect({
      returnPath,
      scope,
      status: "run_closed",
    }),
  )
}

export async function deleteAssessmentRunAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const returnPath = getFormString(formData, "returnPath")
  const parsedInput = assessmentRunLifecycleInputSchema.safeParse({
    runId: getFormString(formData, "runId"),
    teamId: scope.scopeTeamId,
    teamVenueId: getFormString(formData, "teamVenueId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "invalid_input",
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.scopeOrgId,
      teamId: parsedInput.data.teamId,
    })
  ) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const runInScope = await ensureRunBelongsToScope({
    runId: parsedInput.data.runId,
    teamId: parsedInput.data.teamId,
    teamVenueId: parsedInput.data.teamVenueId,
  })

  if (!runInScope) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error: deleteError } = await supabase
    .from("assessment_runs")
    .delete()
    .eq("id", parsedInput.data.runId)
    .eq("team_id", parsedInput.data.teamId)
    .eq("team_venue_id", parsedInput.data.teamVenueId)

  if (deleteError) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "delete_failed",
      }),
    )
  }

  revalidateAssessmentPaths({
    teamVenueId: parsedInput.data.teamVenueId,
  })
  redirect(
    buildTeamAssessmentsRedirectPath({
      scopeOrgId: scope.scopeOrgId,
      scopeTeamId: scope.scopeTeamId,
      status: "run_deleted",
    }),
  )
}

export async function submitAssessmentAnswersAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const returnPath = getFormString(formData, "returnPath")
  const answersPayload = parseAnswersPayload(getFormString(formData, "answersJson"))
  const parsedInput = submitAssessmentAnswersInputSchema.safeParse({
    runId: getFormString(formData, "runId"),
    teamId: scope.scopeTeamId,
    teamVenueId: getFormString(formData, "teamVenueId"),
    answers: answersPayload,
  })

  if (!parsedInput.success || !scope.scopeTeamId) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "invalid_input",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: runRow, error: runError } = await supabase
    .from("assessment_runs")
    .select("id,team_id,status")
    .eq("id", parsedInput.data.runId)
    .eq("team_id", parsedInput.data.teamId)
    .eq("team_venue_id", parsedInput.data.teamVenueId)
    .maybeSingle()

  if (runError || !runRow || runRow.status !== "published") {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const [{ data: crewMembership, error: crewMembershipError }, { data: runRespondent, error: runRespondentError }] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", parsedInput.data.teamId)
      .eq("profile_id", context.user.id)
      .eq("role", "crew")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("assessment_run_respondents")
      .select("id")
      .eq("assessment_run_id", parsedInput.data.runId)
      .eq("profile_id", context.user.id)
      .maybeSingle(),
  ])

  if (crewMembershipError || !crewMembership || runRespondentError || !runRespondent) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "forbidden",
      }),
    )
  }

  const answersToInsert = parsedInput.data.answers.flatMap((entry) => {
    if (entry.scaleOptionId === null) {
      return []
    }

    return [
      {
        assessment_run_id: parsedInput.data.runId,
        assessment_run_question_id: entry.questionId,
        respondent_profile_id: context.user.id,
        assessment_run_scale_option_id: entry.scaleOptionId,
      },
    ]
  })

  const { error: deleteAnswersError } = await supabase
    .from("assessment_run_answers")
    .delete()
    .eq("assessment_run_id", parsedInput.data.runId)
    .eq("respondent_profile_id", context.user.id)

  if (deleteAnswersError) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "answer_failed",
      }),
    )
  }

  if (answersToInsert.length > 0) {
    const { error: insertAnswersError } = await supabase
      .from("assessment_run_answers")
      .insert(answersToInsert)

    if (insertAnswersError) {
      redirect(
        buildRedirect({
          returnPath,
          scope,
          error: "answer_failed",
        }),
      )
    }
  }

  const { error: updateRespondentError } = await supabase
    .from("assessment_run_respondents")
    .update({
      responded_at: answersToInsert.length > 0 ? new Date().toISOString() : null,
    })
    .eq("assessment_run_id", parsedInput.data.runId)
    .eq("profile_id", context.user.id)

  if (updateRespondentError) {
    redirect(
      buildRedirect({
        returnPath,
        scope,
        error: "answer_failed",
      }),
    )
  }

  revalidateAssessmentPaths({
    runId: parsedInput.data.runId,
    teamVenueId: parsedInput.data.teamVenueId,
  })
  redirect(
    buildRedirect({
      returnPath,
      scope,
      status: "answers_saved",
    }),
  )
}
