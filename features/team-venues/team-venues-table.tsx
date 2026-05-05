"use client"

import * as React from "react"
import { MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { createTeamVenueLinkAction } from "@/features/team-venues/actions"
import type {
  TeamVenueCreateOption,
  TeamVenueListItem,
} from "@/features/team-venues/data"
import { buildVenueDetailHref } from "@/features/venues/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TeamVenuesTableProps = {
  linkedVenues: TeamVenueListItem[]
  noTeamSelected: boolean
  toolbar?: ReactNode
  selectedVenueId?: string
  scope: NavigationScope
  currentYear: number
}

function formatLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

export function CreateTeamVenueDialog({
  availableVenueOptions,
  scope,
  selectedVenueId,
  disabled,
}: {
  availableVenueOptions: TeamVenueCreateOption[]
  scope: NavigationScope
  selectedVenueId?: string
  disabled: boolean
}) {
  const [venueId, setVenueId] = React.useState("")

  const canSubmit = venueId.length > 0 && !disabled

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link venue to team</DialogTitle>
          <DialogDescription>
            Select an organization venue to make it available to this team.
          </DialogDescription>
        </DialogHeader>

        <form action={createTeamVenueLinkAction} className="space-y-4">
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedVenueId ? (
            <input type="hidden" name="scopeVenueId" value={selectedVenueId} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="venueId">Venue</Label>
            <select
              id="venueId"
              name="venueId"
              required
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              className="h-7 w-full rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] outline-none ring-ring/50 transition-colors focus-visible:ring-[3px]"
            >
              <option value="">Select venue</option>
              {availableVenueOptions.map((venueOption) => (
                <option key={venueOption.venueId} value={venueOption.venueId}>
                  {venueOption.name} — {formatLocation(venueOption.city, venueOption.country)}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              Link venue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamVenuesTable({
  linkedVenues,
  noTeamSelected,
  toolbar,
  selectedVenueId,
  scope,
  currentYear,
}: TeamVenuesTableProps) {
  const router = useRouter()

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Venues</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Venue</TableHead>
              <TableHead>Location</TableHead>
              <TableHead># Camps ({currentYear})</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedVenues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-sm text-muted-foreground">
                  {noTeamSelected
                    ? "No team selected. Choose a team to view linked venues."
                    : selectedVenueId
                    ? "No linked venue record found for this team and selected venue."
                    : "No venues linked to this team yet."}
                </TableCell>
              </TableRow>
            ) : (
              linkedVenues.map((item) => {
                const venueDetailHref = buildVenueDetailHref({
                  scope,
                  venueId: item.venueId,
                  tab: "camps",
                })

                return (
                  <TableRow
                    key={item.id}
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
                    <TableCell className="font-medium">{item.venueName}</TableCell>
                    <TableCell>{formatLocation(item.city, item.country)}</TableCell>
                    <TableCell>{item.campCountCurrentYear}</TableCell>
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
