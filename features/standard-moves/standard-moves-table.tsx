"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { StandardMoveActionsMenu } from "@/features/standard-moves/standard-moves-form-dialogs"
import type {
  TeamStandardMoveListItem,
  TeamStandardMoveStatusFilter,
} from "@/features/standard-moves/data"
import { buildTeamStandardMovesPageHref } from "@/features/standard-moves/list-route-state.mjs"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
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

type TeamStandardMovesPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

type StandardMoveUsageCamp = {
  id: string
  name: string
  usageCount: number
}

type StandardMoveUsageData = {
  itemId: string
  usageCount: number
  camps: StandardMoveUsageCamp[]
}

type StandardMoveUsageLoadState =
  | {
      status: "loading"
    }
  | {
      status: "loaded"
      data: StandardMoveUsageData
    }
  | {
      status: "error"
      message: string
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isStandardMoveUsageCamp(value: unknown): value is StandardMoveUsageCamp {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.usageCount === "number"
  )
}

function isStandardMoveUsageData(value: unknown): value is StandardMoveUsageData {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.itemId === "string" &&
    typeof value.usageCount === "number" &&
    Array.isArray(value.camps) &&
    value.camps.every(isStandardMoveUsageCamp)
  )
}

function buildStandardMoveUsageUrl(input: {
  scope: NavigationScope
  standardMoveId: string
}): string | null {
  if (input.scope.activeTeamId === null) {
    return null
  }

  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)

  return `/api/team-standard-moves/${encodeURIComponent(
    input.standardMoveId,
  )}/usage?${params.toString()}`
}

async function resolveStandardMoveUsageError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()

    if (isRecord(payload) && typeof payload.detail === "string") {
      return payload.detail
    }

    if (isRecord(payload) && typeof payload.error === "string") {
      return payload.error
    }
  } catch {
    // Ignore malformed error bodies and use the HTTP status fallback.
  }

  return `Could not load camp usage (${response.status})`
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

function StandardMoveCampUsagePanel({
  standardMove,
  usageState,
  onRetry,
}: {
  standardMove: TeamStandardMoveListItem
  usageState: StandardMoveUsageLoadState | undefined
  onRetry: () => void
}) {
  if (standardMove.usageCount === 0) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Not used in camps yet.
      </div>
    )
  }

  if (!usageState || usageState.status === "loading") {
    return (
      <div className="space-y-2 rounded-lg border border-dashed px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          <span>Loading camps...</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-6 w-32 rounded-full bg-muted" />
        </div>
      </div>
    )
  }

  if (usageState.status === "error") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-xs">
        <span className="text-destructive">{usageState.message}</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={(event) => {
            event.stopPropagation()
            onRetry()
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">Used in camps</p>
      {usageState.data.camps.length === 0 ? (
        <p className="text-xs text-muted-foreground">No camps found for this usage.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {usageState.data.camps.map((camp) => (
            <Badge
              key={camp.id}
              variant="outline"
              className="max-w-full whitespace-normal break-words px-2.5 py-1 text-xs"
            >
              {camp.usageCount > 1 ? `${camp.name} · ${camp.usageCount}` : camp.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedStatusFilter: TeamStandardMoveStatusFilter
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view standard moves."
  }

  if (input.selectedStatusFilter === "archived") {
    return "No archived standard moves found for this team."
  }

  if (input.selectedStatusFilter === "all") {
    return "No standard moves found for this team yet."
  }

  return "No active standard moves found for this team."
}

function buildTeamStandardMovesPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamStandardMovesPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamStandardMovesPaginationItem[] = [1]
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

export function TeamStandardMovesTable({
  moves,
  canManageStandardMoves,
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
  moves: TeamStandardMoveListItem[]
  canManageStandardMoves: boolean
  noTeamSelected: boolean
  selectedStatusFilter: TeamStandardMoveStatusFilter
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
  const [expandedMoveId, setExpandedMoveId] = React.useState<string | null>(null)
  const [usageStateByMoveId, setUsageStateByMoveId] = React.useState<
    Partial<Record<string, StandardMoveUsageLoadState>>
  >({})
  const usageAbortControllersRef = React.useRef<Map<string, AbortController>>(
    new Map(),
  )
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedStatusFilter,
  })
  const paginationItems = buildTeamStandardMovesPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamStandardMovesPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  React.useEffect(() => {
    const usageAbortControllers = usageAbortControllersRef.current

    return () => {
      usageAbortControllers.forEach((controller) => {
        controller.abort()
      })
      usageAbortControllers.clear()
    }
  }, [])

  async function loadStandardMoveUsage(
    standardMove: TeamStandardMoveListItem,
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (standardMove.usageCount === 0) {
      return
    }

    const usageUrl = buildStandardMoveUsageUrl({
      scope,
      standardMoveId: standardMove.id,
    })

    if (!usageUrl) {
      return
    }

    const currentState = usageStateByMoveId[standardMove.id]

    if (
      !options.force &&
      (currentState?.status === "loading" || currentState?.status === "loaded")
    ) {
      return
    }

    usageAbortControllersRef.current.get(standardMove.id)?.abort()

    const controller = new AbortController()
    usageAbortControllersRef.current.set(standardMove.id, controller)
    setUsageStateByMoveId((current) => ({
      ...current,
      [standardMove.id]: {
        status: "loading",
      },
    }))

    try {
      const response = await fetch(usageUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(await resolveStandardMoveUsageError(response))
      }

      const payload: unknown = await response.json()
      const data = isRecord(payload) ? payload.data : null

      if (!isStandardMoveUsageData(data) || data.itemId !== standardMove.id) {
        throw new Error("Invalid camp usage response.")
      }

      setUsageStateByMoveId((current) => ({
        ...current,
        [standardMove.id]: {
          data,
          status: "loaded",
        },
      }))
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      setUsageStateByMoveId((current) => ({
        ...current,
        [standardMove.id]: {
          message:
            error instanceof Error ? error.message : "Could not load camp usage.",
          status: "error",
        },
      }))
    } finally {
      if (usageAbortControllersRef.current.get(standardMove.id) === controller) {
        usageAbortControllersRef.current.delete(standardMove.id)
      }
    }
  }

  function toggleExpandedStandardMove(standardMove: TeamStandardMoveListItem): void {
    if (expandedMoveId === standardMove.id) {
      setExpandedMoveId(null)
      return
    }

    setExpandedMoveId(standardMove.id)
    void loadStandardMoveUsage(standardMove)
  }

  function handleStandardMoveCardKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    standardMove: TeamStandardMoveListItem,
  ): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    toggleExpandedStandardMove(standardMove)
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
          <h2 className="text-lg font-semibold">Standard Moves</h2>
          {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="space-y-2 md:hidden">
        {moves.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </GradientCard>
        ) : (
          moves.map((standardMove) => {
            const isExpanded = expandedMoveId === standardMove.id

            return (
              <GradientCard
                key={standardMove.id}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={`standard-move-expanded-${standardMove.id}`}
                className="cursor-pointer px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => {
                  toggleExpandedStandardMove(standardMove)
                }}
                onKeyDown={(event) => {
                  handleStandardMoveCardKeyDown(event, standardMove)
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="min-w-0 space-y-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isExpanded
                            ? "whitespace-normal break-words"
                            : "truncate",
                        )}
                      >
                        {standardMove.name}
                      </p>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          standardMove.description?.trim()
                            ? isExpanded
                              ? "whitespace-normal break-words"
                              : "line-clamp-2"
                            : "italic",
                        )}
                      >
                        {standardMove.description?.trim() || "No description"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Used{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {standardMove.usageCount}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTimeLabel(standardMove.updatedAt)}</span>
                    </div>

                    <div>{renderStatusBadge(standardMove.isActive)}</div>

                    {isExpanded ? (
                      <div id={`standard-move-expanded-${standardMove.id}`}>
                        <StandardMoveCampUsagePanel
                          standardMove={standardMove}
                          usageState={usageStateByMoveId[standardMove.id]}
                          onRetry={() => {
                            void loadStandardMoveUsage(standardMove, {
                              force: true,
                            })
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="shrink-0"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <StandardMoveActionsMenu
                      standardMove={standardMove}
                      scope={scope}
                      statusFilter={selectedStatusFilter}
                      currentPage={currentPage}
                      loadMoreMode={loadMoreMode}
                      canManageStandardMoves={canManageStandardMoves}
                      surface="drawer"
                      triggerClassName="h-11 w-11"
                    />
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
              aria-label="Load more standard moves"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>
                {isLoadingMore ? "Loading more..." : "Load more standard moves"}
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
              <col className="w-[58%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-normal">Name</TableHead>
                <TableHead className="whitespace-normal">Description</TableHead>
                <TableHead className="whitespace-normal">Used By</TableHead>
                <TableHead className="whitespace-normal">Updated</TableHead>
                <TableHead className="whitespace-normal">Status</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {moves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                moves.map((standardMove) => (
                  <TableRow key={standardMove.id}>
                    <TableCell className="max-w-0 whitespace-normal break-words align-top font-medium">
                      {standardMove.name}
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal break-words text-muted-foreground">
                      {standardMove.description && standardMove.description.trim().length > 0
                        ? standardMove.description
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {standardMove.usageCount}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {formatDateTimeLabel(standardMove.updatedAt)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {renderStatusBadge(standardMove.isActive)}
                    </TableCell>
                    <TableCell className="text-right whitespace-normal">
                      <StandardMoveActionsMenu
                        standardMove={standardMove}
                        scope={scope}
                        statusFilter={selectedStatusFilter}
                        currentPage={currentPage}
                        loadMoreMode={loadMoreMode}
                        canManageStandardMoves={canManageStandardMoves}
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
              aria-label="Loading standard moves page"
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
