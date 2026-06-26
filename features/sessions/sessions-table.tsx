"use client"

import Link from "next/link"
import { Loader2Icon, MoreHorizontalIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"

import type {
  TeamSessionCampOption,
  TeamSessionListItem,
} from "@/features/sessions/data"
import {
  CreateSessionDialog,
  EditSessionDialog,
} from "@/features/sessions/session-form-dialogs"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
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
  currentPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
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

export function TeamSessionsTable({
  sessions,
  campOptions,
  canManageSessions,
  noTeamSelected,
  toolbar,
  scope,
  selectedVenueId,
  selectedCampId,
  currentPage,
  hasPreviousPage,
  hasNextPage,
}: TeamSessionsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [navigatingSessionId, setNavigatingSessionId] = useState<string | null>(null)
  const [, startSessionNavigationTransition] = useTransition()
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedVenueId,
    selectedCampId,
  })
  const createDisabled =
    noTeamSelected || !canManageSessions || campOptions.length === 0

  function buildPageHref(nextPage: number, includeLoadMore = false): string {
    const params = new URLSearchParams(searchParams.toString())

    if (nextPage <= 1) {
      params.delete("page")
      params.delete("loadMore")
    } else {
      params.set("page", String(nextPage))

      if (includeLoadMore) {
        params.set("loadMore", "1")
      } else {
        params.delete("loadMore")
      }
    }

    const nextSearch = params.toString()
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end gap-2 md:justify-between">
        <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>
        {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
      </div>

      <div className="space-y-2 md:hidden">
        {sessions.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          sessions.map((session) => {
            const detailHref = buildSessionDetailHref({
              scope,
              sessionId: session.id,
            })
            const isNavigatingToSession = navigatingSessionId === session.id

            return (
              <article
                key={session.id}
                role="link"
                tabIndex={0}
                aria-busy={isNavigatingToSession}
                className={cn(
                  "cursor-pointer rounded-xl border bg-card px-3 py-3 transition-colors hover:bg-muted/30",
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
                      <span className="tabular-nums">{formatNetTime(session.netTimeMinutes)}</span>
                    </p>
                  </div>

                  <div
                    className="shrink-0"
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
                    ) : canManageSessions ? (
                      <EditSessionDialog
                        session={session}
                        campOptions={campOptions}
                        scope={scope}
                        selectedVenueId={selectedVenueId}
                        selectedCampId={selectedCampId}
                        currentPage={currentPage}
                        iconOnly
                        surface="drawer"
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        aria-label="More actions unavailable"
                        className="h-11 w-11"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
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

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
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
                      ) : canManageSessions ? (
                        <EditSessionDialog
                          session={session}
                          campOptions={campOptions}
                          scope={scope}
                          selectedVenueId={selectedVenueId}
                          selectedCampId={selectedCampId}
                          currentPage={currentPage}
                          surface="dialog"
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

      {hasPreviousPage || hasNextPage ? (
        <Pagination className="hidden justify-start md:flex">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage}
                onClick={() => {
                  if (hasPreviousPage) {
                    router.push(buildPageHref(currentPage - 1))
                  }
                }}
              />
            </PaginationItem>

            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">Page {currentPage}</span>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                disabled={!hasNextPage}
                onClick={() => {
                  if (hasNextPage) {
                    router.push(buildPageHref(currentPage + 1))
                  }
                }}
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
        currentPage={currentPage}
        disabled={createDisabled}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
