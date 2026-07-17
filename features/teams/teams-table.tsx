"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
import type { TeamListItem } from "@/features/teams/data"
import { buildTeamsPageHref } from "@/features/teams/list-route-state.mjs"
import { cn } from "@/lib/utils"

type TeamsPaginationItem = number | "ellipsis-start" | "ellipsis-end"
type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function formatTeamType(teamType: string | null): string {
  return teamType?.trim() || "-"
}

function buildTeamsPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamsPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamsPaginationItem[] = [1]
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

export function TeamsTable({
  currentPage,
  hasNextPage,
  hasPreviousPage,
  pageCount,
  teams,
}: {
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageCount: number
  teams: TeamListItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const paginationItems = buildTeamsPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamsPageHref({
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
        {teams.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            No teams found for this organization yet.
          </GradientCard>
        ) : (
          teams.map((team) => (
            <GradientCard key={team.id} className="px-3 py-3">
              <div className="space-y-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{team.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTeamType(team.team_type)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  <span className="truncate text-muted-foreground">{team.slug}</span>
                  <span
                    className={
                      team.is_active
                        ? "text-emerald-700"
                        : "text-muted-foreground"
                    }
                  >
                    {team.is_active ? "Active" : "Inactive"}
                  </span>
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
              aria-label="Load more teams"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more teams"}</span>
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
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Team</TableHead>
                <TableHead>Team Type</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-sm text-muted-foreground">
                    No teams found for this organization yet.
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="truncate font-medium" title={team.name}>
                      {team.name}
                    </TableCell>
                    <TableCell className="truncate" title={formatTeamType(team.team_type)}>
                      {formatTeamType(team.team_type)}
                    </TableCell>
                    <TableCell className="truncate" title={team.slug}>
                      {team.slug}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          team.is_active
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {team.is_active ? "Active" : "Inactive"}
                      </span>
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
              aria-label="Loading teams page"
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
