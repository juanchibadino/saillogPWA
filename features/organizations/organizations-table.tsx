"use client"

import { MoreHorizontalIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { OrganizationListItem } from "@/features/organizations/data"
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

export function OrganizationsTable({
  organizations,
  toolbar,
}: {
  organizations: OrganizationListItem[]
  toolbar?: ReactNode
}) {
  function getInitials(name: string): string {
    const words = name
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)

    if (words.length === 0) {
      return "OR"
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase()
    }

    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Organizations</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Organization</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                  No organizations found yet.
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 rounded-md">
                        {organization.avatar_url ? (
                          <AvatarImage src={organization.avatar_url} alt={organization.name} />
                        ) : null}
                        <AvatarFallback className="rounded-md bg-blue-600 text-[10px] font-medium text-white">
                          {getInitials(organization.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{organization.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{organization.slug}</TableCell>
                  <TableCell>
                    <span
                      className={
                        organization.is_active ? "text-emerald-700" : "text-muted-foreground"
                      }
                    >
                      {organization.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>{organization.teamCount}</TableCell>
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
