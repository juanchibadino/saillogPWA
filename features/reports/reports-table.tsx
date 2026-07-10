"use client"

import { useState, useTransition } from "react"
import { DownloadIcon, Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { GradientCard } from "@/components/shared/gradient-card"
import { Button, buttonVariants } from "@/components/ui/button"
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
import type { ReportListItem } from "@/features/reports/data"
import { buildReportsPageHref } from "@/features/reports/list-route-state.mjs"
import { cn } from "@/lib/utils"

type ReportsTableMode = "team" | "organization"
type ReportsPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)
}

function formatReportCampCount(count: number): string {
  return `${count} ${count === 1 ? "camp" : "camps"}`
}

function formatReportCampNames(campNames: string[]): string {
  return campNames.length > 0 ? campNames.join(", ") : "No camps linked"
}

function buildReportsPaginationItems(
  currentPage: number,
  pageCount: number,
): ReportsPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: ReportsPaginationItem[] = [1]
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

export function ReportsTable({
  currentPage,
  emptyMessage,
  hasNextPage,
  hasPreviousPage,
  mode,
  pageCount,
  reports,
}: {
  currentPage: number
  emptyMessage: string
  hasNextPage: boolean
  hasPreviousPage: boolean
  mode: ReportsTableMode
  pageCount: number
  reports: ReportListItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const paginationItems = buildReportsPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)
  const columnCount = mode === "organization" ? 6 : 5

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildReportsPageHref({
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
      <div className="space-y-2 md:hidden">
        {reports.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </GradientCard>
        ) : (
          reports.map((report) => (
            <GradientCard key={report.id} className="px-3 py-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{report.name}</p>
                  {mode === "organization" ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {report.teamName ?? "Unknown team"}
                    </p>
                  ) : null}
                  <p className="truncate text-xs text-muted-foreground">
                    {report.venueName ?? "Unknown venue"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatReportCampCount(report.campCount)}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {formatReportCampNames(report.campNames)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateTimeLabel(report.createdAt)} UTC
                  </p>
                </div>

                <a
                  href={`/api/reports/${report.id}/pdf`}
                  aria-label={`Download PDF for ${report.name}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-11 w-11 px-0",
                  )}
                >
                  <DownloadIcon className="size-4" />
                </a>
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
              aria-label="Load more reports"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more reports"}</span>
            </Button>
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
                <TableHead>Report</TableHead>
                {mode === "organization" ? <TableHead>Team</TableHead> : null}
                <TableHead>Venue</TableHead>
                <TableHead>Camps</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-28 text-right" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-6 text-sm text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    {mode === "organization" ? (
                      <TableCell>{report.teamName ?? "Unknown team"}</TableCell>
                    ) : null}
                    <TableCell>{report.venueName ?? "Unknown venue"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p>{formatReportCampCount(report.campCount)}</p>
                      <p className="max-w-80 truncate">
                        {formatReportCampNames(report.campNames)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTimeLabel(report.createdAt)} UTC
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/reports/${report.id}/pdf`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <DownloadIcon className="size-4" />
                        PDF
                      </a>
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
              aria-label="Loading reports page"
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
