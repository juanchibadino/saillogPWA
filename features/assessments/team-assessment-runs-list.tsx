"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  closeAssessmentRunAction,
  deleteAssessmentRunAction,
} from "@/features/assessments/actions"
import {
  formatAssessmentRunStatusLabel,
  formatDateTimeLabel,
  getAssessmentRunStatusBadgeVariant,
} from "@/features/assessments/assessment-formatters"
import { AssessmentScopeFields } from "@/features/assessments/assessment-scope-fields"
import type {
  TeamAssessmentRun,
  TeamAssessmentsCreatedTabData,
} from "@/features/assessments/data"
import { buildTeamAssessmentsPageHref } from "@/features/assessments/list-route-state.mjs"
import { buildAssessmentDetailHref } from "@/features/assessments/navigation"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AssessmentPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
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

export function TeamAssessmentRunsList({
  canManageAssessments,
  data,
  returnPath,
  scope,
}: {
  canManageAssessments: boolean
  data: TeamAssessmentsCreatedTabData
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
                        <Badge variant={getAssessmentRunStatusBadgeVariant(run.status)}>
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
                        {run.venueName}
                      </TableCell>
                      <TableCell>
                        <AssessmentRunCampsBadges camps={run.camps} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {run.completedRespondentsCount}/{run.expectedRespondentsCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAssessmentRunStatusBadgeVariant(run.status)}>
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
