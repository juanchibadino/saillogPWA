"use client"

import { MoreHorizontalIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { TeamListItem } from "@/features/teams/data"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function TeamsTable({
  teams,
  toolbar,
}: {
  teams: TeamListItem[]
  toolbar?: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Teams</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Team</TableHead>
              <TableHead>Team Type</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                  No teams found for this organization yet.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.team_type?.trim() || "—"}</TableCell>
                  <TableCell>{team.slug}</TableCell>
                  <TableCell>
                    <span className={team.is_active ? "text-emerald-700" : "text-muted-foreground"}>
                      {team.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      aria-label="More actions unavailable"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
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
