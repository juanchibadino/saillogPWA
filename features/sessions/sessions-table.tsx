"use client"

import Link from "next/link"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  cloneElement,
  isValidElement,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react"

import type {
  TeamSessionCampOption,
  TeamSessionHighlightFilter,
  TeamSessionListItem,
} from "@/features/sessions/data"
import {
  CreateSessionDialog,
  SessionActionsMenu,
} from "@/features/sessions/session-form-dialogs"
import { buildTeamSessionsPageHref } from "@/features/sessions/list-route-state.mjs"
import type { TeamSessionsToolbarNavigationProps } from "@/features/sessions/team-sessions-toolbar"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
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

type TeamSessionsTableProps = {
  sessions: TeamSessionListItem[]
  campOptions: TeamSessionCampOption[]
  canManageSessions: boolean
  noTeamSelected: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  returnPath?: string
}

type TeamSessionsPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

type PendingFilterNavigation = {
  fromHref: string
  toHref: string
}

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function formatSessionTypeLabel(value: TeamSessionListItem["sessionType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatNetTime(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedVenueId?: string
  selectedCampId?: string
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view sessions."
  }

  if (input.selectedCampId) {
    return "No sessions found for the selected camp."
  }

  if (input.selectedVenueId) {
    return "No sessions found for the selected venue."
  }

  return "No sessions found for this team yet."
}

function buildTeamSessionsPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamSessionsPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamSessionsPaginationItem[] = [1]
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

export function TeamSessionsTable({
  sessions,
  campOptions,
  canManageSessions,
  noTeamSelected,
  toolbar,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  pageCount,
  hasPreviousPage,
  hasNextPage,
  returnPath,
}: TeamSessionsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [navigatingSessionId, setNavigatingSessionId] = useState<string | null>(null)
  const [, startSessionNavigationTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const [isFilterNavigationPending, startFilterNavigationTransition] = useTransition()
  const [pendingFilterNavigation, setPendingFilterNavigation] =
    useState<PendingFilterNavigation | null>(null)
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedVenueId,
    selectedCampId,
  })
  const createDisabled =
    noTeamSelected || !canManageSessions || campOptions.length === 0
  const paginationItems = buildTeamSessionsPaginationItems(currentPage, pageCount)
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const isFilterNavigationBusy =
    isFilterNavigationPending ||
    pendingFilterNavigation?.fromHref === currentHref
  const isTableNavigationBusy = isPaginationBusy || isFilterNavigationBusy
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPage: number, includeLoadMore = false): string {
    return buildTeamSessionsPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage,
      includeLoadMore,
    })
  }

  function navigateToSession(sessionId: string, detailHref: string): void {
    setNavigatingSessionId(sessionId)
    startSessionNavigationTransition(() => {
      router.push(detailHref)
    })
  }

  function prefetchSession(detailHref: string): void {
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

  function navigateToFilterHref(href: string): void {
    const nextHref = normalizeInternalHref(href)

    if (isTableNavigationBusy || nextHref === currentHref) {
      return
    }

    setPendingFilterNavigation({
      fromHref: currentHref,
      toHref: nextHref,
    })
    startFilterNavigationTransition(() => {
      router.push(href)
    })
  }

  const renderedToolbar =
    toolbar && isValidElement<TeamSessionsToolbarNavigationProps>(toolbar)
      ? cloneElement(
          toolbar as ReactElement<TeamSessionsToolbarNavigationProps>,
          {
            isNavigating: isTableNavigationBusy,
            onNavigate: navigateToFilterHref,
          },
        )
      : toolbar

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end gap-2 md:justify-between">
        <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>
        {renderedToolbar ? <div className="w-full md:w-auto">{renderedToolbar}</div> : null}
      </div>

      <div
        aria-busy={isFilterNavigationBusy}
        className="relative md:hidden"
      >
        <div
          aria-disabled={isFilterNavigationBusy}
          className={cn(
            "space-y-2 transition-opacity",
            isFilterNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          {sessions.length === 0 ? (
            <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </GradientCard>
          ) : (
            sessions.map((session) => {
              const detailHref = buildSessionDetailHref({
                scope,
                sessionId: session.id,
              })
              const isNavigatingToSession = navigatingSessionId === session.id

              return (
                <GradientCard
                  key={session.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingToSession}
                  className={cn(
                    "cursor-pointer px-3 py-3 transition-colors hover:bg-muted/30",
                    isNavigatingToSession && "opacity-80",
                    session.highlightedByCoach &&
                      "border-emerald-400/70 bg-emerald-50/40 hover:bg-emerald-100/50 dark:border-emerald-500/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30",
                  )}
                  onMouseEnter={() => prefetchSession(detailHref)}
                  onFocus={() => prefetchSession(detailHref)}
                  onClick={() => {
                    navigateToSession(session.id, detailHref)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigateToSession(session.id, detailHref)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatDateLabel(session.sessionDate)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.campName} · {session.venueName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatSessionTypeLabel(session.sessionType)} ·{" "}
                        <span className="tabular-nums">
                          {formatNetTime(session.netTimeMinutes)}
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
                      {isNavigatingToSession ? (
                        <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : (
                        <SessionActionsMenu
                          session={session}
                          campOptions={campOptions}
                          scope={scope}
                          selectedVenueId={selectedVenueId}
                          selectedCampId={selectedCampId}
                          selectedHighlight={selectedHighlight}
                          currentPage={currentPage}
                          returnPath={returnPath}
                          canEditSession={canManageSessions}
                          canDeleteSession={canManageSessions}
                          editSurface="drawer"
                          triggerClassName="h-11 w-11"
                        />
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
                disabled={isLoadingMore || isFilterNavigationBusy}
                aria-label="Load more sessions"
                className="h-11 w-full"
                onClick={() => {
                  startLoadMoreTransition(() => {
                    router.push(buildPageHref(currentPage + 1, true))
                  })
                }}
              >
                {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
                <span>{isLoadingMore ? "Loading more..." : "Load more sessions"}</span>
              </Button>
            </div>
          ) : null}
        </div>
        {isFilterNavigationBusy ? (
          <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
            <div
              role="status"
              aria-label="Loading filtered sessions"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      <GradientCard
        aria-busy={isTableNavigationBusy}
        className="relative hidden overflow-hidden p-0 md:block"
      >
        <div
          aria-disabled={isTableNavigationBusy}
          className={cn(
            "transition-opacity",
            isTableNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Camp</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Net Time</TableHead>
                <TableHead>Highlight</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => {
                  const detailHref = buildSessionDetailHref({
                    scope,
                    sessionId: session.id,
                  })
                  const isNavigatingToSession = navigatingSessionId === session.id

                  return (
                    <TableRow
                      key={session.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingToSession}
                      className={cn(
                        "cursor-pointer",
                        isNavigatingToSession && "opacity-80",
                        session.highlightedByCoach &&
                          "bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30",
                      )}
                      onMouseEnter={() => prefetchSession(detailHref)}
                      onFocus={() => prefetchSession(detailHref)}
                      onClick={() => {
                        navigateToSession(session.id, detailHref)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          navigateToSession(session.id, detailHref)
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
                            navigateToSession(session.id, detailHref)
                          }}
                          onMouseEnter={() => prefetchSession(detailHref)}
                          onFocus={() => prefetchSession(detailHref)}
                        >
                          {formatDateLabel(session.sessionDate)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatSessionTypeLabel(session.sessionType)}</TableCell>
                      <TableCell>{session.campName}</TableCell>
                      <TableCell>{session.venueName}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatNetTime(session.netTimeMinutes)}
                      </TableCell>
                      <TableCell>
                        {session.highlightedByCoach ? (
                          <span className="text-emerald-700">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
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
                        {isNavigatingToSession ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : (
                          <SessionActionsMenu
                            session={session}
                            campOptions={campOptions}
                            scope={scope}
                            selectedVenueId={selectedVenueId}
                            selectedCampId={selectedCampId}
                            selectedHighlight={selectedHighlight}
                            currentPage={currentPage}
                            returnPath={returnPath}
                            canEditSession={canManageSessions}
                            canDeleteSession={canManageSessions}
                            editSurface="dialog"
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
        {isTableNavigationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading sessions page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

      {pageCount > 1 ? (
        <Pagination
          aria-busy={isTableNavigationBusy}
          className="hidden justify-start md:flex"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage || isTableNavigationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isTableNavigationBusy}
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
                disabled={!hasNextPage || isTableNavigationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      <CreateSessionDialog
        campOptions={campOptions}
        scope={scope}
        selectedVenueId={selectedVenueId}
        selectedCampId={selectedCampId}
        selectedHighlight={selectedHighlight}
        currentPage={currentPage}
        returnPath={returnPath}
        disabled={createDisabled || isTableNavigationBusy}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
