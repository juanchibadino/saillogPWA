"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type TeamGearListItem,
} from "@/features/gear/shared"
import { GearActionsMenu } from "@/features/gear/gear-form-dialogs"
import type { NavigationScope } from "@/lib/navigation/types"
import { Badge } from "@/components/ui/badge"
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

const GEAR_TYPE_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

const GEAR_STATUS_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

const GEAR_CONDITION_LABEL_BY_VALUE = new Map(
  TEAM_GEAR_CONDITION_OPTIONS.map((option) => [option.value, option.label]),
)

function formatUsage(input: { usageCount: number; usageMinutes: number }): string {
  const hours = Math.floor(input.usageMinutes / 60)
  const minutes = input.usageMinutes % 60
  const usageLabel = `${input.usageCount} ${input.usageCount === 1 ? "use" : "uses"}`
  const timeLabel = `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`

  return `${usageLabel} · ${timeLabel}`
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
  hasPreviousPage,
  hasNextPage,
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
  hasPreviousPage: boolean
  hasNextPage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildPageHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString())

    if (nextPage <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(nextPage))
    }

    const nextSearch = params.toString()
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Gear</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
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
                  {noTeamSelected
                    ? "No team selected. Choose a team to view gear items."
                    : "No gear items found for this filter."}
                </TableCell>
              </TableRow>
            ) : (
              gearItems.map((gearItem) => (
                <TableRow key={gearItem.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{gearItem.name}</p>
                      {gearItem.serialNumber || gearItem.barcode ? (
                        <p className="text-xs text-muted-foreground">
                          {gearItem.serialNumber ? `SN ${gearItem.serialNumber}` : ""}
                          {gearItem.serialNumber && gearItem.barcode ? " · " : ""}
                          {gearItem.barcode ? `BC ${gearItem.barcode}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{GEAR_TYPE_LABEL_BY_VALUE.get(gearItem.gearType) ?? "—"}</TableCell>
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
                      gearTypeOptions={TEAM_GEAR_TYPE_OPTIONS}
                      gearStatusOptions={TEAM_GEAR_STATUS_OPTIONS}
                      gearConditionOptions={TEAM_GEAR_CONDITION_OPTIONS}
                      canManageGear={canManageGear}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasPreviousPage || hasNextPage ? (
        <Pagination className="justify-start">
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
    </section>
  )
}
