"use client";

import * as React from "react";
import { Loader2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { buildAssessmentDetailHref } from "@/features/assessments/navigation";
import {
  confirmVenueAssessmentRunNotificationAction,
  deleteAssessmentRunAction,
  closeAssessmentRunAction,
  upsertAssessmentRunAction,
} from "@/features/venues/assessment-actions";
import type {
  VenueAssessmentCategory,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
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

function clearAssessmentRunNotificationPromptParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("notifyAssessmentRun");
  url.searchParams.delete("notifyAssessmentRunId");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

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
    <Button
      type="submit"
      size="sm"
      variant="destructive"
      disabled={pending}
      className="h-11 w-full md:h-7"
    >
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
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create assessment run</DrawerTitle>
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
      <DialogContent
        className="sm:max-w-md"
        overlayClassName="bg-black/30 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Delete assessment run?</DialogTitle>
          <DialogDescription>
            This will permanently delete &quot;{input.runName}&quot; and all submitted answers
            linked to this run. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <form action={deleteAssessmentRunAction} className="w-full md:w-auto">
            <AssessmentScopeFields
              scope={input.scope}
              teamVenueId={input.teamVenueId}
              selectedYear={input.selectedYear}
            />
            <input type="hidden" name="runId" value={input.runId} />
            <RunDeleteSubmitButton />
          </form>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full md:h-8 md:w-auto"
              />
            }
          >
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentRunNotificationDialog(input: {
  defaultOpen: boolean;
  runId: string | null;
  scope: NavigationScope;
  selectedYear: number;
  teamVenueId: string;
}) {
  const [isOpen, setIsOpen] = React.useState(input.defaultOpen && Boolean(input.runId));
  const [notifyEmail, setNotifyEmail] = React.useState(true);
  const [notifyPush, setNotifyPush] = React.useState(true);
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const openedPromptRunIdRef = React.useRef<string | null>(
    input.defaultOpen ? input.runId : null,
  );

  React.useEffect(() => {
    if (!input.defaultOpen || !input.runId || openedPromptRunIdRef.current === input.runId) {
      return;
    }

    openedPromptRunIdRef.current = input.runId;
    setNotifyEmail(true);
    setNotifyPush(true);
    setErrorMessage("");
    setIsOpen(true);
  }, [input.defaultOpen, input.runId]);

  function closeDialog(): void {
    openedPromptRunIdRef.current = null;
    setIsOpen(false);
    clearAssessmentRunNotificationPromptParam();
  }

  async function confirmNotifications(): Promise<void> {
    if (isPending || !input.runId) {
      return;
    }

    setIsPending(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.set("runId", input.runId);
    formData.set("scopeOrgId", input.scope.activeOrgId);
    formData.set("scopeVenueId", input.teamVenueId);
    formData.set("scopeYear", String(input.selectedYear));

    if (input.scope.activeTeamId) {
      formData.set("scopeTeamId", input.scope.activeTeamId);
    }

    if (notifyEmail) {
      formData.set("notifyEmail", "on");
    }

    if (notifyPush) {
      formData.set("notifyPush", "on");
    }

    try {
      const result = await confirmVenueAssessmentRunNotificationAction(formData);

      if (!result.ok) {
        setErrorMessage("Could not notify the crew. Confirm permissions and try again.");
        return;
      }

      toast.success("Crew notified.", {
        description: `${result.notifiedCount} crew notification${
          result.notifiedCount === 1 ? "" : "s"
        } queued.`,
      });
      closeDialog();
    } catch {
      setErrorMessage("Could not notify the crew. Confirm permissions and try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setIsOpen(true);
          return;
        }

        closeDialog();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Notify crew?</DialogTitle>
          <DialogDescription>
            Assessment run was saved. Send the request to the active crew.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Email</span>
            <Checkbox
              checked={notifyEmail}
              onCheckedChange={(checked) => {
                setNotifyEmail(checked === true);
              }}
            />
          </Label>
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Push notification</span>
            <Checkbox
              checked={notifyPush}
              onCheckedChange={(checked) => {
                setNotifyPush(checked === true);
              }}
            />
          </Label>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={isPending || !input.runId}
            onClick={() => {
              void confirmNotifications();
            }}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
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
  assessmentRunNotificationRunId?: string | null;
  showAssessmentRunNotificationPrompt?: boolean;
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

  function buildAssessmentReturnToHref(): string {
    const params = new URLSearchParams();

    params.set("org", input.scope.activeOrgId);

    if (input.scope.activeTeamId) {
      params.set("team", input.scope.activeTeamId);
    }

    params.set("tab", "assessments");
    params.set("year", String(input.selectedYear));

    return `/venues/${input.teamVenueId}?${params.toString()}`;
  }

  function buildRunDetailHref(runId: string): string {
    return buildAssessmentDetailHref({
      scope: input.scope,
      assessmentId: runId,
      returnTo: buildAssessmentReturnToHref(),
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
          <>
            <div className="space-y-4 md:hidden">
              {publishedAssignedRuns.map((run) => {
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
                      <div className="min-w-0 flex-1 space-y-2">
                        <h4 className="truncate text-sm font-semibold">
                          {run.templateName ?? "Template unavailable"}
                        </h4>
                        <AssessmentRunCampsBadges camps={run.camps} />
                      </div>

                      <span className="inline-flex h-11 items-center justify-center gap-1.5 self-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                        {isNavigatingToRun ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : null}
                        Complete
                      </span>
                    </div>
                  </GradientCard>
                );
              })}
            </div>

            <section className="hidden space-y-3 md:block">
              <GradientCard className="overflow-hidden p-0">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Assessment</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Camps</TableHead>
                      <TableHead className="w-28 text-right">
                        <span className="sr-only">Action</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publishedAssignedRuns.map((run) => {
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
                            {run.templateName ?? "Template unavailable"}
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
                          <TableCell className="text-right">
                            <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                              {isNavigatingToRun ? (
                                <Loader2Icon className="size-4 animate-spin" />
                              ) : null}
                              Complete
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </GradientCard>
            </section>
          </>
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
                    <div className="min-w-0 flex-1 space-y-2">
                      <h4 className="truncate text-sm font-semibold">
                        {run.templateName ?? "Template unavailable"}
                      </h4>
                      <AssessmentRunCampsBadges camps={run.camps} />
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

      <AssessmentRunNotificationDialog
        defaultOpen={input.showAssessmentRunNotificationPrompt === true}
        runId={input.assessmentRunNotificationRunId ?? null}
        scope={input.scope}
        selectedYear={input.selectedYear}
        teamVenueId={input.teamVenueId}
      />
    </section>
  );
}
