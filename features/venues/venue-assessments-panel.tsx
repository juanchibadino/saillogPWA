"use client";

import * as React from "react";
import { Loader2Icon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { buildAssessmentDetailHref } from "@/features/assessments/navigation";
import {
  deleteAssessmentRunAction,
  closeAssessmentRunAction,
  submitAssessmentAnswersAction,
  upsertAssessmentRunAction,
} from "@/features/venues/assessment-actions";
import type {
  VenueAssessmentCategory,
  VenueAssessmentQuestion,
  VenueAssessmentRun,
  VenueAssessmentTemplate,
  VenueDetailCampItem,
} from "@/features/venues/detail-types";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NavigationScope } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";
import { GradientCard } from "@/components/shared/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatAssessmentRunStatusLabel(status: VenueAssessmentRun["status"]): string {
  if (status === "published") {
    return "Published";
  }

  if (status === "closed") {
    return "Completed";
  }

  return "Draft";
}

function AssessmentRunCampsBadges(input: { camps: VenueAssessmentRun["camps"] }) {
  if (input.camps.length === 0) {
    return <Badge variant="outline">No camp linked</Badge>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {input.camps.map((camp) => (
        <Badge key={camp.id} variant="secondary">
          {camp.name}
        </Badge>
      ))}
    </span>
  );
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

function RunCreateSubmitButton(input: { disabledByValidation: boolean; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending || input.disabledByValidation}
      className={input.className}
    >
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

function CloseRunMenuItem() {
  const { pending } = useFormStatus();

  return (
    <DropdownMenuItem
      nativeButton
      render={<button type="submit" disabled={pending} />}
      disabled={pending}
    >
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Closing..." : "Close"}
    </DropdownMenuItem>
  );
}

function AssessmentRunActionsMenu(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  run: VenueAssessmentRun;
  triggerClassName?: string;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const assessmentLabel = input.run.templateName ?? input.run.name;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={input.triggerClassName}
            />
          }
          aria-label={`Open actions for ${assessmentLabel}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {input.run.status !== "closed" ? (
            <form action={closeAssessmentRunAction}>
              <AssessmentScopeFields
                scope={input.scope}
                teamVenueId={input.teamVenueId}
                selectedYear={input.selectedYear}
              />
              <input type="hidden" name="runId" value={input.run.id} />
              <CloseRunMenuItem />
            </form>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setIsDeleteOpen(true);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RunDeleteDialog
        scope={input.scope}
        teamVenueId={input.teamVenueId}
        selectedYear={input.selectedYear}
        runId={input.run.id}
        runName={input.run.name}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        trigger={null}
      />
    </>
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

function RunCreateDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  availableCamps: VenueDetailCampItem[];
  templates: VenueAssessmentTemplate[];
  triggerLabel: string;
  disabled?: boolean;
}) {
  const isMobile = useIsMobile();
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = React.useState(false);
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

  function renderCreateRunForm(surface: "drawer" | "sheet") {
    const isDrawerSurface = surface === "drawer";
    const selectClassName = isDrawerSurface
      ? "h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"
      : "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
    const checkboxRowClassName = isDrawerSurface
      ? "flex min-h-11 items-start gap-2 py-1 text-sm"
      : "flex items-start gap-2 text-sm";
    const footer =
      surface === "drawer" ? (
        <DrawerFooter className="shrink-0 border-t">
          <RunCreateSubmitButton
            disabledByValidation={!canSubmit}
            className="h-11 w-full"
          />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t sm:justify-end">
          <RunCreateSubmitButton disabledByValidation={!canSubmit} />
        </SheetFooter>
      );

    return (
      <form
        action={upsertAssessmentRunAction}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <RunCreateFormPendingFieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`run-template-new-${surface}`}>Template</Label>
                <select
                  id={`run-template-new-${surface}`}
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className={selectClassName}
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
                      <label key={camp.id} className={checkboxRowClassName}>
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
          </RunCreateFormPendingFieldset>
        </div>

        {footer}
      </form>
    );
  }

  function toggleCamp(campId: string) {
    setSelectedCampIds((currentValue) => {
      if (currentValue.includes(campId)) {
        return currentValue.filter((value) => value !== campId);
      }

      return [...currentValue, campId];
    });
  }

  if (isMobile) {
    return (
      <Drawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen}>
        <Button
          type="button"
          variant="default"
          size="icon"
          disabled={input.disabled}
          aria-label="New assessment run"
          aria-haspopup="dialog"
          aria-expanded={isCreateDrawerOpen}
          className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
          onClick={() => setIsCreateDrawerOpen(true)}
        >
          <PlusIcon className="size-6" />
          <span className="sr-only">{input.triggerLabel}</span>
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create assessment run</DrawerTitle>
            <DrawerDescription>
              Select one template and the camps that should answer this assessment.
            </DrawerDescription>
          </DrawerHeader>

          {renderCreateRunForm("drawer")}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" disabled={input.disabled} />}>
        <PlusIcon className="size-4" />
        {input.triggerLabel}
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create assessment run</SheetTitle>
          <SheetDescription>
            Select one template and the camps that should answer this assessment.
          </SheetDescription>
        </SheetHeader>

        {renderCreateRunForm("sheet")}
      </SheetContent>
    </Sheet>
  );
}

function RunDeleteDialog(input: {
  scope: NavigationScope;
  teamVenueId: string;
  selectedYear: number;
  runId: string;
  runName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode | null;
}) {
  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      {input.trigger === null ? null : (
        input.trigger ?? (
          <DialogTrigger render={<Button type="button" size="sm" variant="destructive" />}>
            Delete
          </DialogTrigger>
        )
      )}
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
  const router = useRouter();
  const [navigatingRunId, setNavigatingRunId] = React.useState<string | null>(null);
  const [, startRunNavigationTransition] = React.useTransition();
  const publishedAssignedRuns = React.useMemo(
    () => input.runs.filter((run) => run.status === "published" && run.isRespondent),
    [input.runs],
  );
  const crewRunsCardIsEmpty = publishedAssignedRuns.length === 0;
  const canCreateRun = input.templates.length > 0;
  const runsCardIsEmpty = input.runs.length === 0;

  function buildRunDetailHref(runId: string): string {
    return buildAssessmentDetailHref({
      scope: input.scope,
      assessmentId: runId,
    });
  }

  function navigateToRun(runId: string, detailHref: string): void {
    setNavigatingRunId(runId);
    startRunNavigationTransition(() => {
      router.push(detailHref);
    });
  }

  function prefetchRun(detailHref: string): void {
    router.prefetch(detailHref);
  }

  if (!input.canManageAssessments) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
            Assessments {input.selectedYear}
          </h1>
          <h2 className="hidden text-lg font-semibold md:block">
            Assessments {input.selectedYear}
          </h2>
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
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Assessments {input.selectedYear}
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">
          Assessments {input.selectedYear}
        </h2>
        <div className="shrink-0">
          <RunCreateDialog
            scope={input.scope}
            teamVenueId={input.teamVenueId}
            selectedYear={input.selectedYear}
            availableCamps={input.availableCamps}
            templates={input.templates}
            triggerLabel="New"
            disabled={!canCreateRun}
          />
        </div>
      </header>

      {!canCreateRun ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Create a template first to add an assessment.
        </p>
      ) : null}

      <div className="md:hidden">
        {runsCardIsEmpty ? (
          <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">No assessment runs for this year.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {input.runs.map((run) => {
              const detailHref = buildRunDetailHref(run.id);
              const isNavigatingToRun = navigatingRunId === run.id;

              return (
                <GradientCard
                  key={run.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingToRun}
                  className={cn(
                    "cursor-pointer space-y-3 px-3 py-3 transition-colors hover:bg-muted/30",
                    isNavigatingToRun && "opacity-80",
                  )}
                  onMouseEnter={() => prefetchRun(detailHref)}
                  onFocus={() => prefetchRun(detailHref)}
                  onClick={() => navigateToRun(run.id, detailHref)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateToRun(run.id, detailHref);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <h4 className="truncate text-sm font-semibold">
                        {run.templateName ?? "Template unavailable"}
                      </h4>

                      <div className="space-y-1.5">
                        <AssessmentRunCampsBadges camps={run.camps} />
                      </div>

                      <p className="text-sm font-medium tabular-nums">
                        {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </p>
                    </div>

                    <div
                      className="shrink-0 self-center"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {isNavigatingToRun ? (
                        <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : (
                        <AssessmentRunActionsMenu
                          scope={input.scope}
                          teamVenueId={input.teamVenueId}
                          selectedYear={input.selectedYear}
                          run={run}
                          triggerClassName="h-11 w-11"
                        />
                      )}
                    </div>
                  </div>

                  {run.status === "published" && run.isRespondent ? (
                    <div
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <RunAnswerForm
                        scope={input.scope}
                        teamVenueId={input.teamVenueId}
                        selectedYear={input.selectedYear}
                        run={run}
                      />
                    </div>
                  ) : null}
                </GradientCard>
              );
            })}
          </div>
        )}
      </div>

      <section className="hidden space-y-3 md:block">
        <GradientCard className={`overflow-hidden p-0 ${runsCardIsEmpty ? "border-dashed bg-muted/40" : ""}`}>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Assessment</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Camps</TableHead>
                <TableHead className="w-20 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsCardIsEmpty ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                    No assessment runs for this year.
                  </TableCell>
                </TableRow>
              ) : (
                input.runs.map((run) => {
                  const detailHref = buildRunDetailHref(run.id);
                  const isNavigatingToRun = navigatingRunId === run.id;

                  return (
                    <TableRow
                      key={run.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingToRun}
                      className={cn("cursor-pointer", isNavigatingToRun && "opacity-80")}
                      onMouseEnter={() => prefetchRun(detailHref)}
                      onFocus={() => prefetchRun(detailHref)}
                      onClick={() => navigateToRun(run.id, detailHref)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigateToRun(run.id, detailHref);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={detailHref}
                          className="underline-offset-4 hover:underline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            navigateToRun(run.id, detailHref);
                          }}
                          onMouseEnter={() => prefetchRun(detailHref)}
                          onFocus={() => prefetchRun(detailHref)}
                        >
                          {run.templateName ?? "Template unavailable"}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(run.status)}>
                          {formatAssessmentRunStatusLabel(run.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AssessmentRunCampsBadges camps={run.camps} />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {isNavigatingToRun ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : (
                          <AssessmentRunActionsMenu
                            scope={input.scope}
                            teamVenueId={input.teamVenueId}
                            selectedYear={input.selectedYear}
                            run={run}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </GradientCard>
      </section>
    </section>
  );
}
