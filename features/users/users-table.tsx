"use client"

import { MoreHorizontalIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { CrewListItem, CrewTeamOption } from "@/features/users/data"
import { CrewActionsMenu } from "@/features/users/user-form-dialogs"
import type { NavigationScope } from "@/lib/navigation/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return "CR"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase()
}

function formatRoleLabel(role: CrewListItem["role"]): string {
  if (role === "team_admin") {
    return "Team Admin"
  }

  if (role === "coach") {
    return "Coach"
  }

  return "Crew"
}

export function UsersTable({
  crews,
  teamOptions,
  canManageUsers,
  toolbar,
  scope,
  selectedTeamId,
}: {
  crews: CrewListItem[]
  teamOptions: CrewTeamOption[]
  canManageUsers: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedTeamId?: string
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Team Members</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Avatar</TableHead>
              <TableHead>Full name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {crews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                  No crew members found for this scope.
                </TableCell>
              </TableRow>
            ) : (
              crews.map((crew) => (
                <TableRow key={crew.membershipId}>
                  <TableCell>
                    <Avatar className="size-8">
                      {crew.avatarUrl ? (
                        <AvatarImage src={crew.avatarUrl} alt={crew.fullName} />
                      ) : null}
                      <AvatarFallback>{getInitials(crew.fullName)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{crew.fullName}</TableCell>
                  <TableCell>{crew.teamName}</TableCell>
                  <TableCell>{formatRoleLabel(crew.role)}</TableCell>
                  <TableCell className="text-right">
                    {canManageUsers ? (
                      <CrewActionsMenu
                        crew={crew}
                        teamOptions={teamOptions}
                        scope={scope}
                        selectedTeamId={selectedTeamId}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
