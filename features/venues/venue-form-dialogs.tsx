"use client"

import * as React from "react"
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { createVenueAction, updateVenueAction } from "@/features/venues/actions"
import type {
  VenueOrganizationOption,
} from "@/features/venues/data"
import { formatVenueLocation } from "@/features/venues/location"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type NominatimLocation = {
  placeId: string
  displayName: string
  city: string
  country: string
  lat: string
  lon: string
}

type VenueFormInitialValues = {
  id?: string
  organizationId: string
  name: string
  city: string
  country: string
  isActive?: boolean
}

type EditableVenue = {
  id: string
  organization_id: string
  name: string
  city: string
  country: string
  is_active: boolean
}

type VenueFormFooter = "dialog" | "drawer" | "sheet"
type VenueFormSurface = "dialog" | "drawer" | "sheet"

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function buildInitialSelectedLocation(
  city: string,
  country: string,
): NominatimLocation | null {
  if (!city || !country) {
    return null
  }

  return {
    placeId: `existing-${city}-${country}`,
    displayName: formatVenueLocation({ city, country }),
    city,
    country,
    lat: "",
    lon: "",
  }
}

function VenueDialogForm({
  organizations,
  initialValues,
  includeIsActive,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  redirectTo,
  action,
  footer = "dialog",
  fieldsClassName,
  surface = "dialog",
  teamVenueId,
}: {
  organizations: VenueOrganizationOption[]
  initialValues: VenueFormInitialValues
  includeIsActive: boolean
  idPrefix: string
  submitLabel: string
  pendingLabel?: string
  scope: NavigationScope
  redirectTo?: string
  action: (formData: FormData) => void | Promise<void>
  footer?: VenueFormFooter
  fieldsClassName?: string
  surface?: VenueFormSurface
  teamVenueId?: string
}) {
  const singleOrganizationId =
    organizations.length === 1 ? organizations[0]?.id ?? "" : ""
  const [organizationId, setOrganizationId] = React.useState(
    initialValues.organizationId,
  )

  const initialNameEdited =
    normalizeText(initialValues.name) !== normalizeText(initialValues.city)
  const [nameValue, setNameValue] = React.useState(initialValues.name)
  const [nameManuallyEdited, setNameManuallyEdited] = React.useState(
    initialNameEdited,
  )

  const initialLocation = React.useMemo(
    () => buildInitialSelectedLocation(initialValues.city, initialValues.country),
    [initialValues.city, initialValues.country],
  )

  const [locationQuery, setLocationQuery] = React.useState(
    initialLocation?.displayName ?? "",
  )
  const [selectedLocation, setSelectedLocation] =
    React.useState<NominatimLocation | null>(initialLocation)
  const [suggestions, setSuggestions] = React.useState<NominatimLocation[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [locationTouched, setLocationTouched] = React.useState(false)

  React.useEffect(() => {
    if (singleOrganizationId) {
      setOrganizationId(singleOrganizationId)
    }
  }, [singleOrganizationId])

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

  const resolvedOrganizationId = singleOrganizationId || organizationId
  const hasValidLocation = Boolean(selectedLocation)
  const canSubmit =
    resolvedOrganizationId.length > 0 && nameValue.trim().length > 0 && hasValidLocation
  const hasFixedFooter = footer === "drawer" || footer === "sheet"
  const isDrawerSurface = surface === "drawer"
  const controlClassName =
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )

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

    if (!nameManuallyEdited) {
      setNameValue(location.city)
    }
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setNameValue(event.target.value)
    setNameManuallyEdited(true)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setLocationTouched(true)

    if (!selectedLocation) {
      event.preventDefault()
    }
  }

  return (
    <form
      action={action}
      className={cn(
        hasFixedFooter ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "space-y-4",
      )}
      onSubmit={handleSubmit}
    >
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      {teamVenueId ? (
        <input type="hidden" name="teamVenueId" value={teamVenueId} />
      ) : null}
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <VenueFormFieldset fixedFooter={hasFixedFooter} className={fieldsClassName}>
        {singleOrganizationId ? (
          <input type="hidden" name="organizationId" value={singleOrganizationId} />
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-organizationId`}>Organization</Label>
            <select
              id={`${idPrefix}-organizationId`}
              name="organizationId"
              required
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className={selectClassName}
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-location`}>Location</Label>
          <div className="relative z-10">
            <Input
              id={`${idPrefix}-location`}
              type="text"
              autoComplete="off"
              placeholder="Search city and country"
              value={locationQuery}
              onChange={handleLocationInputChange}
              className={controlClassName}
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

          <input type="hidden" name="city" value={selectedLocation?.city ?? ""} />
          <input
            type="hidden"
            name="country"
            value={selectedLocation?.country ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            required
            maxLength={120}
            value={nameValue}
            onChange={handleNameChange}
            className={controlClassName}
          />
        </div>

        {includeIsActive ? (
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initialValues.isActive}
              className={cn(
                "rounded border-input",
                isDrawerSurface ? "size-5" : "size-4",
              )}
            />
            Active venue
          </label>
        ) : null}
      </VenueFormFieldset>

      <VenueFormSubmitFooter
        canSubmit={canSubmit}
        footer={footer}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel ?? submitLabel}
      />
    </form>
  )
}

function VenueFormFieldset({
  children,
  className,
  fixedFooter,
}: {
  children: React.ReactNode
  className?: string
  fixedFooter: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={pending}
      className={cn(
        fixedFooter
          ? "m-0 min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto border-0 px-4 pb-4 pt-0"
          : "space-y-4",
        className,
      )}
    >
      {children}
    </fieldset>
  )
}

function VenueSubmitButton({
  canSubmit,
  pendingLabel,
  submitLabel,
  surface,
}: {
  canSubmit: boolean
  pendingLabel: string
  submitLabel: string
  surface: VenueFormFooter
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending || !canSubmit}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
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

function VenueFormSubmitFooter({
  canSubmit,
  footer,
  pendingLabel,
  submitLabel,
}: {
  canSubmit: boolean
  footer: VenueFormFooter
  pendingLabel: string
  submitLabel: string
}) {
  const button = (
    <VenueSubmitButton
      canSubmit={canSubmit}
      pendingLabel={pendingLabel}
      submitLabel={submitLabel}
      surface={footer}
    />
  )

  if (footer === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  if (footer === "sheet") {
    return (
      <SheetFooter className="shrink-0 border-t sm:justify-end">
        {button}
      </SheetFooter>
    )
  }

  return <DialogFooter>{button}</DialogFooter>
}

export function CreateVenueDialog({
  organizations,
  scope,
  redirectTo,
}: {
  organizations: VenueOrganizationOption[]
  scope: NavigationScope
  redirectTo?: string
}) {
  const defaultOrganizationId = organizations[0]?.id ?? ""

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create venue</DialogTitle>
        </DialogHeader>

        <VenueDialogForm
          organizations={organizations}
          initialValues={{
            organizationId: defaultOrganizationId,
            name: "",
            city: "",
            country: "",
          }}
          includeIsActive={false}
          idPrefix="create-venue"
          submitLabel="Create venue"
          pendingLabel="Creating..."
          scope={scope}
          redirectTo={redirectTo}
          action={createVenueAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditVenueDialog({
  venue,
  organizations,
  scope,
  redirectTo,
  teamVenueId,
}: {
  venue: EditableVenue
  organizations: VenueOrganizationOption[]
  scope: NavigationScope
  redirectTo?: string
  teamVenueId: string
}) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)

  function renderForm(surface: Extract<VenueFormSurface, "drawer" | "sheet">) {
    const isDrawer = surface === "drawer"

    return (
      <VenueDialogForm
        organizations={organizations}
        initialValues={{
          id: venue.id,
          organizationId: venue.organization_id,
          name: venue.name,
          city: venue.city,
          country: venue.country,
          isActive: venue.is_active,
        }}
        includeIsActive
        idPrefix={`edit-venue-${venue.id}-${surface}`}
        submitLabel="Save"
        pendingLabel="Saving..."
        scope={scope}
        redirectTo={redirectTo}
        action={updateVenueAction}
        footer={surface}
        fieldsClassName={isDrawer ? "px-4 pb-6" : "px-4 pb-4"}
        surface={surface}
        teamVenueId={teamVenueId}
      />
    )
  }

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="h-11 px-4"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <PencilIcon className="size-4" />
          Edit
        </Button>
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>Edit venue</DrawerTitle>
          </DrawerHeader>
          {renderForm("drawer")}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <PencilIcon className="size-4" />
        Edit
      </Button>
      <SheetContent side="right" className="flex h-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>Edit venue</SheetTitle>
        </SheetHeader>
        {renderForm("sheet")}
      </SheetContent>
    </Sheet>
  )
}
