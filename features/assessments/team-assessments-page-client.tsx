"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  closeAssessmentRunAction,
  createAssessmentRunAction,
  deleteAssessmentRunAction,
} from "@/features/assessments/actions"
import {
  getTemplateDefinition,
  serializeDefinition,
} from "@/features/assessments/definition"
import { buildTeamAssessmentsPageHref } from "@/features/assessments/list-route-state.mjs"
import {
  buildAssessmentDetailHref,
  buildTeamAssessmentsHref,
  type TeamAssessmentTab,
} from "@/features/assessments/navigation"
import { AssessmentTemplateEditor } from "@/features/assessments/template-editor"
import type {
  TeamAssessmentCampOption,
  TeamAssessmentsPageData,
  TeamAssessmentRun,
  TeamAssessmentTemplate,
  TeamAssessmentVenueOption,
} from "@/features/assessments/data"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { GradientCard } from "@/components/shared/gradient-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AssessmentPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function getStatusBadgeVariant(
  status: TeamAssessmentRun["status"],
): "secondary" | "default" | "outline" {
  if (status === "published") {
    return "default"
  }

  if (status === "closed") {
    return "secondary"
  }

  return "outline"
}

function formatAssessmentRunStatusLabel(status: TeamAssessmentRun["status"]): string {
  if (status === "published") {
    return "Published"
  }

  if (status === "closed") {
    return "Completed"
  }

  return "Draft"
}

function formatDateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function buildPaginationItems(currentPage: number, pageCount: number): AssessmentPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: AssessmentPaginationItem[] = [1]
  const middleStart = Math.max(2, currentPage - 1)
  const middleEnd = Math.min(pageCount - 1, currentPage + 1)

  if (middleStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < pageCount - 1) {
    items.push("ellipsis-end")
  }

  items.push(pageCount)
  return items
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")
  return `${url.pathname}${url.search}`
}

function AssessmentScopeFields({ scope }: { scope: NavigationScope }) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
    </>
  )
}

function RunCreateSubmitButton({
  className,
  disabledByValidation,
}: {
  className?: string
  disabledByValidation: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabledByValidation} className={className}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Creating assessment..." : "Create assessment"}
    </Button>
  )
}

function DeleteRunSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Deleting..." : "Delete"}
    </Button>
  )
}

function CloseRunMenuItem() {
  const { pending } = useFormStatus()

  return (
    <DropdownMenuItem
      nativeButton
      render={<button type="submit" disabled={pending} />}
      disabled={pending}
    >
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Closing..." : "Close"}
    </DropdownMenuItem>
  )
}

function AssessmentRunCampsBadges({ camps }: { camps: TeamAssessmentRun["camps"] }) {
  if (camps.length === 0) {
    return <Badge variant="outline">No camp linked</Badge>
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {camps.map((camp) => (
        <Badge key={camp.id} variant="secondary">
          {camp.name}
        </Badge>
      ))}
    </span>
  )
}

function RunDeleteDialog({
  onOpenChange,
  open,
  returnPath,
  run,
  scope,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  returnPath: string
  run: TeamAssessmentRun
  scope: NavigationScope
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete assessment?</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-medium">{run.name}</span>{" "}
            and all submitted answers linked to it.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter showCloseButton>
          <form action={deleteAssessmentRunAction}>
            <AssessmentScopeFields scope={scope} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input type="hidden" name="runId" value={run.id} />
            <input type="hidden" name="teamVenueId" value={run.teamVenueId} />
            <DeleteRunSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssessmentRunActionsMenu({
  canManageAssessments,
  returnPath,
  run,
  scope,
  triggerClassName,
}: {
  canManageAssessments: boolean
  returnPath: string
  run: TeamAssessmentRun
  scope: NavigationScope
  triggerClassName?: string
}) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  if (!canManageAssessments) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={triggerClassName}
            />
          }
          aria-label={`Open actions for ${run.templateName ?? run.name}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {run.status !== "closed" ? (
            <form action={closeAssessmentRunAction}>
              <AssessmentScopeFields scope={scope} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <input type="hidden" name="runId" value={run.id} />
              <input type="hidden" name="teamVenueId" value={run.teamVenueId} />
              <CloseRunMenuItem />
            </form>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setIsDeleteOpen(true)
            }}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RunDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        returnPath={returnPath}
        run={run}
        scope={scope}
      />
    </>
  )
}

function AssessmentRunCreateDialog({
  campOptions,
  disabled,
  returnPath,
  scope,
  templates,
  venueOptions,
}: {
  campOptions: TeamAssessmentCampOption[]
  disabled: boolean
  returnPath: string
  scope: NavigationScope
  templates: TeamAssessmentTemplate[]
  venueOptions: TeamAssessmentVenueOption[]
}) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedTeamVenueId, setSelectedTeamVenueId] = React.useState("")
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("")
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([])
  const templatesById = React.useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  )
  const availableCampOptions = React.useMemo(
    () => campOptions.filter((camp) => camp.teamVenueId === selectedTeamVenueId),
    [campOptions, selectedTeamVenueId],
  )
  const definitionJson = React.useMemo(() => {
    const template = templatesById.get(selectedTemplateId)

    if (!template) {
      return ""
    }

    return serializeDefinition(getTemplateDefinition(template))
  }, [selectedTemplateId, templatesById])
  const canSubmit =
    selectedTeamVenueId.length > 0 &&
    selectedTemplateId.length > 0 &&
    selectedCampIds.length > 0

  function toggleCamp(campId: string): void {
    setSelectedCampIds((currentValue) => {
      if (currentValue.includes(campId)) {
        return currentValue.filter((value) => value !== campId)
      }

      return [...currentValue, campId]
    })
  }

  function renderForm(surface: "drawer" | "sheet") {
    const isDrawerSurface = surface === "drawer"
    const selectClassName = isDrawerSurface
      ? "h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"
      : "h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    const footer = isDrawerSurface ? (
      <DrawerFooter className="shrink-0 border-t">
        <RunCreateSubmitButton disabledByValidation={!canSubmit} className="h-11 w-full" />
      </DrawerFooter>
    ) : (
      <SheetFooter className="shrink-0 border-t sm:justify-end">
        <RunCreateSubmitButton disabledByValidation={!canSubmit} />
      </SheetFooter>
    )

    return (
      <form action={createAssessmentRunAction} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AssessmentScopeFields scope={scope} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="teamVenueId" value={selectedTeamVenueId} />
        <input type="hidden" name="templateId" value={selectedTemplateId} />
        <input type="hidden" name="campIdsJson" value={JSON.stringify(selectedCampIds)} />
        <input type="hidden" name="definitionJson" value={definitionJson} />

        <fieldset
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`assessment-run-venue-${surface}`}>Venue</Label>
            <select
              id={`assessment-run-venue-${surface}`}
              value={selectedTeamVenueId}
              className={selectClassName}
              onChange={(event) => {
                setSelectedTeamVenueId(event.target.value)
                setSelectedCampIds([])
              }}
            >
              <option value="">Select venue</option>
              {venueOptions.map((venue) => (
                <option key={venue.teamVenueId} value={venue.teamVenueId}>
                  {venue.venueName} - {venue.venueLocation}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`assessment-run-template-${surface}`}>Template</Label>
            <select
              id={`assessment-run-template-${surface}`}
              value={selectedTemplateId}
              className={selectClassName}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Camps</Label>
            {!selectedTeamVenueId ? (
              <p className="text-sm text-muted-foreground">Select a venue first.</p>
            ) : availableCampOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No camps are available for this venue.
              </p>
            ) : (
              <div className="grid gap-2 rounded-lg border p-3">
                {availableCampOptions.map((camp) => (
                  <label
                    key={camp.campId}
                    className="flex min-h-11 items-start gap-2 py-1 text-sm md:min-h-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampIds.includes(camp.campId)}
                      onChange={() => toggleCamp(camp.campId)}
                    />
                    <span>
                      <span className="font-medium">{camp.campName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {camp.dateRangeLabel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        {footer}
      </form>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          type="button"
          variant="default"
          size="icon"
          disabled={disabled}
          aria-label="New assessment"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
          onClick={() => setIsOpen(true)}
        >
          <PlusIcon className="size-6" />
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create assessment</DrawerTitle>
            <DrawerDescription>
              Select a venue, template, and camps for this assessment.
            </DrawerDescription>
          </DrawerHeader>
          {renderForm("drawer")}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        <PlusIcon className="size-4" />
        New
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create assessment</SheetTitle>
          <SheetDescription>
            Select a venue, template, and camps for this assessment.
          </SheetDescription>
        </SheetHeader>
        {renderForm("sheet")}
      </SheetContent>
    </Sheet>
  )
}

function TeamAssessmentRunsTable({
  canManageAssessments,
  data,
  returnPath,
  scope,
}: {
  canManageAssessments: boolean
  data: TeamAssessmentsPageData
  returnPath: string
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = React.useTransition()
  const [navigatingRunId, setNavigatingRunId] = React.useState<string | null>(null)
  const [, startRunNavigationTransition] = React.useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = React.useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    React.useState<PendingPageNavigation | null>(null)
  const paginationItems = buildPaginationItems(
    data.pagination.currentPage,
    data.pagination.pageCount,
  )
  const isPaginationBusy =
    isPageNavigationPending ||
    pendingPageNavigation?.fromPage === data.pagination.currentPage
  const previousPage = Math.max(1, data.pagination.currentPage - 1)
  const nextPage = Math.min(data.pagination.pageCount, data.pagination.currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamAssessmentsPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToRun(runId: string, detailHref: string): void {
    setNavigatingRunId(runId)
    startRunNavigationTransition(() => {
      router.push(detailHref)
    })
  }

  function prefetchRun(detailHref: string): void {
    router.prefetch(detailHref)
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPaginationBusy ||
      nextPageNumber === data.pagination.currentPage ||
      nextPageNumber < 1 ||
      nextPageNumber > data.pagination.pageCount
    ) {
      return
    }

    setPendingPageNavigation({
      fromPage: data.pagination.currentPage,
      toPage: nextPageNumber,
    })
    startPageNavigationTransition(() => {
      router.push(buildPageHref(nextPageNumber))
    })
  }

  return (
    <section className="space-y-4">
      <div aria-busy={isPaginationBusy} className="relative md:hidden">
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "space-y-2 transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          {data.runs.length === 0 ? (
            <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
              No assessments created for this team yet.
            </GradientCard>
          ) : (
            data.runs.map((run) => {
              const detailHref = buildAssessmentDetailHref({
                scope,
                assessmentId: run.id,
              })
              const isNavigatingToRun = navigatingRunId === run.id

              return (
                <GradientCard
                  key={run.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingToRun}
                  className={cn(
                    "cursor-pointer px-3 py-3 transition-colors hover:bg-muted/30",
                    isNavigatingToRun && "opacity-80",
                  )}
                  onMouseEnter={() => prefetchRun(detailHref)}
                  onFocus={() => prefetchRun(detailHref)}
                  onClick={() => navigateToRun(run.id, detailHref)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigateToRun(run.id, detailHref)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {run.templateName ?? run.name}
                        </p>
                        <Badge variant={getStatusBadgeVariant(run.status)}>
                          {formatAssessmentRunStatusLabel(run.status)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {run.venueName} - {run.venueLocation}
                      </p>
                      <AssessmentRunCampsBadges camps={run.camps} />
                      <p className="text-sm font-medium tabular-nums">
                        {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </p>
                    </div>
                    <div
                      className="shrink-0 self-center"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {isNavigatingToRun ? (
                        <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : (
                        <AssessmentRunActionsMenu
                          canManageAssessments={canManageAssessments}
                          returnPath={returnPath}
                          run={run}
                          scope={scope}
                          triggerClassName="h-11 w-11"
                        />
                      )}
                    </div>
                  </div>
                </GradientCard>
              )
            })
          )}

          {data.pagination.hasNextPage ? (
            <div className="pb-4 pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={isLoadingMore || isPaginationBusy}
                aria-label="Load more assessments"
                className="h-11 w-full"
                onClick={() => {
                  startLoadMoreTransition(() => {
                    router.push(buildPageHref(data.pagination.currentPage + 1, true))
                  })
                }}
              >
                {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {isLoadingMore ? "Loading more..." : "Load more assessments"}
              </Button>
            </div>
          ) : null}
        </div>

        {isPaginationBusy ? (
          <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
            <div
              role="status"
              aria-label="Loading assessments page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      <GradientCard
        aria-busy={isPaginationBusy}
        className="relative hidden overflow-hidden p-0 md:block"
      >
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Assessment</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Camps</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                    No assessments created for this team yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.runs.map((run) => {
                  const detailHref = buildAssessmentDetailHref({
                    scope,
                    assessmentId: run.id,
                  })
                  const isNavigatingToRun = navigatingRunId === run.id

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
                          event.preventDefault()
                          navigateToRun(run.id, detailHref)
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={detailHref}
                          className="underline-offset-4 hover:underline"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            navigateToRun(run.id, detailHref)
                          }}
                          onMouseEnter={() => prefetchRun(detailHref)}
                          onFocus={() => prefetchRun(detailHref)}
                        >
                          {run.templateName ?? run.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="block">{run.venueName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {run.venueLocation}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AssessmentRunCampsBadges camps={run.camps} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(run.status)}>
                          {formatAssessmentRunStatusLabel(run.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTimeLabel(run.createdAt)}</TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {isNavigatingToRun ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : (
                          <AssessmentRunActionsMenu
                            canManageAssessments={canManageAssessments}
                            returnPath={returnPath}
                            run={run}
                            scope={scope}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {isPaginationBusy ? (
          <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
            <div
              role="status"
              aria-label="Loading assessments page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

      {data.pagination.pageCount > 1 ? (
        <Pagination aria-busy={isPaginationBusy} className="hidden justify-start md:flex">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!data.pagination.hasPreviousPage || isPaginationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isPaginationBusy}
                    isActive={pageItem === data.pagination.currentPage}
                    onClick={() => navigateToPage(pageItem)}
                  >
                    {pageItem}
                  </PaginationLink>
                ) : (
                  <PaginationEllipsis />
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                disabled={!data.pagination.hasNextPage || isPaginationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}

function countTemplateItems(template: TeamAssessmentTemplate): {
  categoryCount: number
  modeCount: number
  questionCount: number
} {
  return template.categories.reduce(
    (summary, category) => {
      const modeCount = category.modes?.length ?? 0
      const modeQuestionCount = (category.modes ?? []).reduce(
        (count, mode) => count + mode.questions.length,
        0,
      )

      return {
        categoryCount: summary.categoryCount + 1,
        modeCount: summary.modeCount + modeCount,
        questionCount:
          summary.questionCount + category.questions.length + modeQuestionCount,
      }
    },
    {
      categoryCount: 0,
      modeCount: 0,
      questionCount: 0,
    },
  )
}

function TeamAssessmentTemplatesPanel({
  cancelHref,
  canManageAssessments,
  creatingTemplate,
  scope,
  selectedTemplateId,
  templates,
}: {
  cancelHref: string
  canManageAssessments: boolean
  creatingTemplate: boolean
  scope: NavigationScope
  selectedTemplateId?: string
  templates: TeamAssessmentTemplate[]
}) {
  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId)
    : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <section className="space-y-3">
        <div className="md:hidden">
          {templates.length === 0 ? (
            <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
              No templates for this team yet.
            </GradientCard>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const counts = countTemplateItems(template)
                const href = buildTeamAssessmentsHref({
                  scope,
                  tab: "templates",
                  templateId: template.id,
                })

                return (
                  <Link key={template.id} href={href}>
                    <GradientCard
                      className={cn(
                        "px-3 py-3 transition-colors hover:bg-muted/30",
                        selectedTemplateId === template.id && "border-primary/60",
                      )}
                    >
                      <p className="truncate text-sm font-semibold">{template.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {counts.categoryCount} categories
                        {counts.modeCount > 0 ? ` - ${counts.modeCount} modes` : ""} -{" "}
                        {counts.questionCount} items
                      </p>
                    </GradientCard>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <GradientCard className="hidden overflow-hidden p-0 md:block">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Template</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-sm text-muted-foreground">
                    No templates for this team yet.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => {
                  const counts = countTemplateItems(template)
                  const href = buildTeamAssessmentsHref({
                    scope,
                    tab: "templates",
                    templateId: template.id,
                  })

                  return (
                    <TableRow
                      key={template.id}
                      className={cn(
                        "cursor-pointer",
                        selectedTemplateId === template.id && "bg-muted/50",
                      )}
                    >
                      <TableCell className="font-medium">
                        <Link href={href} className="underline-offset-4 hover:underline">
                          {template.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {counts.categoryCount} categories
                        {counts.modeCount > 0 ? ` - ${counts.modeCount} modes` : ""} -{" "}
                        {counts.questionCount} items
                      </TableCell>
                      <TableCell>{formatDateTimeLabel(template.updatedAt)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </GradientCard>
      </section>

      {canManageAssessments && (creatingTemplate || selectedTemplate) ? (
        <AssessmentTemplateEditor
          key={selectedTemplate?.id ?? "new-template"}
          cancelHref={cancelHref}
          scope={scope}
          template={selectedTemplate}
        />
      ) : (
        <GradientCard className="hidden min-h-56 items-center justify-center border-dashed p-6 text-center text-sm text-muted-foreground lg:flex">
          Select a template to edit it, or create a new one.
        </GradientCard>
      )}
    </div>
  )
}

export function TeamAssessmentsPageClient({
  canManageAssessments,
  creatingTemplate,
  data,
  noTeamSelected,
  scope,
  selectedTab,
  selectedTemplateId,
}: {
  canManageAssessments: boolean
  creatingTemplate: boolean
  data: TeamAssessmentsPageData
  noTeamSelected: boolean
  scope: NavigationScope
  selectedTab: TeamAssessmentTab
  selectedTemplateId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const templatesHref = buildTeamAssessmentsHref({
    scope,
    tab: "templates",
  })
  const createdHref = buildTeamAssessmentsHref({
    scope,
    tab: "created",
  })
  const newTemplateHref = buildTeamAssessmentsHref({
    scope,
    tab: "templates",
    newTemplate: true,
  })
  const createRunDisabled =
    noTeamSelected ||
    !canManageAssessments ||
    data.templates.length === 0 ||
    data.venueOptions.length === 0 ||
    data.campOptions.length === 0

  function switchTab(nextTab: string): void {
    if (nextTab === selectedTab) {
      return
    }

    router.push(nextTab === "templates" ? templatesHref : createdHref)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-auto">
          <Tabs
            value={selectedTab}
            onValueChange={switchTab}
            className="w-full gap-0 md:w-auto"
          >
            <TabsList className="grid h-10 w-full grid-cols-2 md:inline-flex md:w-fit">
              <TabsTrigger value="created" className="w-full">
                Created
              </TabsTrigger>
              <TabsTrigger value="templates" className="w-full">
                Templates
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex justify-end">
          {selectedTab === "created" ? (
            <AssessmentRunCreateDialog
              campOptions={data.campOptions}
              disabled={createRunDisabled}
              returnPath={currentHref}
              scope={scope}
              templates={data.templates}
              venueOptions={data.venueOptions}
            />
          ) : canManageAssessments ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                nativeButton={false}
                render={<Link href={newTemplateHref} />}
              >
                <PlusIcon className="size-4" />
                New
              </Button>
              <Button
                variant="default"
                size="icon"
                aria-label="New assessment template"
                className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
                nativeButton={false}
                render={<Link href={newTemplateHref} />}
              >
                <PlusIcon className="size-6" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {selectedTab === "created" && data.templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Create a template first to add an assessment.
        </p>
      ) : null}

      {selectedTab === "created" ? (
        <TeamAssessmentRunsTable
          canManageAssessments={canManageAssessments}
          data={data}
          returnPath={currentHref}
          scope={scope}
        />
      ) : (
        <TeamAssessmentTemplatesPanel
          cancelHref={templatesHref}
          canManageAssessments={canManageAssessments}
          creatingTemplate={creatingTemplate}
          scope={scope}
          selectedTemplateId={selectedTemplateId}
          templates={data.templates}
        />
      )}
    </section>
  )
}
