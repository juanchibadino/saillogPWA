"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { saveAssessmentTemplateAction } from "@/features/assessments/actions"
import {
  buildDefaultCategory,
  buildDefaultDefinition,
  buildDefaultMode,
  buildDefaultQuestion,
  getTemplateDefinition,
  serializeDefinition,
  validateDefinition,
  type AssessmentCategoryDraft,
  type AssessmentDefinitionDraft,
  type AssessmentModeDraft,
  type AssessmentQuestionDraft,
} from "@/features/assessments/definition"
import type { TeamAssessmentTemplate } from "@/features/assessments/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { GradientCard } from "@/components/shared/gradient-card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function SaveTemplateButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Saving template..." : "Save template"}
    </Button>
  )
}

function TemplateEditorFieldset({
  children,
}: {
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-70">
      {children}
    </fieldset>
  )
}

function TemplateCancelButton({
  href,
  onClick,
}: {
  href: string
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const { pending } = useFormStatus()

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    if (pending) {
      event.preventDefault()
      return
    }

    onClick(event)
  }

  return (
    <Button
      variant="outline"
      nativeButton={false}
      aria-disabled={pending}
      className={pending ? "pointer-events-none opacity-50" : undefined}
      render={
        <Link
          href={href}
          onClick={handleClick}
          tabIndex={pending ? -1 : undefined}
        />
      }
    >
      Cancel
    </Button>
  )
}

function countCategoryItems(category: AssessmentCategoryDraft): number {
  if (category.shape === "mode") {
    return category.modes.reduce((count, mode) => count + mode.questions.length, 0)
  }

  return category.questions.length
}

function getCategoryModeCount(category: AssessmentCategoryDraft): number {
  return category.shape === "mode" ? category.modes.length : 0
}

function getCategoryAccordionValue(categoryIndex: number): string {
  return `assessment-template-category-${categoryIndex}`
}

function getModeAccordionValue(categoryIndex: number, modeIndex: number): string {
  return `${getCategoryAccordionValue(categoryIndex)}-mode-${modeIndex}`
}

function getModeItemCount(mode: AssessmentModeDraft): number {
  return mode.questions.length
}

function shouldHandleTemplateNavigation(
  event: React.MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

function QuestionRow({
  idPrefix,
  onRemove,
  onUpdate,
  question,
  questionIndex,
  removable,
}: {
  idPrefix: string
  onRemove: () => void
  onUpdate: (updates: Partial<AssessmentQuestionDraft>) => void
  question: AssessmentQuestionDraft
  questionIndex: number
  removable: boolean
}) {
  const promptId = `${idPrefix}-question-${questionIndex}`
  const requiredId = `${idPrefix}-required-${questionIndex}`

  return (
    <div className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor={promptId}>Item {questionIndex + 1}</Label>
        <Input
          id={promptId}
          value={question.prompt}
          onChange={(event) => onUpdate({ prompt: event.target.value })}
          placeholder="Assessment item"
          className="h-11 md:h-8"
        />
      </div>
      <label
        htmlFor={requiredId}
        className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm md:min-h-8"
      >
        <Checkbox
          id={requiredId}
          checked={question.isRequired}
          onCheckedChange={(checked) => onUpdate({ isRequired: checked === true })}
        />
        Required
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!removable}
        className="h-11 w-11 md:h-8 md:w-8"
        aria-label={`Remove item ${questionIndex + 1}`}
        onClick={onRemove}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  )
}

export function AssessmentTemplateEditor({
  cancelHref,
  onCancel,
  scope,
  template,
}: {
  cancelHref: string
  onCancel?: (href: string) => void
  scope: NavigationScope
  template?: TeamAssessmentTemplate
}) {
  const [name, setName] = React.useState(template?.name ?? "")
  const [definition, setDefinition] = React.useState<AssessmentDefinitionDraft>(() =>
    template ? getTemplateDefinition(template) : buildDefaultDefinition(),
  )
  const [formError, setFormError] = React.useState<string | null>(null)
  const [openCategoryValue, setOpenCategoryValue] = React.useState<string>("")

  React.useEffect(() => {
    setName(template?.name ?? "")
    setDefinition(template ? getTemplateDefinition(template) : buildDefaultDefinition())
    setFormError(null)
    setOpenCategoryValue("")
  }, [template])

  const definitionJson = React.useMemo(() => serializeDefinition(definition), [definition])
  const categoryAccordionValue =
    definition.categories.length > 0 &&
    definition.categories.some(
      (_, categoryIndex) => getCategoryAccordionValue(categoryIndex) === openCategoryValue,
    )
      ? [openCategoryValue]
      : []

  function updateCategoryName(categoryIndex: number, nextName: string): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              name: nextName,
            }
          : category,
      ),
    }))
  }

  function setCategoryShape(categoryIndex: number, shape: "direct" | "mode"): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return category
        }

        if (shape === "mode") {
          return {
            ...category,
            shape,
            modes: category.modes.length > 0 ? category.modes : [buildDefaultMode()],
          }
        }

        return {
          ...category,
          shape,
          questions:
            category.questions.length > 0 ? category.questions : [buildDefaultQuestion()],
        }
      }),
    }))
  }

  function addCategory(): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: [...currentValue.categories, buildDefaultCategory()],
    }))
  }

  function removeCategory(categoryIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.filter(
        (_, currentCategoryIndex) => currentCategoryIndex !== categoryIndex,
      ),
    }))
  }

  function updateDirectQuestion(
    categoryIndex: number,
    questionIndex: number,
    updates: Partial<AssessmentQuestionDraft>,
  ): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category
        }

        return {
          ...category,
          questions: category.questions.map((question, currentQuestionIndex) =>
            currentQuestionIndex === questionIndex
              ? {
                  ...question,
                  ...updates,
                }
              : question,
          ),
        }
      }),
    }))
  }

  function addDirectQuestion(categoryIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category
        }

        return {
          ...category,
          questions: [...category.questions, buildDefaultQuestion()],
        }
      }),
    }))
  }

  function removeDirectQuestion(categoryIndex: number, questionIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category
        }

        return {
          ...category,
          questions: category.questions.filter(
            (_, currentQuestionIndex) => currentQuestionIndex !== questionIndex,
          ),
        }
      }),
    }))
  }

  function addMode(categoryIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        const sourceQuestions = category.modes[0]?.questions ?? []
        const replicatedQuestions =
          sourceQuestions.length > 0
            ? sourceQuestions.map((question) => ({
                prompt: question.prompt,
                isRequired: question.isRequired,
              }))
            : [buildDefaultQuestion()]

        return {
          ...category,
          modes: [
            ...category.modes,
            {
              name: "",
              questions: replicatedQuestions,
            },
          ],
        }
      }),
    }))
  }

  function removeMode(categoryIndex: number, modeIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        return {
          ...category,
          modes: category.modes.filter((_, currentModeIndex) => currentModeIndex !== modeIndex),
        }
      }),
    }))
  }

  function updateModeName(categoryIndex: number, modeIndex: number, nextName: string): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) =>
            currentModeIndex === modeIndex
              ? {
                  ...mode,
                  name: nextName,
                }
              : mode,
          ),
        }
      }),
    }))
  }

  function updateModeQuestion(
    categoryIndex: number,
    modeIndex: number,
    questionIndex: number,
    updates: Partial<AssessmentQuestionDraft>,
  ): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) => {
            if (currentModeIndex !== modeIndex) {
              return mode
            }

            return {
              ...mode,
              questions: mode.questions.map((question, currentQuestionIndex) =>
                currentQuestionIndex === questionIndex
                  ? {
                      ...question,
                      ...updates,
                    }
                  : question,
              ),
            }
          }),
        }
      }),
    }))
  }

  function addModeQuestion(categoryIndex: number, modeIndex: number): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) =>
            currentModeIndex === modeIndex
              ? {
                  ...mode,
                  questions: [...mode.questions, buildDefaultQuestion()],
                }
              : mode,
          ),
        }
      }),
    }))
  }

  function removeModeQuestion(
    categoryIndex: number,
    modeIndex: number,
    questionIndex: number,
  ): void {
    setFormError(null)
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) => {
            if (currentModeIndex !== modeIndex) {
              return mode
            }

            return {
              ...mode,
              questions: mode.questions.filter(
                (_, currentQuestionIndex) => currentQuestionIndex !== questionIndex,
              ),
            }
          }),
        }
      }),
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    const nextError =
      name.trim().length === 0
        ? "Template name is required."
        : validateDefinition(definition)

    if (nextError) {
      event.preventDefault()
      setFormError(nextError)
    }
  }

  function handleCancelClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    if (!onCancel || !shouldHandleTemplateNavigation(event)) {
      return
    }

    event.preventDefault()
    onCancel(cancelHref)
  }

  const title = template ? "Edit template" : "New template"

  return (
    <GradientCard className="space-y-4 p-4 md:p-5">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Scale is fixed from 1 to 5 for all assessment templates.
        </p>
      </div>

      <form action={saveAssessmentTemplateAction} className="space-y-4" onSubmit={handleSubmit}>
        <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
        {scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="returnPath" value={cancelHref} />
        {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
        <input type="hidden" name="definitionJson" value={definitionJson} />

        <TemplateEditorFieldset>
          <div className="space-y-2">
            <Label htmlFor="assessment-template-name">Name</Label>
            <Input
              id="assessment-template-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setFormError(null)
              }}
              className="h-11 md:h-8"
            />
          </div>

          {formError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Accordion
            className="gap-3"
            value={categoryAccordionValue}
            onValueChange={(nextValue) => {
              setOpenCategoryValue(nextValue[0] ?? "")
            }}
          >
            {definition.categories.map((category, categoryIndex) => {
              const categoryIdPrefix = getCategoryAccordionValue(categoryIndex)
              const itemCount = countCategoryItems(category)
              const modeCount = getCategoryModeCount(category)
              const categoryTitle =
                category.name.trim().length > 0
                  ? category.name.trim()
                  : `Category ${categoryIndex + 1}`

              return (
                <AccordionItem
                  key={categoryIdPrefix}
                  value={categoryIdPrefix}
                  className="rounded-lg border"
                >
                  <AccordionTrigger
                    className="px-3 py-3 hover:no-underline"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {categoryTitle}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Category {categoryIndex + 1} -{" "}
                        {category.shape === "mode" ? `${modeCount} modes - ` : ""}
                        {itemCount} items
                      </span>
                    </span>
                  </AccordionTrigger>

                  <AccordionContent className="space-y-3 px-3 pb-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`${categoryIdPrefix}-name`}>
                          Category {categoryIndex + 1}
                        </Label>
                        <Input
                          id={`${categoryIdPrefix}-name`}
                          value={category.name}
                          onChange={(event) =>
                            updateCategoryName(categoryIndex, event.target.value)
                          }
                          className="h-11 md:h-8"
                        />
                      </div>
                      <div className="grid grid-cols-2 rounded-lg border p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={category.shape === "direct" ? "secondary" : "ghost"}
                          onClick={() => setCategoryShape(categoryIndex, "direct")}
                        >
                          Direct
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={category.shape === "mode" ? "secondary" : "ghost"}
                          onClick={() => setCategoryShape(categoryIndex, "mode")}
                        >
                          Modes
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 md:h-8 md:w-8"
                        disabled={definition.categories.length <= 1}
                        aria-label={`Remove category ${categoryIndex + 1}`}
                        onClick={() => removeCategory(categoryIndex)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>

                    {category.shape === "direct" ? (
                      <div className="space-y-2">
                        {category.questions.map((question, questionIndex) => (
                          <QuestionRow
                            key={`${categoryIdPrefix}-direct-question-${questionIndex}`}
                            idPrefix={`${categoryIdPrefix}-direct`}
                            question={question}
                            questionIndex={questionIndex}
                            removable={category.questions.length > 1}
                            onUpdate={(updates) =>
                              updateDirectQuestion(categoryIndex, questionIndex, updates)
                            }
                            onRemove={() => removeDirectQuestion(categoryIndex, questionIndex)}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addDirectQuestion(categoryIndex)}
                        >
                          <PlusIcon className="size-4" />
                          Add item
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Accordion className="gap-2">
                          {category.modes.map((mode, modeIndex) => {
                            const modeIdPrefix = getModeAccordionValue(
                              categoryIndex,
                              modeIndex,
                            )
                            const modeTitle =
                              mode.name.trim().length > 0
                                ? mode.name.trim()
                                : `Mode ${modeIndex + 1}`

                            return (
                              <AccordionItem
                                key={modeIdPrefix}
                                value={modeIdPrefix}
                                className="rounded-lg border"
                              >
                                <AccordionTrigger className="px-3 py-3 hover:no-underline">
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">
                                      {modeTitle}
                                    </span>
                                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                      Mode {modeIndex + 1} - {getModeItemCount(mode)} items
                                    </span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-3 px-3 pb-3">
                                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                    <div className="space-y-2">
                                      <Label htmlFor={`${modeIdPrefix}-name`}>
                                        Mode {modeIndex + 1}
                                      </Label>
                                      <Input
                                        id={`${modeIdPrefix}-name`}
                                        value={mode.name}
                                        onChange={(event) =>
                                          updateModeName(
                                            categoryIndex,
                                            modeIndex,
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 md:h-8"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-11 w-11 md:h-8 md:w-8"
                                      disabled={category.modes.length <= 1}
                                      aria-label={`Remove mode ${modeIndex + 1}`}
                                      onClick={() => removeMode(categoryIndex, modeIndex)}
                                    >
                                      <Trash2Icon className="size-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-2">
                                    {mode.questions.map((question, questionIndex) => (
                                      <QuestionRow
                                        key={`${modeIdPrefix}-question-${questionIndex}`}
                                        idPrefix={modeIdPrefix}
                                        question={question}
                                        questionIndex={questionIndex}
                                        removable={mode.questions.length > 1}
                                        onUpdate={(updates) =>
                                          updateModeQuestion(
                                            categoryIndex,
                                            modeIndex,
                                            questionIndex,
                                            updates,
                                          )
                                        }
                                        onRemove={() =>
                                          removeModeQuestion(
                                            categoryIndex,
                                            modeIndex,
                                            questionIndex,
                                          )
                                        }
                                      />
                                    ))}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addModeQuestion(categoryIndex, modeIndex)}
                                    >
                                      <PlusIcon className="size-4" />
                                      Add item
                                    </Button>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )
                          })}
                        </Accordion>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addMode(categoryIndex)}
                        >
                          <PlusIcon className="size-4" />
                          Add mode
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          <Button type="button" variant="outline" size="sm" onClick={addCategory}>
            <PlusIcon className="size-4" />
            Add category
          </Button>
        </TemplateEditorFieldset>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 md:flex-row md:justify-end">
          <TemplateCancelButton href={cancelHref} onClick={handleCancelClick} />
          <SaveTemplateButton />
        </div>
      </form>
    </GradientCard>
  )
}
