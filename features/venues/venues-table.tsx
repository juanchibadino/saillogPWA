"use client"

import { MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import type {
  VenueListItem,
} from "@/features/venues/data"
import { formatVenueLocation } from "@/features/venues/location"
import { buildTeamVenuesHref, buildVenueDetailHref } from "@/features/venues/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type VenuesTableProps = {
  venues: VenueListItem[]
  toolbar?: ReactNode
  scope: NavigationScope
}

export function VenuesTable({
  venues,
  toolbar,
  scope,
}: VenuesTableProps) {
  const router = useRouter()

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Venues</h2>
        </div>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Venue</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team Context</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {venues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                  No venues found for this organization yet.
                </TableCell>
              </TableRow>
            ) : (
              venues.map((venue) => {
                const venueDetailHref = buildVenueDetailHref({
                  scope,
                  venueId: venue.id,
                  tab: "camps",
                })

                return (
                  <TableRow
                    key={venue.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => {
                      router.push(venueDetailHref)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        router.push(venueDetailHref)
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={venueDetailHref}
                        className="underline-offset-4 hover:underline"
                      >
                        {venue.name}
                      </Link>
                    </TableCell>
                    <TableCell>{venue.organizationName}</TableCell>
                    <TableCell>{formatVenueLocation(venue)}</TableCell>
                    <TableCell>
                      <span
                        className={
                          venue.is_active
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {venue.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={buildTeamVenuesHref(scope, venue.id)}
                        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        View team venues
                      </Link>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                    >
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
