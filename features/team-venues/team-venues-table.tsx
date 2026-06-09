"use client"

import * as React from "react"
import { MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import {
  createAndLinkTeamVenueAction,
  createTeamVenueLinkAction,
  deleteTeamVenueAction,
  updateTeamVenueAction,
} from "@/features/team-venues/actions"
import type {
  TeamVenueCreateOption,
  TeamVenueListItem,
  TeamVenueStatusFilter,
} from "@/features/team-venues/data"
import { useIsMobile } from "@/hooks/use-mobile"
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  canManageVenueRows: boolean
  toolbar?: ReactNode
  selectedStatusFilter: TeamVenueStatusFilter
  scope: NavigationScope
  currentYear: number
}

type NominatimLocation = {
  placeId: string
  displayName: string
  city: string
  country: string
  lat: string
  lon: string
}

function formatLocation(city: string, country: string): string {
  return `${city}, ${country}`
}

function normalizeText(value: string): string {
  return value.trim()
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedStatusFilter: TeamVenueStatusFilter
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view linked venues."
  }

  if (input.selectedStatusFilter === "active") {
    return "No active venues linked to this team yet."
  }

  return "No deprecated venues linked to this team."
}

export function CreateTeamVenueDialog({
  availableVenueOptions,
  scope,
  selectedStatusFilter,
  disabled,
}: {
  availableVenueOptions: TeamVenueCreateOption[]
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  disabled: boolean
}) {
  const [venueId, setVenueId] = React.useState("")
  const [venueName, setVenueName] = React.useState("")
  const [locationQuery, setLocationQuery] = React.useState("")
  const [selectedLocation, setSelectedLocation] =
    React.useState<NominatimLocation | null>(null)
  const [suggestions, setSuggestions] = React.useState<NominatimLocation[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [locationTouched, setLocationTouched] = React.useState(false)

  const canLinkExisting = venueId.length > 0 && !disabled
  const canCreateAndLink =
    venueName.trim().length > 0 && Boolean(selectedLocation) && !disabled
  const isMobile = useIsMobile()

  React.useEffect(() => {
    const query = locationQuery.trim()
    const selectedMatchesQuery =
      selectedLocation !== null && query === selectedLocation.displayName

    if (query.length < 2 || selectedMatchesQuery) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    const controller = new AbortController()

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)

      try {
        const response = await fetch(
          `/api/geocoding/nominatim?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          setSuggestions([])
          return
        }

        const payload = (await response.json()) as {
          results?: NominatimLocation[]
        }

        setSuggestions(payload.results ?? [])
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [locationQuery, selectedLocation])

  function handleLocationInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value

    setLocationQuery(value)
    setLocationTouched(true)

    if (selectedLocation && value !== selectedLocation.displayName) {
      setSelectedLocation(null)
    }
  }

  function handleLocationSelect(location: NominatimLocation) {
    setSelectedLocation(location)
    setLocationQuery(location.displayName)
    setSuggestions([])
    setLocationTouched(true)
  }

  function handleCreateAndBindSubmit(event: React.FormEvent<HTMLFormElement>) {
    setLocationTouched(true)

    if (!selectedLocation) {
      event.preventDefault()
    }
  }

  const createTeamVenueContent = (
    <div className="space-y-5">
      <div className="space-y-2">
        <form action={createTeamVenueLinkAction} className="space-y-3">
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />

          <div className="space-y-2">
            <Label htmlFor="venueId">Organization venue</Label>
            <select
              id="venueId"
              name="venueId"
              required
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px]"
            >
              <option value="">Select venue</option>
              {availableVenueOptions.map((venueOption) => (
                <option key={venueOption.venueId} value={venueOption.venueId}>
                  {venueOption.name} — {formatLocation(venueOption.city, venueOption.country)} (
                  {venueOption.isActive ? "Active" : "Deprecated"})
                </option>
              ))}
            </select>

            {availableVenueOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No unlinked organization venues are available for this team.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canLinkExisting}>
              Bind venue
            </Button>
          </div>
        </form>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Create new venue and bind</p>
        <form
          action={createAndLinkTeamVenueAction}
          className="space-y-3"
          onSubmit={handleCreateAndBindSubmit}
        >
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />

          <div className="space-y-2">
            <Label htmlFor="newVenueName">Name</Label>
            <Input
              id="newVenueName"
              name="name"
              required
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              maxLength={120}
              placeholder="Venue name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newVenueLocation">Location</Label>
            <div className="relative">
              <Input
                id="newVenueLocation"
                type="text"
                autoComplete="off"
                placeholder="Search city and country"
                value={locationQuery}
                onChange={handleLocationInputChange}
              />

              {suggestions.length > 0 ? (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-sm">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        handleLocationSelect(suggestion)
                      }}
                      className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {suggestion.displayName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {isSearching ? (
              <p className="text-xs text-muted-foreground">Searching locations...</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Choose a location from suggestions to set city and country.
              </p>
            )}

            {locationTouched && !selectedLocation ? (
              <p className="text-xs text-destructive">
                Select a valid location from the suggestion list.
              </p>
            ) : null}
          </div>

          <input type="hidden" name="city" value={selectedLocation?.city ?? ""} />
          <input type="hidden" name="country" value={selectedLocation?.country ?? ""} />

          <div className="flex justify-end">
            <Button type="submit" disabled={!canCreateAndLink}>
              Create and bind
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={disabled}
            className="h-9 px-3"
          >
            <PlusIcon className="size-4" />
            New
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New team venue</DrawerTitle>
            <DrawerDescription>
              Bind an existing organization venue or create a new venue and bind it
              immediately to this team.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">{createTeamVenueContent}</div>
        </DrawerContent>
      </Drawer>
    )
  }

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
          <DialogTitle>New team venue</DialogTitle>
          <DialogDescription>
            Bind an existing organization venue or create a new venue and bind it
            immediately to this team.
          </DialogDescription>
        </DialogHeader>

        {createTeamVenueContent}
      </DialogContent>
    </Dialog>
  )
}

function EditTeamVenueDialog({
  teamVenue,
  scope,
  selectedStatusFilter,
  open,
  onOpenChange,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [name, setName] = React.useState(teamVenue.venueName)
  const [city, setCity] = React.useState(teamVenue.city)
  const [country, setCountry] = React.useState(teamVenue.country)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setName(teamVenue.venueName)
    setCity(teamVenue.city)
    setCountry(teamVenue.country)
  }, [open, teamVenue.city, teamVenue.country, teamVenue.venueName])

  const canSubmit =
    normalizeText(name).length > 0 &&
    normalizeText(city).length > 0 &&
    normalizeText(country).length > 0

  const editTeamVenueForm = (
    <form action={updateTeamVenueAction} className="space-y-4">
      <input type="hidden" name="teamVenueId" value={teamVenue.id} />
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />

      <div className="space-y-2">
        <Label htmlFor={`edit-team-venue-name-${teamVenue.id}`}>Name</Label>
        <Input
          id={`edit-team-venue-name-${teamVenue.id}`}
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`edit-team-venue-city-${teamVenue.id}`}>City</Label>
          <Input
            id={`edit-team-venue-city-${teamVenue.id}`}
            name="city"
            required
            maxLength={120}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-team-venue-country-${teamVenue.id}`}>Country</Label>
          <Input
            id={`edit-team-venue-country-${teamVenue.id}`}
            name="country"
            required
            maxLength={120}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit team venue</DrawerTitle>
            <DrawerDescription>{teamVenue.venueName}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">{editTeamVenueForm}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit team venue</DialogTitle>
          <DialogDescription>{teamVenue.venueName}</DialogDescription>
        </DialogHeader>

        {editTeamVenueForm}
      </DialogContent>
    </Dialog>
  )
}

function DeleteTeamVenueDialog({
  teamVenue,
  scope,
  selectedStatusFilter,
  deleteDisabled,
  open,
  onOpenChange,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  deleteDisabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete team venue</DialogTitle>
          <DialogDescription>
            {deleteDisabled ? (
              <>
                <strong>{teamVenue.venueName}</strong> has linked camps or sessions and
                cannot be deleted.
              </>
            ) : (
              <>
                This will remove <strong>{teamVenue.venueName}</strong> from the selected
                team.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form action={deleteTeamVenueAction} className="space-y-4">
          <input type="hidden" name="teamVenueId" value={teamVenue.id} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={deleteDisabled}>
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TeamVenueRowActionsMenu({
  teamVenue,
  scope,
  selectedStatusFilter,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const canDeleteTeamVenue = teamVenue.totalCampCount === 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label={`Open actions for ${teamVenue.venueName}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setIsEditOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDeleteTeamVenue}
            onClick={() => {
              setIsDeleteOpen(true)
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTeamVenueDialog
        teamVenue={teamVenue}
        scope={scope}
        selectedStatusFilter={selectedStatusFilter}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <DeleteTeamVenueDialog
        teamVenue={teamVenue}
        scope={scope}
        selectedStatusFilter={selectedStatusFilter}
        deleteDisabled={!canDeleteTeamVenue}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  )
}

export function TeamVenuesTable({
  linkedVenues,
  noTeamSelected,
  canManageVenueRows,
  toolbar,
  selectedStatusFilter,
  scope,
  currentYear,
}: TeamVenuesTableProps) {
  const router = useRouter()
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedStatusFilter,
  })

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-end gap-2 md:justify-between">
        <h2 className="hidden text-lg font-semibold md:block">Venues</h2>
        {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
      </header>

      <div className="space-y-2 md:hidden">
        {linkedVenues.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          linkedVenues.map((item) => {
            const venueDetailHref = buildVenueDetailHref({
              scope,
              teamVenueId: item.id,
              tab: "camps",
            })

            return (
              <article
                key={item.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer rounded-xl border bg-card px-3 py-3 transition-colors hover:bg-muted/30"
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.venueName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatLocation(item.city, item.country)}
                    </p>
                  </div>

                  <div
                    className="shrink-0"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    {canManageVenueRows ? (
                      <TeamVenueRowActionsMenu
                        teamVenue={item}
                        scope={scope}
                        selectedStatusFilter={selectedStatusFilter}
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
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              linkedVenues.map((item) => {
                const venueDetailHref = buildVenueDetailHref({
                  scope,
                  teamVenueId: item.id,
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
                      onKeyDown={(event) => {
                        event.stopPropagation()
                      }}
                    >
                      {canManageVenueRows ? (
                        <TeamVenueRowActionsMenu
                          teamVenue={item}
                          scope={scope}
                          selectedStatusFilter={selectedStatusFilter}
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
