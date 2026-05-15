"use client"

import type { ReactNode } from "react"

import { StandardMoveActionsMenu } from "@/features/standard-moves/standard-moves-form-dialogs"
import type { TeamStandardMoveListItem } from "@/features/standard-moves/data"
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

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedStatusFilter: string
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

export function TeamStandardMovesTable({
  moves,
  canManageStandardMoves,
  noTeamSelected,
  selectedStatusFilter,
  toolbar,
  scope,
}: {
  moves: TeamStandardMoveListItem[]
  canManageStandardMoves: boolean
  noTeamSelected: boolean
  selectedStatusFilter: string
  toolbar?: ReactNode
  scope: NavigationScope
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Std. Moves</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
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
            {moves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                  {resolveEmptyMessage({ noTeamSelected, selectedStatusFilter })}
                </TableCell>
              </TableRow>
            ) : (
              moves.map((standardMove) => (
                <TableRow key={standardMove.id}>
                  <TableCell className="font-medium">{standardMove.name}</TableCell>
                  <TableCell>
                    {standardMove.description && standardMove.description.trim().length > 0
                      ? standardMove.description
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{standardMove.usageCount}</TableCell>
                  <TableCell>{formatDateTimeLabel(standardMove.updatedAt)}</TableCell>
                  <TableCell>{renderStatusBadge(standardMove.isActive)}</TableCell>
                  <TableCell className="text-right">
                    <StandardMoveActionsMenu
                      standardMove={standardMove}
                      scope={scope}
                      statusFilter={selectedStatusFilter}
                      canManageStandardMoves={canManageStandardMoves}
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
