"use client"

import type { ReactNode } from "react"

import { GradientCard } from "@/components/shared/gradient-card"
import { WindPatternActionsMenu } from "@/features/wind-patterns/wind-patterns-form-dialogs"
import type { TeamVenueWindPatternListItem } from "@/features/wind-patterns/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
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

function resolveEmptyMessage(selectedStatusFilter: string): string {
  if (selectedStatusFilter === "archived") {
    return "No archived wind patterns found for this venue."
  }

  if (selectedStatusFilter === "all") {
    return "No wind patterns found for this venue yet."
  }

  return "No active wind patterns found for this venue."
}

export function WindPatternsTable({
  patterns,
  canManageWindPatterns,
  selectedStatusFilter,
  toolbar,
  scope,
  teamVenueId,
  year,
}: {
  patterns: TeamVenueWindPatternListItem[]
  canManageWindPatterns: boolean
  selectedStatusFilter: string
  toolbar?: ReactNode
  scope: NavigationScope
  teamVenueId: string
  year?: number
}) {
  const emptyMessage = resolveEmptyMessage(selectedStatusFilter)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
            Wind Patterns
          </h1>
          <h2 className="hidden text-lg font-semibold md:block">Wind Patterns</h2>
          <p className="hidden text-sm text-muted-foreground md:block">
            Reusable venue patterns for this team.
          </p>
        </div>
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      </div>

      <div className="space-y-2 md:hidden">
        {patterns.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </GradientCard>
        ) : (
          patterns.map((windPattern) => (
            <GradientCard key={windPattern.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {windPattern.name}
                    </p>
                    {renderStatusBadge(windPattern.isActive)}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {windPattern.description && windPattern.description.trim().length > 0
                      ? windPattern.description
                      : "No description"}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Used ·{" "}
                      <span className="tabular-nums">{windPattern.usageCount}</span>
                    </span>
                    <span>Updated · {formatDateTimeLabel(windPattern.updatedAt)}</span>
                  </div>
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
                  <WindPatternActionsMenu
                    windPattern={windPattern}
                    scope={scope}
                    teamVenueId={teamVenueId}
                    statusFilter={selectedStatusFilter}
                    year={year}
                    canManageWindPatterns={canManageWindPatterns}
                  />
                </div>
              </div>
            </GradientCard>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              patterns.map((windPattern) => (
                <TableRow key={windPattern.id}>
                  <TableCell className="font-medium">{windPattern.name}</TableCell>
                  <TableCell>
                    {windPattern.description && windPattern.description.trim().length > 0
                      ? windPattern.description
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{windPattern.usageCount}</TableCell>
                  <TableCell>{formatDateTimeLabel(windPattern.updatedAt)}</TableCell>
                  <TableCell>{renderStatusBadge(windPattern.isActive)}</TableCell>
                  <TableCell className="text-right">
                    <WindPatternActionsMenu
                      windPattern={windPattern}
                      scope={scope}
                      teamVenueId={teamVenueId}
                      statusFilter={selectedStatusFilter}
                      year={year}
                      canManageWindPatterns={canManageWindPatterns}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
