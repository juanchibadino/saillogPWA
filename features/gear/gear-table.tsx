"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type TeamGearListItem,
  type TeamGearTwsOption,
} from "@/features/gear/shared"
import { buildTeamGearPageHref } from "@/features/gear/list-route-state.mjs"
import { buildGearProgressModel } from "@/features/gear/progress-core.mjs"
import { GearActionsMenu } from "@/features/gear/gear-form-dialogs"
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
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const GEAR_TYPE_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

const GEAR_STATUS_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

type TeamGearPaginationItem = number | "ellipsis-start" | "ellipsis-end"

function formatBarcodeLine(gearItem: TeamGearListItem): string | null {
  return gearItem.barcode?.trim() ? gearItem.barcode.trim() : null
}

function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0
  return `${Math.round(safeValue)}%`
}

function formatMetricName(
  metric: TeamGearListItem["alertRules"][number]["metric"],
): string {
  return metric === "usage_minutes" ? "Minutes" : "Used"
}

function formatMetricUsageValue(input: {
  metric: TeamGearListItem["alertRules"][number]["metric"]
  value: number
}): string {
  if (input.metric === "usage_minutes") {
    return `${Math.round(input.value)}m`
  }

  const formattedValue = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(input.value)

  return `${formattedValue}u`
}

type GearProgressRule = TeamGearListItem["alertRules"][number]

type GearProgressModel = {
  rule: GearProgressRule | null
  usageValue: number
  thresholdValue: number
  rawPercent: number
  visualPercent: number
  indicatorClassName: string
}

function GearUsageProgress({ gearItem }: { gearItem: TeamGearListItem }) {
  const model = buildGearProgressModel(gearItem) as GearProgressModel
  const progressLabel = model.rule ? formatPercent(model.visualPercent) : "0%"
  const ariaLabel = model.rule
    ? `${gearItem.name} usage ${progressLabel}.`
    : `${gearItem.name} usage. No threshold configured.`
  const tooltipMetric = model.rule?.metric ?? "usage_minutes"
  const tooltipUsageValue = model.rule ? model.usageValue : gearItem.usageMinutes

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        }
        aria-label={ariaLabel}
      >
        <div className="min-w-32 space-y-1">
          <div className="flex items-center gap-2">
            <Progress
              value={model.visualPercent}
              indicatorClassName={model.indicatorClassName}
              className="h-2 min-w-24 flex-1"
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {progressLabel}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent align="start" className="block max-w-72 space-y-1">
        <p>
          {formatMetricName(tooltipMetric)}:{" "}
          {formatMetricUsageValue({
            metric: tooltipMetric,
            value: tooltipUsageValue,
          })}{" "}
          /{" "}
          {formatMetricUsageValue({
            metric: tooltipMetric,
            value: model.thresholdValue,
          })}
        </p>
      </TooltipContent>
    </Tooltip>
  )
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
  twsOptions,
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
  twsOptions: TeamGearTwsOption[]
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
            const barcodeLine = formatBarcodeLine(gearItem)

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

                    <GearUsageProgress gearItem={gearItem} />

                    {barcodeLine ? (
                      <p className="break-words text-xs text-muted-foreground">
                        {barcodeLine}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <GearActionsMenu
                      gearItem={gearItem}
                      twsOptions={twsOptions}
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
                <TableHead className="w-24 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {gearItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                gearItems.map((gearItem) => {
                  const barcodeLine = formatBarcodeLine(gearItem)

                  return (
                    <TableRow key={gearItem.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{gearItem.name}</p>
                          {barcodeLine ? (
                            <p className="text-xs text-muted-foreground">
                              {barcodeLine}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {GEAR_TYPE_LABEL_BY_VALUE.get(gearItem.gearType) ?? "—"}
                      </TableCell>
                      <TableCell className="min-w-44">
                        <GearUsageProgress gearItem={gearItem} />
                      </TableCell>
                      <TableCell>
                        {GEAR_STATUS_LABEL_BY_VALUE.get(gearItem.status) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <GearActionsMenu
                          gearItem={gearItem}
                          twsOptions={twsOptions}
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
