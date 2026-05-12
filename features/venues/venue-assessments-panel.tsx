"use client";

import * as React from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  deleteAssessmentRunAction,
  closeAssessmentRunAction,
  submitAssessmentAnswersAction,
  upsertAssessmentRunAction,
  upsertAssessmentTemplateAction,
} from "@/features/venues/assessment-actions";
import type {
  VenueAssessmentCategory,
  VenueAssessmentQuestion,
  VenueAssessmentRun,
  VenueAssessmentTemplate,
  VenueDetailCampItem,
} from "@/features/venues/detail-types";
import type { NavigationScope } from "@/lib/navigation/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AssessmentQuestionDraft = {
  prompt: string;
  isRequired: boolean;
};

type AssessmentModeDraft = {
  name: string;
  questions: AssessmentQuestionDraft[];
};

type AssessmentCategoryDraft = {
  name: string;
  shape: "direct" | "mode";
  questions: AssessmentQuestionDraft[];
  modes: AssessmentModeDraft[];
};

type AssessmentDefinitionDraft = {
  scaleOptions: Array<{ label: string }>;
  categories: AssessmentCategoryDraft[];
};

type SerializedAssessmentCategory =
  | {
      name: string;
      questions: AssessmentQuestionDraft[];
    }
  | {
      name: string;
      modes: Array<{
        name: string;
        questions: AssessmentQuestionDraft[];
      }>;
    };

type SerializedAssessmentDefinition = {
  scaleOptions: Array<{ label: string }>;
  categories: SerializedAssessmentCategory[];
};

function buildFixedScaleOptions(): Array<{ label: string }> {
  return [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }, { label: "5" }];
}

function buildDefaultQuestion(): AssessmentQuestionDraft {
  return {
    prompt: "",
    isRequired: false,
  };
}

function buildDefaultMode(): AssessmentModeDraft {
  return {
    name: "",
    questions: [buildDefaultQuestion()],
  };
}

function buildDefaultCategory(): AssessmentCategoryDraft {
  return {
    name: "General",
    shape: "direct",
    questions: [buildDefaultQuestion()],
    modes: [],
  };
}

function buildDefaultDefinition(): AssessmentDefinitionDraft {
  return {
    scaleOptions: buildFixedScaleOptions(),
    categories: [buildDefaultCategory()],
  };
}

function categoryHasModes(category: VenueAssessmentCategory): boolean {
  return Array.isArray(category.modes) && category.modes.length > 0;
}

function normalizeDefinition(definition: AssessmentDefinitionDraft): SerializedAssessmentDefinition {
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
        };
      }

      return {
        name: category.name.trim(),
        questions: category.questions.map((question) => ({
          prompt: question.prompt.trim(),
          isRequired: question.isRequired,
        })),
      };
    }),
  };
}

function serializeDefinition(definition: AssessmentDefinitionDraft): string {
  return JSON.stringify(normalizeDefinition(definition));
}

function buildCategoryAccordionValue(categoryIndex: number): string {
  return `category-${categoryIndex}`;
}

function buildTemplateAccordionValue(templateId: string): string {
  return `template-${templateId}`;
}

function RunTitleWithCamps(input: { camps: VenueAssessmentRun["camps"] }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>Assessment for</span>
      {input.camps.length > 0 ? (
        input.camps.map((camp) => (
          <Badge key={camp.id} variant="secondary">
            {camp.name}
          </Badge>
        ))
      ) : (
        <Badge variant="outline">No camp linked</Badge>
      )}
    </span>
  );
}

function buildInitialSelectionByQuestionId(
  answers: VenueAssessmentRun["myAnswers"],
): Record<string, string> {
  const draft: Record<string, string> = {};

  for (const answer of answers) {
    draft[answer.questionId] = answer.scaleOptionId;
  }

  return draft;
}

function buildRunAnswerPayloadRows(input: {
  categories: VenueAssessmentCategory[];
  selectionByQuestionId: Record<string, string>;
}): Array<{ questionId: string; scaleOptionId: string | null }> {
  const rows: Array<{ questionId: string; scaleOptionId: string | null }> = [];

  for (const category of input.categories) {
    if (categoryHasModes(category)) {
      for (const mode of category.modes ?? []) {
        for (const question of mode.questions) {
          rows.push({
            questionId: question.id,
            scaleOptionId: input.selectionByQuestionId[question.id] ?? null,
          });
        }
      }

      continue;
    }

    for (const question of category.questions) {
      rows.push({
        questionId: question.id,
        scaleOptionId: input.selectionByQuestionId[question.id] ?? null,
      });
    }
  }

  return rows;
}

function buildInitialModeByCategoryId(
  categories: VenueAssessmentCategory[],
): Record<string, string> {
  const modeByCategoryId: Record<string, string> = {};

  for (const category of categories) {
    if (!categoryHasModes(category)) {
      continue;
    }

    const firstModeId = category.modes?.[0]?.id;

    if (firstModeId) {
      modeByCategoryId[category.id] = firstModeId;
    }
  }

  return modeByCategoryId;
}

function validateDefinition(definition: AssessmentDefinitionDraft): string | null {
  if (definition.categories.length === 0) {
    return "Add at least one category.";
  }

  for (const [categoryIndex, category] of definition.categories.entries()) {
    const categoryName = category.name.trim();

    if (categoryName.length === 0) {
      return `Category ${categoryIndex + 1} needs a name.`;
    }

    if (category.shape === "mode") {
      if (category.modes.length === 0) {
        return `Category \"${categoryName}\" needs at least one mode.`;
      }

      for (const [modeIndex, mode] of category.modes.entries()) {
        const modeName = mode.name.trim();

        if (modeName.length === 0) {
          return `Mode ${modeIndex + 1} in \"${categoryName}\" needs a name.`;
        }

        if (mode.questions.length === 0) {
          return `Mode \"${modeName}\" in \"${categoryName}\" needs at least one item.`;
        }

        for (const [questionIndex, question] of mode.questions.entries()) {
          if (question.prompt.trim().length === 0) {
            return `Item ${questionIndex + 1} in mode \"${modeName}\" cannot be empty.`;
          }
        }
      }

      continue;
    }

    if (category.questions.length === 0) {
      return `Category \"${categoryName}\" needs at least one assessment item.`;
    }

    for (const [questionIndex, question] of category.questions.entries()) {
      if (question.prompt.trim().length === 0) {
        return `Item ${questionIndex + 1} in \"${categoryName}\" cannot be empty.`;
      }
    }
  }

  return null;
}

function getTemplateDefinition(template: VenueAssessmentTemplate): AssessmentDefinitionDraft {
  return {
    scaleOptions: buildFixedScaleOptions(),
    categories: template.categories.map((category) => {
      if (categoryHasModes(category)) {
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
        };
      }

      return {
        name: category.name,
        shape: "direct",
        questions: category.questions.map((question) => ({
          prompt: question.prompt,
          isRequired: question.isRequired,
        })),
        modes: [],
      };
    }),
  };
}

function getStatusBadgeVariant(status: VenueAssessmentRun["status"]):
  | "secondary"
  | "default"
  | "outline" {
  if (status === "published") {
    return "default";
  }

  if (status === "closed") {
    return "secondary";
  }

  return "outline";
}

function AssessmentScopeFields(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeVenueId" value={input.teamVenueId} />
      <input type="hidden" name="scopeYear" value={String(input.selectedYear)} />
    </>
  );
}

function TemplateFormPendingFieldset(input: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <fieldset
      disabled={pending}
      className="space-y-4 border-0 p-0 m-0 min-w-0"
      aria-busy={pending}
    >
      {input.children}
    </fieldset>
  );
}

function TemplateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving template...
        </>
      ) : (
        "Save template"
      )}
    </Button>
  );
}

function RunCreateFormPendingFieldset(input: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <fieldset
      disabled={pending}
      className="space-y-4 border-0 p-0 m-0 min-w-0"
      aria-busy={pending}
    >
      {input.children}
    </fieldset>
  );
}

function RunCreateSubmitButton(input: { disabledByValidation: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || input.disabledByValidation}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving run...
        </>
      ) : (
        "Save run"
      )}
    </Button>
  );
}

function RunDeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Deleting...
        </>
      ) : (
        "Delete run"
      )}
    </Button>
  );
}

function CloseRunSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Closing...
        </>
      ) : (
        "Close"
      )}
    </Button>
  );
}

function RunAnswerFormPendingFieldset(input: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <div
      className={`m-0 min-w-0 ${input.className ?? ""} ${pending ? "pointer-events-none" : ""}`}
      aria-busy={pending}
      aria-disabled={pending}
    >
      {input.children}
    </div>
  );
}

function RunAnswerSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving answers...
        </>
      ) : (
        "Save answers"
      )}
    </Button>
  );
}

function TemplateEditorDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  template?: VenueAssessmentTemplate;
  triggerLabel: string;
}) {
  const initialDefinition = React.useMemo(
    () => (input.template ? getTemplateDefinition(input.template) : buildDefaultDefinition()),
    [input.template],
  );

  const [definition, setDefinition] = React.useState<AssessmentDefinitionDraft>(initialDefinition);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [openCategoryValues, setOpenCategoryValues] = React.useState<string[]>([
    buildCategoryAccordionValue(0),
  ]);

  const definitionJson = React.useMemo(() => serializeDefinition(definition), [definition]);

  function updateCategoryName(categoryIndex: number, name: string): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              name,
            }
          : category,
      ),
    }));
  }

  function setCategoryShape(categoryIndex: number, shape: "direct" | "mode"): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return category;
        }

        if (shape === "mode") {
          return {
            ...category,
            shape,
            modes: category.modes.length > 0 ? category.modes : [buildDefaultMode()],
          };
        }

        return {
          ...category,
          shape,
          questions: category.questions.length > 0 ? category.questions : [buildDefaultQuestion()],
        };
      }),
    }));
  }

  function addCategory(): void {
    setFormError(null);
    const nextCategoryIndex = definition.categories.length;
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: [...currentValue.categories, buildDefaultCategory()],
    }));
    setOpenCategoryValues([buildCategoryAccordionValue(nextCategoryIndex)]);
  }

  function removeCategory(categoryIndex: number): void {
    setFormError(null);
    const remainingCategoryCount = Math.max(1, definition.categories.length - 1);
    const nextOpenCategoryIndex = Math.min(categoryIndex, remainingCategoryCount - 1);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.filter(
        (_, currentCategoryIndex) => currentCategoryIndex !== categoryIndex,
      ),
    }));
    setOpenCategoryValues([buildCategoryAccordionValue(nextOpenCategoryIndex)]);
  }

  function updateDirectQuestion(
    categoryIndex: number,
    questionIndex: number,
    updates: Partial<AssessmentQuestionDraft>,
  ): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category;
        }

        return {
          ...category,
          questions: category.questions.map((question, currentQuestionIndex) => {
            if (currentQuestionIndex !== questionIndex) {
              return question;
            }

            return {
              ...question,
              ...updates,
            };
          }),
        };
      }),
    }));
  }

  function addDirectQuestion(categoryIndex: number): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category;
        }

        return {
          ...category,
          questions: [...category.questions, buildDefaultQuestion()],
        };
      }),
    }));
  }

  function removeDirectQuestion(categoryIndex: number, questionIndex: number): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "direct") {
          return category;
        }

        return {
          ...category,
          questions: category.questions.filter(
            (_, currentQuestionIndex) => currentQuestionIndex !== questionIndex,
          ),
        };
      }),
    }));
  }

  function addMode(categoryIndex: number): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
        }

        const sourceQuestions = category.modes[0]?.questions ?? [];
        const replicatedQuestions =
          sourceQuestions.length > 0
            ? sourceQuestions.map((question) => ({
                prompt: question.prompt,
                isRequired: question.isRequired,
              }))
            : [buildDefaultQuestion()];

        return {
          ...category,
          modes: [
            ...category.modes,
            {
              name: "",
              questions: replicatedQuestions,
            },
          ],
        };
      }),
    }));
  }

  function removeMode(categoryIndex: number, modeIndex: number): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
        }

        return {
          ...category,
          modes: category.modes.filter((_, currentModeIndex) => currentModeIndex !== modeIndex),
        };
      }),
    }));
  }

  function updateModeName(categoryIndex: number, modeIndex: number, name: string): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) =>
            currentModeIndex === modeIndex
              ? {
                  ...mode,
                  name,
                }
              : mode,
          ),
        };
      }),
    }));
  }

  function updateModeQuestion(
    categoryIndex: number,
    modeIndex: number,
    questionIndex: number,
    updates: Partial<AssessmentQuestionDraft>,
  ): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) => {
            if (currentModeIndex !== modeIndex) {
              return mode;
            }

            return {
              ...mode,
              questions: mode.questions.map((question, currentQuestionIndex) => {
                if (currentQuestionIndex !== questionIndex) {
                  return question;
                }

                return {
                  ...question,
                  ...updates,
                };
              }),
            };
          }),
        };
      }),
    }));
  }

  function addModeQuestion(categoryIndex: number, modeIndex: number): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
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
        };
      }),
    }));
  }

  function removeModeQuestion(
    categoryIndex: number,
    modeIndex: number,
    questionIndex: number,
  ): void {
    setFormError(null);
    setDefinition((currentValue) => ({
      ...currentValue,
      categories: currentValue.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex || category.shape !== "mode") {
          return category;
        }

        return {
          ...category,
          modes: category.modes.map((mode, currentModeIndex) => {
            if (currentModeIndex !== modeIndex) {
              return mode;
            }

            return {
              ...mode,
              questions: mode.questions.filter(
                (_, currentQuestionIndex) => currentQuestionIndex !== questionIndex,
              ),
            };
          }),
        };
      }),
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    const validationError = validateDefinition(definition);

    if (validationError) {
      event.preventDefault();
      setFormError(validationError);
      return;
    }

    setFormError(null);
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {input.triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {input.template ? "Edit assessment template" : "Create assessment template"}
          </DialogTitle>
          <DialogDescription>
            Add categories and assessment items. Scale is fixed from 1 to 5.
          </DialogDescription>
        </DialogHeader>

        <form action={upsertAssessmentTemplateAction} className="space-y-4" onSubmit={handleSubmit}>
          <AssessmentScopeFields
            scope={input.scope}
            teamVenueId={input.teamVenueId}
            selectedYear={input.selectedYear}
          />
          {input.template ? <input type="hidden" name="templateId" value={input.template.id} /> : null}
          <input type="hidden" name="description" value={input.template?.description ?? ""} />
          <input type="hidden" name="definitionJson" value={definitionJson} />

          <TemplateFormPendingFieldset>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`template-name-${input.template?.id ?? "new"}`}>Name</Label>
                  <Input
                    id={`template-name-${input.template?.id ?? "new"}`}
                    name="name"
                    defaultValue={input.template?.name ?? ""}
                    required
                  />
                </div>
              </div>

              <section className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">Categories</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                    Add category
                  </Button>
                </div>

                <Accordion
                  value={openCategoryValues}
                  onValueChange={(values) =>
                    setOpenCategoryValues(values.length > 0 ? [String(values[0])] : [])
                  }
                  className="space-y-3"
                >
                  {definition.categories.map((category, categoryIndex) => (
                    <AccordionItem
                      key={`category-${categoryIndex}`}
                      value={buildCategoryAccordionValue(categoryIndex)}
                      className="rounded-md border px-3"
                    >
                      <AccordionTrigger className="py-3 text-sm font-semibold no-underline hover:no-underline">
                        {category.name.trim().length > 0
                          ? category.name
                          : `Category ${categoryIndex + 1}`}
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-3">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Input
                            value={category.name}
                            onChange={(event) => updateCategoryName(categoryIndex, event.target.value)}
                            placeholder={`Category ${categoryIndex + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeCategory(categoryIndex)}
                            disabled={definition.categories.length === 1}
                            aria-label={`Remove category ${categoryIndex + 1}`}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Category shape</span>
                        <div className="inline-flex rounded-md border p-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={category.shape === "direct" ? "secondary" : "ghost"}
                            onClick={() => setCategoryShape(categoryIndex, "direct")}
                          >
                            Direct items
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={category.shape === "mode" ? "secondary" : "ghost"}
                            onClick={() => setCategoryShape(categoryIndex, "mode")}
                          >
                            Mode-grouped items
                          </Button>
                        </div>
                      </div>

                      {category.shape === "direct" ? (
                        <>
                          <div className="space-y-2">
                            {category.questions.map((question, questionIndex) => (
                              <div
                                key={`question-${categoryIndex}-${questionIndex}`}
                                className="flex items-center gap-2"
                              >
                                <Input
                                  value={question.prompt}
                                  onChange={(event) =>
                                    updateDirectQuestion(categoryIndex, questionIndex, {
                                      prompt: event.target.value,
                                    })
                                  }
                                  placeholder="Add assessment item"
                                  className="min-w-0 flex-1"
                                />

                                <label className="inline-flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={question.isRequired}
                                    onChange={(event) =>
                                      updateDirectQuestion(categoryIndex, questionIndex, {
                                        isRequired: event.target.checked,
                                      })
                                    }
                                    className="size-4 rounded border-input"
                                    aria-label={`Mark item ${questionIndex + 1} as required`}
                                  />
                                </label>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeDirectQuestion(categoryIndex, questionIndex)}
                                  disabled={category.questions.length === 1}
                                  aria-label={`Remove item ${questionIndex + 1}`}
                                >
                                  <Trash2Icon />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addDirectQuestion(categoryIndex)}
                          >
                            Add assessment item
                          </Button>
                        </>
                      ) : (
                        <section className="space-y-3 rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-sm font-semibold">Modes</h5>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addMode(categoryIndex)}
                            >
                              Add mode
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {category.modes.map((mode, modeIndex) => (
                              <article
                                key={`mode-${categoryIndex}-${modeIndex}`}
                                className="space-y-3 rounded-md border p-3"
                              >
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                  <Input
                                    value={mode.name}
                                    onChange={(event) =>
                                      updateModeName(categoryIndex, modeIndex, event.target.value)
                                    }
                                    placeholder={`Mode ${modeIndex + 1}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeMode(categoryIndex, modeIndex)}
                                    disabled={category.modes.length === 1}
                                    aria-label={`Remove mode ${modeIndex + 1}`}
                                  >
                                    <Trash2Icon />
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  {mode.questions.map((question, questionIndex) => (
                                    <div
                                      key={`mode-question-${categoryIndex}-${modeIndex}-${questionIndex}`}
                                      className="flex items-center gap-2"
                                    >
                                      <Input
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateModeQuestion(categoryIndex, modeIndex, questionIndex, {
                                            prompt: event.target.value,
                                          })
                                        }
                                        placeholder="Add assessment item"
                                        className="min-w-0 flex-1"
                                      />

                                      <label className="inline-flex items-center justify-center">
                                        <input
                                          type="checkbox"
                                          checked={question.isRequired}
                                          onChange={(event) =>
                                            updateModeQuestion(categoryIndex, modeIndex, questionIndex, {
                                              isRequired: event.target.checked,
                                            })
                                          }
                                          className="size-4 rounded border-input"
                                          aria-label={`Mark mode item ${questionIndex + 1} as required`}
                                        />
                                      </label>

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                          removeModeQuestion(categoryIndex, modeIndex, questionIndex)
                                        }
                                        disabled={mode.questions.length === 1}
                                        aria-label={`Remove mode item ${questionIndex + 1}`}
                                      >
                                        <Trash2Icon />
                                      </Button>
                                    </div>
                                  ))}
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addModeQuestion(categoryIndex, modeIndex)}
                                >
                                  Add assessment item
                                </Button>
                              </article>
                            ))}
                          </div>
                        </section>
                      )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <DialogFooter>
              <TemplateSubmitButton />
            </DialogFooter>
          </TemplateFormPendingFieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunCreateDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  availableCamps: VenueDetailCampItem[];
  templates: VenueAssessmentTemplate[];
  triggerLabel: string;
  disabled?: boolean;
}) {
  const templatesById = React.useMemo(
    () => new Map(input.templates.map((template) => [template.id, template])),
    [input.templates],
  );

  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([]);

  const campOptions = React.useMemo(() => {
    const uniqueById = new Map<string, { id: string; name: string; dateRangeLabel: string }>();

    for (const camp of input.availableCamps) {
      uniqueById.set(camp.id, {
        id: camp.id,
        name: camp.name,
        dateRangeLabel: camp.dateRangeLabel,
      });
    }

    return [...uniqueById.values()];
  }, [input.availableCamps]);

  const definitionJson = React.useMemo(() => {
    if (!selectedTemplateId) {
      return "";
    }

    const template = templatesById.get(selectedTemplateId);

    if (!template) {
      return "";
    }

    return JSON.stringify(normalizeDefinition(getTemplateDefinition(template)));
  }, [selectedTemplateId, templatesById]);

  const selectedCampNames = React.useMemo(() => {
    if (selectedCampIds.length === 0) {
      return [];
    }

    const campNameById = new Map(campOptions.map((camp) => [camp.id, camp.name]));

    return selectedCampIds
      .map((campId) => campNameById.get(campId))
      .filter((campName): campName is string => Boolean(campName));
  }, [campOptions, selectedCampIds]);

  const runName =
    selectedCampNames.length > 0
      ? `Assessment for ${selectedCampNames.join(", ")}`
      : "Assessment for Camp(s)";

  const canSubmit = selectedTemplateId.length > 0 && selectedCampIds.length > 0;

  function toggleCamp(campId: string) {
    setSelectedCampIds((currentValue) => {
      if (currentValue.includes(campId)) {
        return currentValue.filter((value) => value !== campId);
      }

      return [...currentValue, campId];
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={input.disabled} />}>
        {input.triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create assessment run</DialogTitle>
          <DialogDescription>
            Select one template and the camps that should answer this assessment.
          </DialogDescription>
        </DialogHeader>

        <form action={upsertAssessmentRunAction} className="space-y-40">
          <AssessmentScopeFields
            scope={input.scope}
            teamVenueId={input.teamVenueId}
            selectedYear={input.selectedYear}
          />
          <input type="hidden" name="templateId" value={selectedTemplateId} />
          <input type="hidden" name="campIdsJson" value={JSON.stringify(selectedCampIds)} />
          <input type="hidden" name="name" value={runName} />
          <input type="hidden" name="description" value="" />
          <input type="hidden" name="definitionJson" value={definitionJson} />

          <RunCreateFormPendingFieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="run-template-new">Template</Label>
                <select
                  id="run-template-new"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select template</option>
                  {input.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Camps</Label>
                {campOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No camps available in this venue/year scope yet.
                  </p>
                ) : (
                  <div className="grid gap-2 rounded-md border p-3">
                    {campOptions.map((camp) => (
                      <label key={camp.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCampIds.includes(camp.id)}
                          onChange={() => toggleCamp(camp.id)}
                        />
                        <span>
                          <span className="font-medium">{camp.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {camp.dateRangeLabel}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <RunCreateSubmitButton disabledByValidation={!canSubmit} />
            </DialogFooter>
          </RunCreateFormPendingFieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunDeleteDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  runId: string;
  runName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="destructive" />}>
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete assessment run?</DialogTitle>
          <DialogDescription>
            This will permanently delete &quot;{input.runName}&quot; and all submitted answers
            linked to this run. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter showCloseButton>
          <form action={deleteAssessmentRunAction}>
            <AssessmentScopeFields
              scope={input.scope}
              teamVenueId={input.teamVenueId}
              selectedYear={input.selectedYear}
            />
            <input type="hidden" name="runId" value={input.runId} />
            <RunDeleteSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderRunQuestionField(input: {
  question: VenueAssessmentQuestion;
  selectionByQuestionId: Record<string, string>;
  setValue: (questionId: string, value: string) => void;
  scaleOptions: VenueAssessmentRun["scaleOptions"];
}) {
  return (
    <div key={input.question.id} className="space-y-2">
      <p className="text-sm font-medium">{input.question.prompt}</p>
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={input.selectionByQuestionId[input.question.id] ?? ""}
        onChange={(event) => input.setValue(input.question.id, event.target.value)}
      >
        <option value="">No answer</option>
        {input.scaleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RunAnswerForm(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  run: VenueAssessmentRun;
}) {
  const initialValues = React.useMemo(() => {
    return buildInitialSelectionByQuestionId(input.run.myAnswers);
  }, [input.run.myAnswers]);

  const [selectionByQuestionId, setSelectionByQuestionId] = React.useState<Record<string, string>>(
    initialValues,
  );

  function setValue(questionId: string, value: string): void {
    setSelectionByQuestionId((currentValue) => ({
      ...currentValue,
      [questionId]: value,
    }));
  }

  const payload = React.useMemo(
    () =>
      JSON.stringify(
        buildRunAnswerPayloadRows({
          categories: input.run.categories,
          selectionByQuestionId,
        }),
      ),
    [input.run.categories, selectionByQuestionId],
  );

  return (
    <form action={submitAssessmentAnswersAction} className="space-y-4">
      <AssessmentScopeFields
        scope={input.scope}
        teamVenueId={input.teamVenueId}
        selectedYear={input.selectedYear}
      />
      <input type="hidden" name="runId" value={input.run.id} />
      <input type="hidden" name="answersJson" value={payload} />

      <RunAnswerFormPendingFieldset>
        {input.run.categories.map((category) => (
          <div key={category.id} className="space-y-3 rounded-md border p-3">
            <h4 className="text-sm font-semibold">{category.name}</h4>

            {categoryHasModes(category) ? (
              <div className="space-y-3">
                {(category.modes ?? []).map((mode) => (
                  <section key={mode.id} className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {mode.name}
                    </p>
                    {mode.questions.map((question) =>
                      renderRunQuestionField({
                        question,
                        selectionByQuestionId,
                        setValue,
                        scaleOptions: input.run.scaleOptions,
                      }),
                    )}
                  </section>
                ))}
              </div>
            ) : (
              category.questions.map((question) =>
                renderRunQuestionField({
                  question,
                  selectionByQuestionId,
                  setValue,
                  scaleOptions: input.run.scaleOptions,
                }),
              )
            )}
          </div>
        ))}

        <RunAnswerSubmitButton />
      </RunAnswerFormPendingFieldset>
    </form>
  );
}

function CrewAssessmentDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  run: VenueAssessmentRun;
  triggerContent?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(
    input.run.categories[0]?.id ?? "",
  );
  const [selectedModeByCategoryId, setSelectedModeByCategoryId] = React.useState<
    Record<string, string>
  >(() => buildInitialModeByCategoryId(input.run.categories));

  const initialValues = React.useMemo(
    () => buildInitialSelectionByQuestionId(input.run.myAnswers),
    [input.run.myAnswers],
  );
  const [selectionByQuestionId, setSelectionByQuestionId] = React.useState<Record<string, string>>(
    initialValues,
  );

  const selectedCategory = React.useMemo(
    () =>
      input.run.categories.find((category) => category.id === selectedCategoryId) ??
      input.run.categories[0] ??
      null,
    [input.run.categories, selectedCategoryId],
  );
  const selectedCategoryUsesModes = selectedCategory ? categoryHasModes(selectedCategory) : false;
  const selectedModeId =
    selectedCategory && selectedCategoryUsesModes
      ? (selectedModeByCategoryId[selectedCategory.id] ?? selectedCategory.modes?.[0]?.id ?? "")
      : "";
  const selectedMode =
    selectedCategory && selectedCategoryUsesModes
      ? (selectedCategory.modes?.find((mode) => mode.id === selectedModeId) ??
        selectedCategory.modes?.[0] ??
        null)
      : null;
  const activeQuestions = React.useMemo(() => {
    if (!selectedCategory) {
      return [] as VenueAssessmentQuestion[];
    }

    if (selectedCategoryUsesModes) {
      return selectedMode?.questions ?? [];
    }

    return selectedCategory.questions;
  }, [selectedCategory, selectedCategoryUsesModes, selectedMode]);

  function setValue(questionId: string, value: string): void {
    setSelectionByQuestionId((currentValue) => ({
      ...currentValue,
      [questionId]: value,
    }));
  }

  function clearValue(questionId: string): void {
    setSelectionByQuestionId((currentValue) => ({
      ...currentValue,
      [questionId]: "",
    }));
  }

  function handleOpenChange(nextOpen: boolean): void {
    setIsOpen(nextOpen);

    const resetCategoryId = input.run.categories[0]?.id ?? "";
    const resetSelectionByQuestionId = buildInitialSelectionByQuestionId(input.run.myAnswers);
    const resetModeByCategoryId = buildInitialModeByCategoryId(input.run.categories);

    setSelectionByQuestionId(resetSelectionByQuestionId);
    setSelectedCategoryId(resetCategoryId);
    setSelectedModeByCategoryId(resetModeByCategoryId);
  }

  function handleCategoryChange(nextCategoryId: string): void {
    setSelectedCategoryId(nextCategoryId);
  }

  function handleModeChange(categoryId: string, modeId: string): void {
    setSelectedModeByCategoryId((currentValue) => ({
      ...currentValue,
      [categoryId]: modeId,
    }));
  }

  function renderQuestionRow(question: VenueAssessmentQuestion): React.ReactNode {
    const selectedValue = selectionByQuestionId[question.id] ?? "";

    return (
      <article key={question.id} className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-sm font-medium break-words">{question.prompt}</p>
            {question.isRequired ? (
              <span className="text-xs font-medium text-muted-foreground">Required</span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {input.run.scaleOptions.map((option) => {
              const isActive = selectedValue === option.id;

              return (
                <Button
                  key={option.id}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className="size-8 rounded-full p-0"
                  onClick={() => setValue(question.id, option.id)}
                >
                  {option.label}
                </Button>
              );
            })}

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              onClick={() => clearValue(question.id)}
              disabled={selectedValue.length === 0}
              aria-label={`Clear selection for ${question.prompt}`}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      </article>
    );
  }

  const payload = React.useMemo(
    () =>
      JSON.stringify(
        buildRunAnswerPayloadRows({
          categories: input.run.categories,
          selectionByQuestionId,
        }),
      ),
    [input.run.categories, selectionByQuestionId],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {input.triggerContent ? (
        <DialogTrigger
          render={
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/40"
            />
          }
        >
          {input.triggerContent}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button type="button" size="sm" />}>Complete</DialogTrigger>
      )}
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <RunTitleWithCamps camps={input.run.camps} />
          </DialogTitle>
          <DialogDescription>
            Select a category, switch mode tabs when available, and score each indicator from 1 to 5.
          </DialogDescription>
        </DialogHeader>

        <form action={submitAssessmentAnswersAction} className="flex min-h-0 flex-1 flex-col">
          <AssessmentScopeFields
            scope={input.scope}
            teamVenueId={input.teamVenueId}
            selectedYear={input.selectedYear}
          />
          <input type="hidden" name="runId" value={input.run.id} />
          <input type="hidden" name="answersJson" value={payload} />

          <RunAnswerFormPendingFieldset className="min-h-0 flex flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="shrink-0 space-y-3">
                {input.run.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No categories configured for this assessment run.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor={`crew-assessment-category-${input.run.id}`}>Category</Label>
                      <select
                        id={`crew-assessment-category-${input.run.id}`}
                        value={selectedCategory?.id ?? ""}
                        onChange={(event) => handleCategoryChange(event.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {input.run.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCategory && selectedCategoryUsesModes ? (
                      (selectedCategory.modes?.length ?? 0) > 0 ? (
                        <Tabs
                          value={selectedMode?.id ?? selectedCategory.modes?.[0]?.id ?? ""}
                          onValueChange={(nextModeId) =>
                            handleModeChange(selectedCategory.id, String(nextModeId))
                          }
                          className="gap-0"
                        >
                          <TabsList className="h-9 w-full justify-start overflow-x-auto">
                            {(selectedCategory.modes ?? []).map((mode) => (
                              <TabsTrigger key={mode.id} value={mode.id} className="min-w-fit">
                                {mode.name}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No modes configured for this category.
                        </p>
                      )
                    ) : null}
                  </>
                )}
              </div>

              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                {input.run.categories.length === 0 ? null : !selectedCategory ? null : selectedCategoryUsesModes &&
                  (selectedCategory.modes?.length ?? 0) === 0 ? null : activeQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No indicators configured for this {selectedCategoryUsesModes ? "mode" : "category"}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeQuestions.map((question) => renderQuestionRow(question))}
                  </div>
                )}
              </div>
            </div>
          </RunAnswerFormPendingFieldset>

          <DialogFooter>
            <RunAnswerSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VenueAssessmentsPanel(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  canManageAssessments: boolean;
  templates: VenueAssessmentTemplate[];
  runs: VenueAssessmentRun[];
  availableCamps: VenueDetailCampItem[];
}) {
  const publishedAssignedRuns = React.useMemo(
    () => input.runs.filter((run) => run.status === "published" && run.isRespondent),
    [input.runs],
  );
  const crewRunsCardIsEmpty = publishedAssignedRuns.length === 0;
  const [openTemplateValues, setOpenTemplateValues] = React.useState<string[]>([]);
  const canCreateRun = input.templates.length > 0;
  const runsCardIsEmpty = input.runs.length === 0;
  const templatesCardIsEmpty = input.templates.length === 0;

  if (!input.canManageAssessments) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-base font-semibold">Assessments</h3>
          <p className="text-sm text-muted-foreground">Published assessments of {input.selectedYear}</p>
        </header>

        {crewRunsCardIsEmpty ? (
          <p className="text-sm text-muted-foreground">No assessments created by coach yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {publishedAssignedRuns.map((run) => (
              <li key={run.id}>
                <CrewAssessmentDialog
                  scope={input.scope}
                  teamVenueId={input.teamVenueId}
                  selectedYear={input.selectedYear}
                  run={run}
                  triggerContent={
                    <>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">
                          <RunTitleWithCamps camps={run.camps} />
                        </h4>
                        <p className="truncate text-xs text-muted-foreground">
                          {run.templateName ?? (run.templateId ? "Linked" : "Ad-hoc")} • Crew Completion:{" "}
                          {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                        </p>
                      </div>
                      <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                        Complete
                      </span>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className={`lg:col-span-2 ${runsCardIsEmpty ? "border-dashed bg-muted/40" : ""}`}>
        {input.canManageAssessments && !runsCardIsEmpty ? (
          <CardHeader className="pb-1">
            <div className="flex justify-end">
              <div className="flex flex-col items-end gap-1">
                <RunCreateDialog
                  scope={input.scope}
                  teamVenueId={input.teamVenueId}
                  selectedYear={input.selectedYear}
                  availableCamps={input.availableCamps}
                  templates={input.templates}
                  triggerLabel="Create run"
                  disabled={!canCreateRun}
                />
                {!canCreateRun ? (
                  <p className="text-xs text-muted-foreground">
                    Create a template first to add an assessment.
                  </p>
                ) : null}
              </div>
            </div>
          </CardHeader>
        ) : null}

        <CardContent className={runsCardIsEmpty ? "flex min-h-[150px] items-center justify-center" : "space-y-4"}>
          {runsCardIsEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">No assessment runs for this year.</p>
              {input.canManageAssessments ? (
                <div className="flex flex-col items-center gap-1">
                  <RunCreateDialog
                    scope={input.scope}
                    teamVenueId={input.teamVenueId}
                    selectedYear={input.selectedYear}
                    availableCamps={input.availableCamps}
                    templates={input.templates}
                    triggerLabel="Create run"
                    disabled={!canCreateRun}
                  />
                  {!canCreateRun ? (
                    <p className="text-xs text-muted-foreground">
                      Create a template first to add an assessment.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {input.runs.map((run) => (
                <article key={run.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">
                          <RunTitleWithCamps camps={run.camps} />
                        </h4>
                        <Badge variant={getStatusBadgeVariant(run.status)}>{run.status}</Badge>
                      </div>
                      {run.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{run.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Template: {run.templateName ?? (run.templateId ? "Linked" : "Ad-hoc")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Progress: {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </p>
                    </div>

                    {input.canManageAssessments ? (
                      <div className="flex flex-wrap gap-2">
                        {run.status !== "closed" ? (
                          <form action={closeAssessmentRunAction}>
                            <AssessmentScopeFields
                              scope={input.scope}
                              teamVenueId={input.teamVenueId}
                              selectedYear={input.selectedYear}
                            />
                            <input type="hidden" name="runId" value={run.id} />
                            <CloseRunSubmitButton />
                          </form>
                        ) : null}

                        <RunDeleteDialog
                          scope={input.scope}
                          teamVenueId={input.teamVenueId}
                          selectedYear={input.selectedYear}
                          runId={run.id}
                          runName={run.name}
                        />
                      </div>
                    ) : null}
                  </div>

                  {run.status === "published" && run.isRespondent ? (
                    <RunAnswerForm
                      scope={input.scope}
                      teamVenueId={input.teamVenueId}
                      selectedYear={input.selectedYear}
                      run={run}
                    />
                  ) : run.status === "published" && !run.isRespondent ? (
                    <p className="text-xs text-muted-foreground">
                      You are not in the responder list for this run.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={templatesCardIsEmpty ? "border-dashed bg-muted/40" : ""}>
        {input.canManageAssessments ? (
          <CardHeader>
            <div className="flex justify-end">
              <TemplateEditorDialog
                scope={input.scope}
                teamVenueId={input.teamVenueId}
                selectedYear={input.selectedYear}
                triggerLabel="Create template"
              />
            </div>
          </CardHeader>
        ) : null}

        <CardContent className="space-y-3">
          {templatesCardIsEmpty ? (
            <p className="text-sm text-muted-foreground">No templates for this team</p>
          ) : (
            <Accordion
              value={openTemplateValues}
              onValueChange={(values) =>
                setOpenTemplateValues(values.length > 0 ? [String(values[0])] : [])
              }
              className="space-y-3"
            >
              {input.templates.map((template) => {
                const totalModes = template.categories.reduce(
                  (count, category) => count + (category.modes?.length ?? 0),
                  0,
                );

                return (
                  <AccordionItem
                    key={template.id}
                    value={buildTemplateAccordionValue(template.id)}
                    className="rounded-xl border bg-card px-4"
                  >
                    <AccordionTrigger className="py-4 no-underline hover:no-underline">
                      <span className="text-left">
                        <span className="block text-sm font-semibold">{template.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Scale options: {template.scaleOptions.length} • Categories:{" "}
                          {template.categories.length}
                          {totalModes > 0 ? ` • Modes: ${totalModes}` : ""}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      {input.canManageAssessments ? (
                        <TemplateEditorDialog
                          scope={input.scope}
                          teamVenueId={input.teamVenueId}
                          selectedYear={input.selectedYear}
                          template={template}
                          triggerLabel="Edit"
                        />
                      ) : null}

                      <div className="space-y-2">
                        {template.categories.map((category) => (
                          <div key={category.id} className="rounded-md border p-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {category.name}
                            </p>

                            {categoryHasModes(category) ? (
                              <div className="mt-2 space-y-2">
                                {(category.modes ?? []).map((mode) => (
                                  <div key={mode.id} className="rounded-md border p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {mode.name}
                                    </p>
                                    <ul className="mt-1 space-y-1 text-xs">
                                      {mode.questions.map((question) => (
                                        <li key={question.id}>{question.prompt}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <ul className="mt-1 space-y-1 text-xs">
                                {category.questions.map((question) => (
                                  <li key={question.id}>{question.prompt}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
