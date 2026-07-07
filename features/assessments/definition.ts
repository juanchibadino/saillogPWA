import type { TeamAssessmentTemplate } from "@/features/assessments/data"

export type AssessmentQuestionDraft = {
  prompt: string
  isRequired: boolean
}

export type AssessmentModeDraft = {
  name: string
  questions: AssessmentQuestionDraft[]
}

export type AssessmentCategoryDraft = {
  name: string
  shape: "direct" | "mode"
  questions: AssessmentQuestionDraft[]
  modes: AssessmentModeDraft[]
}

export type AssessmentDefinitionDraft = {
  scaleOptions: Array<{ label: string }>
  categories: AssessmentCategoryDraft[]
}

export type SerializedAssessmentCategory =
  | {
      name: string
      questions: AssessmentQuestionDraft[]
    }
  | {
      name: string
      modes: Array<{
        name: string
        questions: AssessmentQuestionDraft[]
      }>
    }

export type SerializedAssessmentDefinition = {
  scaleOptions: Array<{ label: string }>
  categories: SerializedAssessmentCategory[]
}

export function buildFixedScaleOptions(): Array<{ label: string }> {
  return [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }, { label: "5" }]
}

export function buildDefaultQuestion(): AssessmentQuestionDraft {
  return {
    prompt: "",
    isRequired: false,
  }
}

export function buildDefaultMode(): AssessmentModeDraft {
  return {
    name: "",
    questions: [buildDefaultQuestion()],
  }
}

export function buildDefaultCategory(): AssessmentCategoryDraft {
  return {
    name: "General",
    shape: "direct",
    questions: [buildDefaultQuestion()],
    modes: [],
  }
}

export function buildDefaultDefinition(): AssessmentDefinitionDraft {
  return {
    scaleOptions: buildFixedScaleOptions(),
    categories: [buildDefaultCategory()],
  }
}

export function normalizeDefinition(
  definition: AssessmentDefinitionDraft,
): SerializedAssessmentDefinition {
  return {
    scaleOptions: buildFixedScaleOptions(),
    categories: definition.categories.map((category) => {
      if (category.shape === "mode") {
        return {
          name: category.name.trim(),
          modes: category.modes.map((mode) => ({
            name: mode.name.trim(),
            questions: mode.questions.map((question) => ({
              prompt: question.prompt.trim(),
              isRequired: question.isRequired,
            })),
          })),
        }
      }

      return {
        name: category.name.trim(),
        questions: category.questions.map((question) => ({
          prompt: question.prompt.trim(),
          isRequired: question.isRequired,
        })),
      }
    }),
  }
}

export function serializeDefinition(definition: AssessmentDefinitionDraft): string {
  return JSON.stringify(normalizeDefinition(definition))
}

export function getTemplateDefinition(
  template: TeamAssessmentTemplate,
): AssessmentDefinitionDraft {
  return {
    scaleOptions: buildFixedScaleOptions(),
    categories: template.categories.map((category) => {
      if ((category.modes?.length ?? 0) > 0) {
        return {
          name: category.name,
          shape: "mode",
          questions: [],
          modes: (category.modes ?? []).map((mode) => ({
            name: mode.name,
            questions: mode.questions.map((question) => ({
              prompt: question.prompt,
              isRequired: question.isRequired,
            })),
          })),
        }
      }

      return {
        name: category.name,
        shape: "direct",
        questions: category.questions.map((question) => ({
          prompt: question.prompt,
          isRequired: question.isRequired,
        })),
        modes: [],
      }
    }),
  }
}

export function validateDefinition(definition: AssessmentDefinitionDraft): string | null {
  if (definition.categories.length === 0) {
    return "Add at least one category."
  }

  for (const [categoryIndex, category] of definition.categories.entries()) {
    const categoryName = category.name.trim()

    if (categoryName.length === 0) {
      return `Category ${categoryIndex + 1} needs a name.`
    }

    if (category.shape === "mode") {
      if (category.modes.length === 0) {
        return `Category "${categoryName}" needs at least one mode.`
      }

      for (const [modeIndex, mode] of category.modes.entries()) {
        const modeName = mode.name.trim()

        if (modeName.length === 0) {
          return `Mode ${modeIndex + 1} in "${categoryName}" needs a name.`
        }

        if (mode.questions.length === 0) {
          return `Mode "${modeName}" in "${categoryName}" needs at least one item.`
        }

        for (const [questionIndex, question] of mode.questions.entries()) {
          if (question.prompt.trim().length === 0) {
            return `Item ${questionIndex + 1} in mode "${modeName}" cannot be empty.`
          }
        }
      }

      continue
    }

    if (category.questions.length === 0) {
      return `Category "${categoryName}" needs at least one assessment item.`
    }

    for (const [questionIndex, question] of category.questions.entries()) {
      if (question.prompt.trim().length === 0) {
        return `Item ${questionIndex + 1} in "${categoryName}" cannot be empty.`
      }
    }
  }

  return null
}
