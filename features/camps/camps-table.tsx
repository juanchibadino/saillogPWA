"use client"

import { Loader2Icon, MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"

import {
  type TeamCampStatusFilter,
  type TeamCampListItem,
  type TeamCampTypeFilter,
  type TeamCampVenueOption,
} from "@/features/camps/data"
import { buildTeamCampsPageHref } from "@/features/camps/list-route-state.mjs"
import { buildCampDetailHref } from "@/features/camps/navigation"
import {
  CampActionsMenu,
} from "@/features/camps/camp-form-dialogs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { GradientCard } from "@/components/shared/gradient-card"
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

type TeamCampsTableProps = {
  camps: TeamCampListItem[]
  teamVenueOptions: TeamCampVenueOption[]
  canManageCamps: boolean
  canDeleteCamps: boolean
  noTeamSelected: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  hideChrome?: boolean
}

type TeamCampsPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function formatDateRangeEndpoint(value: string): {
  day: string
  month: string
  year: string
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const parts = formatter.formatToParts(new Date(`${value}T00:00:00.000Z`))
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  const year = parts.find((part) => part.type === "year")?.value ?? ""

  return { day, month, year }
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDateRangeEndpoint(startDate)
  const end = formatDateRangeEndpoint(endDate)

  if (start.year === end.year) {
    return `${start.month} ${start.day} - ${end.month} ${end.day} ${end.year}`
  }

  return `${start.month} ${start.day} ${start.year} - ${end.month} ${end.day} ${end.year}`
}

function formatCampTypeLabel(value: TeamCampListItem["campType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function SessionCountValue({
  value,
}: {
  value: TeamCampListItem["sessionCount"]
}) {
  if (typeof value === "number") {
    return <>{value}</>
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1 text-muted-foreground"
    >
      <Loader2Icon className="size-3 animate-spin" />
      <span className="sr-only">Loading session count</span>
      <span aria-hidden="true">...</span>
    </span>
  )
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedCampStatus?: TeamCampStatusFilter
  selectedCampType?: TeamCampTypeFilter
  selectedVenueId?: string
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view camps."
  }

  if (input.selectedCampType && input.selectedCampStatus) {
    return "No camps found for the selected type and status."
  }

  if (input.selectedCampType) {
    return "No camps found for the selected type."
  }

  if (input.selectedCampStatus) {
    return "No camps found for the selected status."
  }

  if (input.selectedVenueId) {
    return "No camps found for the selected venue."
  }

  return "No camps found for this team yet."
}

function buildTeamCampsPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamCampsPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamCampsPaginationItem[] = [1]
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

export function TeamCampsTable({
  camps,
  teamVenueOptions,
  canManageCamps,
  canDeleteCamps,
  noTeamSelected,
  toolbar,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  pageCount,
  hasPreviousPage,
  hasNextPage,
  hideChrome = false,
}: TeamCampsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [navigatingCampId, setNavigatingCampId] = useState<string | null>(null)
  const [, startCampNavigationTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedCampType,
    selectedCampStatus,
    selectedVenueId,
  })
  const paginationItems = buildTeamCampsPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamCampsPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToCamp(campId: string, detailHref: string): void {
    setNavigatingCampId(campId)
    startCampNavigationTransition(() => {
      router.push(detailHref)
    })
  }

  function prefetchCamp(detailHref: string): void {
    router.prefetch(detailHref)
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
          <h2 className="text-lg font-semibold">Camps</h2>
          {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="relative md:hidden">
        <div className="space-y-2">
          {camps.length === 0 ? (
            <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </GradientCard>
          ) : (
            camps.map((camp) => {
              const detailHref = buildCampDetailHref({
                scope,
                campId: camp.id,
                tab: "sessions",
              })
              const isNavigatingToCamp = navigatingCampId === camp.id

              return (
                <GradientCard
                  key={camp.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingToCamp}
                  className={cn(
                    "cursor-pointer px-3 py-3 transition-colors hover:bg-muted/30",
                    isNavigatingToCamp && "opacity-80",
                  )}
                  onMouseEnter={() => prefetchCamp(detailHref)}
                  onFocus={() => prefetchCamp(detailHref)}
                  onClick={() => {
                    navigateToCamp(camp.id, detailHref)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigateToCamp(camp.id, detailHref)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{camp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {camp.venueName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCampTypeLabel(camp.campType)} ·{" "}
                        {formatDateRange(camp.startDate, camp.endDate)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sessions:{" "}
                        <span className="font-semibold text-foreground">
                          <SessionCountValue value={camp.sessionCount} />
                        </span>
                        {" · "}
                        <span className={camp.isActive ? "text-emerald-700" : "text-muted-foreground"}>
                          {camp.isActive ? "Active" : "Inactive"}
                        </span>
                      </p>
                    </div>

                    <div
                      className="shrink-0 self-center"
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                      }}
                    >
                      {isNavigatingToCamp ? (
                        <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : canManageCamps || canDeleteCamps ? (
                        <CampActionsMenu
                          camp={camp}
                          teamVenueOptions={teamVenueOptions}
                          scope={scope}
                          selectedVenueId={selectedVenueId}
                          selectedCampType={selectedCampType}
                          selectedCampStatus={selectedCampStatus}
                          currentPage={currentPage}
                          canEditCamp={canManageCamps}
                          canDeleteCamp={canDeleteCamps}
                          editSurface="drawer"
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          aria-label="More actions unavailable"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </GradientCard>
              )
            })
          )}

          {hasNextPage ? (
            <div className="pb-4 pt-3">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={isLoadingMore}
                aria-label="Load more camps"
                className="h-11 w-full"
                onClick={() => {
                  startLoadMoreTransition(() => {
                    router.push(buildPageHref(currentPage + 1, true))
                  })
                }}
              >
                {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
                <span>{isLoadingMore ? "Loading more..." : "Load more camps"}</span>
              </Button>
            </div>
          ) : null}
        </div>
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
                <TableHead>Camp</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead># Sessions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {camps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                camps.map((camp) => {
                  const detailHref = buildCampDetailHref({
                    scope,
                    campId: camp.id,
                    tab: "sessions",
                  })
                  const isNavigatingToCamp = navigatingCampId === camp.id

                  return (
                    <TableRow
                      key={camp.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingToCamp}
                      className={cn(
                        "cursor-pointer",
                        isNavigatingToCamp && "opacity-80",
                      )}
                      onMouseEnter={() => prefetchCamp(detailHref)}
                      onFocus={() => prefetchCamp(detailHref)}
                      onClick={() => {
                        navigateToCamp(camp.id, detailHref)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          navigateToCamp(camp.id, detailHref)
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
                            navigateToCamp(camp.id, detailHref)
                          }}
                          onMouseEnter={() => prefetchCamp(detailHref)}
                          onFocus={() => prefetchCamp(detailHref)}
                        >
                          {camp.name}
                        </Link>
                      </TableCell>
                      <TableCell>{camp.venueName}</TableCell>
                      <TableCell>{formatCampTypeLabel(camp.campType)}</TableCell>
                      <TableCell>{formatDateRange(camp.startDate, camp.endDate)}</TableCell>
                      <TableCell>
                        <SessionCountValue value={camp.sessionCount} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            camp.isActive
                              ? "text-emerald-700"
                              : "text-muted-foreground"
                          }
                        >
                          {camp.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        {isNavigatingToCamp ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : canManageCamps || canDeleteCamps ? (
                          <CampActionsMenu
                            camp={camp}
                            teamVenueOptions={teamVenueOptions}
                            scope={scope}
                            selectedVenueId={selectedVenueId}
                            selectedCampType={selectedCampType}
                            selectedCampStatus={selectedCampStatus}
                            currentPage={currentPage}
                            canEditCamp={canManageCamps}
                            canDeleteCamp={canDeleteCamps}
                            editSurface="sheet"
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            aria-label="More actions unavailable"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading camps page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

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
