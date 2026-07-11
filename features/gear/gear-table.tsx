"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type TeamGearListItem,
} from "@/features/gear/shared"
import { buildTeamGearPageHref } from "@/features/gear/list-route-state.mjs"
import { GearActionsMenu } from "@/features/gear/gear-form-dialogs"
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

const GEAR_TYPE_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

const GEAR_STATUS_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

const GEAR_CONDITION_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_CONDITION_OPTIONS.map((option) => [option.value, option.label]),
)

type TeamGearPaginationItem = number | "ellipsis-start" | "ellipsis-end"

function formatUsage(input: { usageCount: number; usageMinutes: number }): string {
  const hours = Math.floor(input.usageMinutes / 60)
  const minutes = input.usageMinutes % 60
  const usageLabel = `${input.usageCount} ${input.usageCount === 1 ? "use" : "uses"}`
  const timeLabel = `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`

  return `${usageLabel} · ${timeLabel}`
}

function formatIdentifierLine(gearItem: TeamGearListItem): string | null {
  const parts = [
    gearItem.serialNumber ? `SN ${gearItem.serialNumber}` : null,
    gearItem.barcode ? `BC ${gearItem.barcode}` : null,
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? parts.join(" · ") : null
}

function renderAlertBadge(gearItem: TeamGearListItem) {
  if (gearItem.alertState === "critical") {
    return <Badge variant="destructive">Critical ({gearItem.triggeredAlertCount})</Badge>
  }

  if (gearItem.alertState === "warning") {
    return (
      <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
        Warning ({gearItem.triggeredAlertCount})
      </Badge>
    )
  }

  return <span className="text-muted-foreground">None</span>
}

function resolveEmptyMessage(input: { noTeamSelected: boolean }): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view gear items."
  }

  return "No gear items found for this filter."
}

function buildTeamGearPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamGearPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamGearPaginationItem[] = [1]
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

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

export function TeamGearTable({
  gearItems,
  canManageGear,
  noTeamSelected,
  toolbar,
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  pageCount,
  hasPreviousPage,
  hasNextPage,
  loadMoreMode,
  hideChrome = false,
}: {
  gearItems: TeamGearListItem[]
  canManageGear: boolean
  noTeamSelected: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
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
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const emptyMessage = resolveEmptyMessage({ noTeamSelected })
  const paginationItems = buildTeamGearPaginationItems(currentPage, pageCount)
  const isPageNavigationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamGearPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPageNavigationBusy ||
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
          <h2 className="text-lg font-semibold">Gear</h2>
          {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="space-y-2 md:hidden">
        {gearItems.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </GradientCard>
        ) : (
          gearItems.map((gearItem) => {
            const identifierLine = formatIdentifierLine(gearItem)

            return (
              <GradientCard key={gearItem.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{gearItem.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {GEAR_TYPE_LABEL_BY_VALUE.get(gearItem.gearType) ?? "Unknown type"} ·{" "}
                        {GEAR_STATUS_LABEL_BY_VALUE.get(gearItem.status) ?? "Unknown status"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {GEAR_CONDITION_LABEL_BY_VALUE.get(gearItem.condition) ??
                          "Unknown condition"}
                      </span>
                      <span className="tabular-nums">
                        {formatUsage({
                          usageCount: gearItem.usageCount,
                          usageMinutes: gearItem.usageMinutes,
                        })}
                      </span>
                    </div>

                    <div>{renderAlertBadge(gearItem)}</div>

                    {identifierLine ? (
                      <p className="break-words text-xs text-muted-foreground">
                        {identifierLine}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <GearActionsMenu
                      gearItem={gearItem}
                      scope={scope}
                      selectedType={selectedType}
                      selectedStatusFilter={selectedStatusFilter}
                      selectedCondition={selectedCondition}
                      selectedAlert={selectedAlert}
                      currentPage={currentPage}
                      loadMoreMode={loadMoreMode}
                      gearTypeOptions={TEAM_GEAR_TYPE_OPTIONS}
                      gearStatusOptions={TEAM_GEAR_STATUS_OPTIONS}
                      gearConditionOptions={TEAM_GEAR_CONDITION_OPTIONS}
                      canManageGear={canManageGear}
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
              aria-label="Load more gear"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more gear"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <GradientCard
        aria-busy={isPageNavigationBusy}
        className="relative hidden overflow-hidden p-0 md:block"
      >
        <div
          aria-disabled={isPageNavigationBusy}
          className={cn(
            "transition-opacity",
            isPageNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {gearItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                gearItems.map((gearItem) => {
                  const identifierLine = formatIdentifierLine(gearItem)

                  return (
                    <TableRow key={gearItem.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{gearItem.name}</p>
                          {identifierLine ? (
                            <p className="text-xs text-muted-foreground">
                              {identifierLine}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {GEAR_TYPE_LABEL_BY_VALUE.get(gearItem.gearType) ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatUsage({
                          usageCount: gearItem.usageCount,
                          usageMinutes: gearItem.usageMinutes,
                        })}
                      </TableCell>
                      <TableCell>
                        {GEAR_STATUS_LABEL_BY_VALUE.get(gearItem.status) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {GEAR_CONDITION_LABEL_BY_VALUE.get(gearItem.condition) ?? "—"}
                      </TableCell>
                      <TableCell>{renderAlertBadge(gearItem)}</TableCell>
                      <TableCell className="text-right">
                        <GearActionsMenu
                          gearItem={gearItem}
                          scope={scope}
                          selectedType={selectedType}
                          selectedStatusFilter={selectedStatusFilter}
                          selectedCondition={selectedCondition}
                          selectedAlert={selectedAlert}
                          currentPage={currentPage}
                          loadMoreMode={loadMoreMode}
                          gearTypeOptions={TEAM_GEAR_TYPE_OPTIONS}
                          gearStatusOptions={TEAM_GEAR_STATUS_OPTIONS}
                          gearConditionOptions={TEAM_GEAR_CONDITION_OPTIONS}
                          canManageGear={canManageGear}
                          surface="sheet"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {isPageNavigationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading gear page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

      {pageCount > 1 ? (
        <Pagination
          aria-busy={isPageNavigationBusy}
          className="hidden justify-start md:flex"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage || isPageNavigationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isPageNavigationBusy}
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
                disabled={!hasNextPage || isPageNavigationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
