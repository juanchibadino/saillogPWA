"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { GradientCard } from "@/components/shared/gradient-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { WindPatternActionsMenu } from "@/features/wind-patterns/wind-patterns-form-dialogs"
import type {
  TeamWindPatternListItem,
  TeamWindPatternStatusFilter,
} from "@/features/wind-patterns/data"
import { buildTeamWindPatternsPageHref } from "@/features/wind-patterns/list-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamWindPatternsPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).formatToParts(date)
  const partByType = new Map(parts.map((part) => [part.type, part.value]))
  const month = partByType.get("month") ?? "--"
  const day = partByType.get("day") ?? "--"
  const year = partByType.get("year") ?? "--"
  const hour = partByType.get("hour") ?? "--"
  const minute = partByType.get("minute") ?? "--"

  return `${month}/${day}/${year} ${hour}:${minute}`
}

function renderStatusBadge(isActive: boolean) {
  if (isActive) {
    return (
      <Badge className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100">
        Active
      </Badge>
    )
  }

  return <Badge variant="secondary">Archived</Badge>
}

function renderVenueBadge(venueName: string, className?: string) {
  return (
    <Badge
      variant="outline"
      className={cn("min-h-6 max-w-full truncate px-2.5 py-1 text-xs", className)}
    >
      {venueName}
    </Badge>
  )
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedStatusFilter: TeamWindPatternStatusFilter
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view wind patterns."
  }

  if (input.selectedStatusFilter === "archived") {
    return "No archived wind patterns found for this team."
  }

  if (input.selectedStatusFilter === "all") {
    return "No wind patterns found for this team yet."
  }

  return "No active wind patterns found for this team."
}

function buildTeamWindPatternsPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamWindPatternsPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamWindPatternsPaginationItem[] = [1]
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

export function TeamWindPatternsTable({
  patterns,
  canManageWindPatterns,
  noTeamSelected,
  selectedStatusFilter,
  toolbar,
  scope,
  currentPage,
  pageCount,
  hasPreviousPage,
  hasNextPage,
  loadMoreMode,
  hideChrome = false,
}: {
  patterns: TeamWindPatternListItem[]
  canManageWindPatterns: boolean
  noTeamSelected: boolean
  selectedStatusFilter: TeamWindPatternStatusFilter
  toolbar?: ReactNode
  scope: NavigationScope
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  loadMoreMode: boolean
  hideChrome?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = React.useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] =
    React.useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    React.useState<PendingPageNavigation | null>(null)
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedStatusFilter,
  })
  const paginationItems = buildTeamWindPatternsPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamWindPatternsPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPaginationBusy ||
      nextPageNumber === currentPage ||
      nextPageNumber < 1 ||
      nextPageNumber > pageCount
    ) {
      return
    }

    setPendingPageNavigation({
      fromPage: currentPage,
      toPage: nextPageNumber,
    })
    startPageNavigationTransition(() => {
      router.push(buildPageHref(nextPageNumber))
    })
  }

  return (
    <section className="space-y-4">
      {!hideChrome ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Wind Patterns</h2>
          {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="space-y-2 md:hidden">
        {patterns.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </GradientCard>
        ) : (
          patterns.map((windPattern) => (
            <GradientCard key={windPattern.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{windPattern.name}</p>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground",
                        windPattern.description?.trim()
                          ? "line-clamp-2"
                          : "italic",
                      )}
                    >
                      {windPattern.description?.trim() || "No description"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Venue</span>
                    {renderVenueBadge(windPattern.venueName, "text-foreground")}
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTimeLabel(windPattern.updatedAt)}</span>
                  </div>

                  <div>{renderStatusBadge(windPattern.isActive)}</div>
                </div>

                <div className="shrink-0">
                  <WindPatternActionsMenu
                    windPattern={windPattern}
                    scope={scope}
                    teamVenueId={windPattern.teamVenueId}
                    redirectTarget="team-page"
                    statusFilter={selectedStatusFilter}
                    currentPage={currentPage}
                    loadMoreMode={loadMoreMode}
                    canManageWindPatterns={canManageWindPatterns}
                    surface="drawer"
                    triggerClassName="h-11 w-11"
                  />
                </div>
              </div>
            </GradientCard>
          ))
        )}

        {hasNextPage ? (
          <div className="pb-4 pt-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={isLoadingMore}
              aria-label="Load more wind patterns"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>
                {isLoadingMore ? "Loading more..." : "Load more wind patterns"}
              </span>
            </Button>
          </div>
        ) : null}
      </div>

      <div
        aria-busy={isPaginationBusy}
        className="relative hidden overflow-hidden rounded-xl border bg-card md:block"
      >
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[47%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-normal">Name</TableHead>
                <TableHead className="whitespace-normal">Description</TableHead>
                <TableHead className="whitespace-normal">Venue</TableHead>
                <TableHead className="whitespace-normal">Updated</TableHead>
                <TableHead className="whitespace-normal">Status</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                patterns.map((windPattern) => (
                  <TableRow key={windPattern.id}>
                    <TableCell className="max-w-0 whitespace-normal break-words align-top font-medium">
                      {windPattern.name}
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal break-words text-muted-foreground">
                      {windPattern.description && windPattern.description.trim().length > 0
                        ? windPattern.description
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal">
                      {renderVenueBadge(windPattern.venueName)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {formatDateTimeLabel(windPattern.updatedAt)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {renderStatusBadge(windPattern.isActive)}
                    </TableCell>
                    <TableCell className="text-right whitespace-normal">
                      <WindPatternActionsMenu
                        windPattern={windPattern}
                        scope={scope}
                        teamVenueId={windPattern.teamVenueId}
                        redirectTarget="team-page"
                        statusFilter={selectedStatusFilter}
                        currentPage={currentPage}
                        loadMoreMode={loadMoreMode}
                        canManageWindPatterns={canManageWindPatterns}
                        surface="sheet"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {isPaginationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading wind patterns page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <Pagination
          aria-busy={isPaginationBusy}
          className="hidden justify-start md:flex"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage || isPaginationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isPaginationBusy}
                    isActive={pageItem === currentPage}
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
                disabled={!hasNextPage || isPaginationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
