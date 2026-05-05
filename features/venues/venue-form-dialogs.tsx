"use client"

import * as React from "react"
import { PencilIcon, PlusIcon } from "lucide-react"

import { createVenueAction, updateVenueAction } from "@/features/venues/actions"
import type {
  VenueOrganizationOption,
} from "@/features/venues/data"
import { formatVenueLocation } from "@/features/venues/location"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  scope,
  redirectTo,
  action,
}: {
  organizations: VenueOrganizationOption[]
  initialValues: VenueFormInitialValues
  includeIsActive: boolean
  idPrefix: string
  submitLabel: string
  scope: NavigationScope
  redirectTo?: string
  action: (formData: FormData) => void | Promise<void>
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
    <form action={action} className="space-y-4" onSubmit={handleSubmit}>
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2 sm:flex-[1.6]">
          <Label htmlFor={`${idPrefix}-location`}>Location</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-location`}
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

          <input type="hidden" name="city" value={selectedLocation?.city ?? ""} />
          <input
            type="hidden"
            name="country"
            value={selectedLocation?.country ?? ""}
          />
        </div>

        <div className="space-y-2 sm:flex-1">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            required
            maxLength={120}
            value={nameValue}
            onChange={handleNameChange}
          />
        </div>
      </div>

      {includeIsActive ? (
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialValues.isActive}
            className="size-4 rounded border-input"
          />
          Active venue
        </label>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
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
          <DialogDescription>
            Add a new operational venue for your organization.
          </DialogDescription>
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
}: {
  venue: EditableVenue
  organizations: VenueOrganizationOption[]
  scope: NavigationScope
  redirectTo?: string
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PencilIcon className="size-4" />
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit venue</DialogTitle>
          <DialogDescription>{venue.name}</DialogDescription>
        </DialogHeader>

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
          idPrefix={`edit-venue-${venue.id}`}
          submitLabel="Save changes"
          scope={scope}
          redirectTo={redirectTo}
          action={updateVenueAction}
        />
      </DialogContent>
    </Dialog>
  )
}
