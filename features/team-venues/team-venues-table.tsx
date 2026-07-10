"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useFormStatus } from "react-dom"
import type { ReactNode } from "react"

import {
  createAndLinkTeamVenueAction,
  createTeamVenueLinkAction,
  deleteTeamVenueAction,
  updateTeamVenueAction,
} from "@/features/team-venues/actions"
import { canDeleteTeamVenueLink } from "@/features/team-venues/action-rules.mjs"
import type {
  TeamVenueCreateOption,
  TeamVenueListItem,
  TeamVenueStatusFilter,
} from "@/features/team-venues/data"
import { buildTeamVenuesPageHref } from "@/features/team-venues/list-route-state.mjs"
import { useIsMobile } from "@/hooks/use-mobile"
import { buildVenueDetailHref } from "@/features/venues/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  loadMoreMode: boolean
  hideChrome?: boolean
}

type TeamVenuesPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

type TeamVenueFormSurface = "drawer" | "sheet"
type TeamVenueCreateMode = "existing" | "new"

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

function VenueCampCountValue({
  value,
}: {
  value: TeamVenueListItem["campCountCurrentYear"]
}) {
  if (typeof value === "number") {
    return <>{value}</>
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1 text-muted-foreground"
    >
      <Loader2Icon className="size-3 animate-spin" />
      <span className="sr-only">Loading camp count</span>
      <span aria-hidden="true">...</span>
    </span>
  )
}

function normalizeText(value: string): string {
  return value.trim()
}

function keepMobileFieldVisible(event: React.FocusEvent<HTMLElement>) {
  const target = event.currentTarget

  window.setTimeout(() => {
    target.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    })
  }, 120)
}

function TeamVenueFormFieldset({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={pending}
      className={cn(
        "space-y-4 disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      {children}
    </fieldset>
  )
}

function TeamVenueSubmitButton({
  canSubmit,
  className,
  pendingLabel,
  submitLabel,
}: {
  canSubmit: boolean
  className?: string
  pendingLabel: string
  submitLabel: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={!canSubmit || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        submitLabel
      )}
    </Button>
  )
}

function TeamVenueFormFooter({
  canSubmit,
  pendingLabel,
  submitLabel,
  surface,
}: {
  canSubmit: boolean
  pendingLabel: string
  submitLabel: string
  surface: TeamVenueFormSurface
}) {
  const button = (
    <TeamVenueSubmitButton
      canSubmit={canSubmit}
      pendingLabel={pendingLabel}
      submitLabel={submitLabel}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:justify-end">
      {button}
    </SheetFooter>
  )
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

function buildTeamVenuesPaginationItems(
  currentPage: number,
  pageCount: number,
): TeamVenuesPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: TeamVenuesPaginationItem[] = [1]
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

export function CreateTeamVenueDialog({
  availableVenueOptions,
  scope,
  selectedStatusFilter,
  currentPage,
  loadMoreMode,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  availableVenueOptions: TeamVenueCreateOption[]
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  currentPage: number
  loadMoreMode: boolean
  disabled: boolean
  surface?: TeamVenueFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] =
    React.useState<TeamVenueCreateMode>("existing")
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
  const isFabTrigger = triggerVariant === "fab"
  const isDrawerSurface = surface === "drawer"
  const idPrefix = `create-team-venue-${surface}`
  const selectClassName = cn(
    "w-full rounded-lg border border-border bg-background text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined

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

  function renderScopeFields() {
    return (
      <>
        <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
        {scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />
        {currentPage > 1 ? (
          <input type="hidden" name="scopePage" value={String(currentPage)} />
        ) : null}
        {loadMoreMode && currentPage > 1 ? (
          <input type="hidden" name="scopeLoadMore" value="1" />
        ) : null}
      </>
    )
  }

  function renderCreateModeControl() {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted p-1">
        <Button
          type="button"
          variant={createMode === "existing" ? "default" : "ghost"}
          size={isDrawerSurface ? "default" : "sm"}
          className={isDrawerSurface ? "h-10" : undefined}
          onClick={() => setCreateMode("existing")}
        >
          Bind existing
        </Button>
        <Button
          type="button"
          variant={createMode === "new" ? "default" : "ghost"}
          size={isDrawerSurface ? "default" : "sm"}
          className={isDrawerSurface ? "h-10" : undefined}
          onClick={() => setCreateMode("new")}
        >
          Create new
        </Button>
      </div>
    )
  }

  function renderExistingVenueForm() {
    return (
      <form
        action={createTeamVenueLinkAction}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {renderScopeFields()}

        <TeamVenueFormFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {renderCreateModeControl()}

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-venueId`}>Organization venue</Label>
            <select
              id={`${idPrefix}-venueId`}
              name="venueId"
              required
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
              className={selectClassName}
            >
              <option value="">Select venue</option>
              {availableVenueOptions.map((venueOption) => (
                <option key={venueOption.venueId} value={venueOption.venueId}>
                  {venueOption.name} - {formatLocation(venueOption.city, venueOption.country)} (
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
        </TeamVenueFormFieldset>

        <TeamVenueFormFooter
          canSubmit={canLinkExisting}
          pendingLabel="Binding..."
          submitLabel="Bind venue"
          surface={surface}
        />
      </form>
    )
  }

  function renderNewVenueForm() {
    return (
      <form
        action={createAndLinkTeamVenueAction}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={handleCreateAndBindSubmit}
      >
        {renderScopeFields()}

        <TeamVenueFormFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {renderCreateModeControl()}

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-newVenueName`}>Name</Label>
            <Input
              id={`${idPrefix}-newVenueName`}
              name="name"
              required
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
              maxLength={120}
              placeholder="Venue name"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-newVenueLocation`}>Location</Label>
            <div className="relative">
              <Input
                id={`${idPrefix}-newVenueLocation`}
                type="text"
                autoComplete="off"
                placeholder="Search city and country"
                value={locationQuery}
                onChange={handleLocationInputChange}
                onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
                className={inputClassName}
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
        </TeamVenueFormFieldset>

        <TeamVenueFormFooter
          canSubmit={canCreateAndLink}
          pendingLabel="Creating..."
          submitLabel="Create and bind"
          surface={surface}
        />
      </form>
    )
  }

  const createTeamVenueForm =
    createMode === "existing" ? renderExistingVenueForm() : renderNewVenueForm()

  if (surface === "drawer") {
    return (
      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New team venue" : undefined}
          aria-haspopup="dialog"
          aria-expanded={isCreateOpen}
          className={
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3"
          }
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New team venue</span> : "New"}
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>New team venue</DrawerTitle>
            <DrawerDescription>
              Bind an existing organization venue or create a new venue and bind it
              immediately to this team.
            </DrawerDescription>
          </DrawerHeader>
          {createTeamVenueForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isCreateOpen}
        onClick={() => setIsCreateOpen(true)}
      >
        <PlusIcon className="size-4" />
        New
      </Button>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>New team venue</SheetTitle>
          <SheetDescription>
            Bind an existing organization venue or create a new venue and bind it
            immediately to this team.
          </SheetDescription>
        </SheetHeader>

        {createTeamVenueForm}
      </SheetContent>
    </Sheet>
  )
}

function EditTeamVenueDialog({
  teamVenue,
  scope,
  selectedStatusFilter,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  currentPage: number
  loadMoreMode: boolean
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
  const surface: TeamVenueFormSurface = isMobile ? "drawer" : "sheet"
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined

  function renderEditTeamVenueForm() {
    return (
      <form
        action={updateTeamVenueAction}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <input type="hidden" name="teamVenueId" value={teamVenue.id} />
        <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
        {scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />
        {currentPage > 1 ? (
          <input type="hidden" name="scopePage" value={String(currentPage)} />
        ) : null}
        {loadMoreMode && currentPage > 1 ? (
          <input type="hidden" name="scopeLoadMore" value="1" />
        ) : null}

        <TeamVenueFormFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-team-venue-name-${teamVenue.id}`}>Name</Label>
            <Input
              id={`edit-team-venue-name-${teamVenue.id}`}
              name="name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
              className={inputClassName}
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
                onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
                className={inputClassName}
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
                onFocus={isDrawerSurface ? keepMobileFieldVisible : undefined}
                className={inputClassName}
              />
            </div>
          </div>
        </TeamVenueFormFieldset>

        <TeamVenueFormFooter
          canSubmit={canSubmit}
          pendingLabel="Saving..."
          submitLabel="Save"
          surface={surface}
        />
      </form>
    )
  }

  const editTeamVenueForm = renderEditTeamVenueForm()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit team venue</DrawerTitle>
            <DrawerDescription>{teamVenue.venueName}</DrawerDescription>
          </DrawerHeader>
          {editTeamVenueForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit team venue</SheetTitle>
          <SheetDescription>{teamVenue.venueName}</SheetDescription>
        </SheetHeader>

        {editTeamVenueForm}
      </SheetContent>
    </Sheet>
  )
}

function DeleteTeamVenueDialog({
  teamVenue,
  scope,
  selectedStatusFilter,
  currentPage,
  loadMoreMode,
  deleteDisabled,
  open,
  onOpenChange,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  currentPage: number
  loadMoreMode: boolean
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
          {currentPage > 1 ? (
            <input type="hidden" name="scopePage" value={String(currentPage)} />
          ) : null}
          {loadMoreMode && currentPage > 1 ? (
            <input type="hidden" name="scopeLoadMore" value="1" />
          ) : null}

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
  currentPage,
  loadMoreMode,
}: {
  teamVenue: TeamVenueListItem
  scope: NavigationScope
  selectedStatusFilter: TeamVenueStatusFilter
  currentPage: number
  loadMoreMode: boolean
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const isDeleteRulePending = typeof teamVenue.totalCampCount !== "number"
  const canDeleteTeamVenue =
    !isDeleteRulePending &&
    canDeleteTeamVenueLink({
      totalCampCount: teamVenue.totalCampCount,
    })

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
            {isDeleteRulePending ? "Checking delete..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTeamVenueDialog
        teamVenue={teamVenue}
        scope={scope}
        selectedStatusFilter={selectedStatusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <DeleteTeamVenueDialog
        teamVenue={teamVenue}
        scope={scope}
        selectedStatusFilter={selectedStatusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
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
  currentPage,
  pageCount,
  hasPreviousPage,
  hasNextPage,
  loadMoreMode,
  hideChrome = false,
}: TeamVenuesTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = React.useTransition()
  const [navigatingTeamVenueId, setNavigatingTeamVenueId] =
    React.useState<string | null>(null)
  const [, startVenueNavigationTransition] = React.useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] =
    React.useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    React.useState<PendingPageNavigation | null>(null)
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedStatusFilter,
  })
  const paginationItems = buildTeamVenuesPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamVenuesPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToVenue(teamVenueId: string, detailHref: string): void {
    setNavigatingTeamVenueId(teamVenueId)
    startVenueNavigationTransition(() => {
      router.push(detailHref)
    })
  }

  function prefetchVenue(detailHref: string): void {
    router.prefetch(detailHref)
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPaginationBusy ||
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
        <header className="flex items-center justify-end gap-2 md:justify-between">
          <h2 className="hidden text-lg font-semibold md:block">Venues</h2>
          {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
        </header>
      ) : null}

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
            const isNavigatingToVenue = navigatingTeamVenueId === item.id

            return (
              <article
                key={item.id}
                role="link"
                tabIndex={0}
                aria-busy={isNavigatingToVenue}
                className={cn(
                  "cursor-pointer rounded-xl border bg-card px-3 py-3 transition-colors hover:bg-muted/30",
                  isNavigatingToVenue && "opacity-80",
                )}
                onMouseEnter={() => prefetchVenue(venueDetailHref)}
                onFocus={() => prefetchVenue(venueDetailHref)}
                onClick={() => {
                  navigateToVenue(item.id, venueDetailHref)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    navigateToVenue(item.id, venueDetailHref)
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
                    {isNavigatingToVenue ? (
                      <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" />
                      </div>
                    ) : canManageVenueRows ? (
                      <TeamVenueRowActionsMenu
                        teamVenue={item}
                        scope={scope}
                        selectedStatusFilter={selectedStatusFilter}
                        currentPage={currentPage}
                        loadMoreMode={loadMoreMode}
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

        {hasNextPage ? (
          <div className="pb-4 pt-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={isLoadingMore}
              aria-label="Load more venues"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more venues"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <div
        aria-busy={isPaginationBusy}
        className="relative hidden overflow-hidden rounded-xl border bg-card md:block"
      >
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
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
                  const isNavigatingToVenue = navigatingTeamVenueId === item.id

                  return (
                    <TableRow
                      key={item.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingToVenue}
                      className={cn(
                        "cursor-pointer",
                        isNavigatingToVenue && "opacity-80",
                      )}
                      onMouseEnter={() => prefetchVenue(venueDetailHref)}
                      onFocus={() => prefetchVenue(venueDetailHref)}
                      onClick={() => {
                        navigateToVenue(item.id, venueDetailHref)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          navigateToVenue(item.id, venueDetailHref)
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={venueDetailHref}
                          className="underline-offset-4 hover:underline"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            navigateToVenue(item.id, venueDetailHref)
                          }}
                          onMouseEnter={() => prefetchVenue(venueDetailHref)}
                          onFocus={() => prefetchVenue(venueDetailHref)}
                        >
                          {item.venueName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatLocation(item.city, item.country)}</TableCell>
                      <TableCell>
                        <VenueCampCountValue value={item.campCountCurrentYear} />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        {isNavigatingToVenue ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : canManageVenueRows ? (
                          <TeamVenueRowActionsMenu
                            teamVenue={item}
                            scope={scope}
                            selectedStatusFilter={selectedStatusFilter}
                            currentPage={currentPage}
                            loadMoreMode={loadMoreMode}
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
        {isPaginationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading venues page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <Pagination
          aria-busy={isPaginationBusy}
          className="hidden justify-start md:flex"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage || isPaginationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isPaginationBusy}
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
                disabled={!hasNextPage || isPaginationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
