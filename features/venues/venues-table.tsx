"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
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
import type { VenueListItem } from "@/features/venues/data"
import { formatVenueLocation } from "@/features/venues/location"
import { buildVenuesPageHref } from "@/features/venues/list-route-state.mjs"
import { buildVenueDetailHref } from "@/features/venues/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type VenuesTableProps = {
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageCount: number
  scope: NavigationScope
  venues: VenueListItem[]
}

type VenuesPaginationItem = number | "ellipsis-start" | "ellipsis-end"
type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function TeamContextBadges({
  teams,
}: {
  teams: VenueListItem["teamContexts"]
}) {
  if (teams.length === 0) {
    return <Badge variant="outline">No teams</Badge>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {teams.map((team) => (
        <Badge
          key={team.teamVenueId}
          variant={team.isActiveTeam ? "default" : "secondary"}
          className={cn(
            "max-w-36 justify-start",
            !team.isActive && "border-border bg-muted text-muted-foreground",
          )}
          title={team.teamName}
        >
          <span className="truncate">{team.teamName}</span>
        </Badge>
      ))}
    </div>
  )
}

function buildVenuesPaginationItems(
  currentPage: number,
  pageCount: number,
): VenuesPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: VenuesPaginationItem[] = [1]
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

export function VenuesTable({
  currentPage,
  hasNextPage,
  hasPreviousPage,
  pageCount,
  scope,
  venues,
}: VenuesTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const paginationItems = buildVenuesPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildVenuesPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function prefetchHref(href: string): void {
    router.prefetch(href)
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
      <div className="relative md:hidden">
        <div className="space-y-2">
          {venues.length === 0 ? (
            <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
              No venues found for this organization yet.
            </GradientCard>
          ) : (
            venues.map((venue) => {
              const selectedTeamVenueHref =
                venue.teamVenueId !== null
                  ? buildVenueDetailHref({
                      scope,
                      teamVenueId: venue.teamVenueId,
                      tab: "camps",
                    })
                  : null

              return (
                <GradientCard
                  key={venue.id}
                  className="px-3 py-3"
                >
                  <div className="space-y-2">
                    <div className="min-w-0">
                      {selectedTeamVenueHref ? (
                        <Link
                          href={selectedTeamVenueHref}
                          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                          onMouseEnter={() => prefetchHref(selectedTeamVenueHref)}
                          onFocus={() => prefetchHref(selectedTeamVenueHref)}
                        >
                          {venue.name}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium">{venue.name}</p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {formatVenueLocation(venue)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                      <span
                        className={
                          venue.is_active
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {venue.is_active ? "Active" : "Inactive"}
                      </span>
                      <TeamContextBadges teams={venue.teamContexts} />
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
                aria-label="Load more venues"
                className="h-11 w-full"
                onClick={() => {
                  startLoadMoreTransition(() => {
                    router.push(buildPageHref(currentPage + 1, true))
                  })
                }}
              >
                {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
                <span>{isLoadingMore ? "Loading more..." : "Load more venues"}</span>
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
          className={
            isPaginationBusy
              ? "pointer-events-none select-none opacity-40 transition-opacity"
              : "transition-opacity"
          }
        >
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[22.5%]" />
              <col className="w-[32.5%]" />
              <col className="w-[12%]" />
              <col className="w-[33%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Venue</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-sm text-muted-foreground">
                    No venues found for this organization yet.
                  </TableCell>
                </TableRow>
              ) : (
                venues.map((venue) => {
                  const selectedTeamVenueHref =
                    venue.teamVenueId !== null
                      ? buildVenueDetailHref({
                          scope,
                          teamVenueId: venue.teamVenueId,
                          tab: "camps",
                        })
                      : null

                  return (
                    <TableRow key={venue.id}>
                      <TableCell className="font-medium">
                        {selectedTeamVenueHref ? (
                          <Link
                            href={selectedTeamVenueHref}
                            className="underline-offset-4 hover:underline"
                            onMouseEnter={() => prefetchHref(selectedTeamVenueHref)}
                            onFocus={() => prefetchHref(selectedTeamVenueHref)}
                          >
                            {venue.name}
                          </Link>
                        ) : (
                          venue.name
                        )}
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={formatVenueLocation(venue)}
                      >
                        {formatVenueLocation(venue)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            venue.is_active
                              ? "text-emerald-700"
                              : "text-muted-foreground"
                          }
                        >
                          {venue.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TeamContextBadges teams={venue.teamContexts} />
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
              aria-label="Loading venues page"
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
