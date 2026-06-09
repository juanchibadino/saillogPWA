"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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
import { buildTeamSessionsHref } from "@/features/sessions/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamSessionsToolbarOption = {
  label: string
  value: string
  href: string
}

function SessionsFilterDropdown({
  label,
  options,
  selectedValue,
  disabled,
}: {
  label: string
  options: TeamSessionsToolbarOption[]
  selectedValue: string
  disabled: boolean
}) {
  const router = useRouter()
  const hasActiveFilter = selectedValue.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              hasActiveFilter &&
                "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
            )}
          />
        }
      >
        <FilterIcon className="size-4" />
        <span>{label}</span>
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {options.map((option) => {
          const isActive = option.value === selectedValue

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                if (!isActive) {
                  router.push(option.href)
                }
              }}
              className="gap-2"
            >
              <span className="flex size-4 items-center justify-center">
                {isActive ? <CheckIcon className="size-4" /> : null}
              </span>
              <span className="flex-1">{option.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function normalizeHighlightValue(value: string): "yes" | "no" | undefined {
  if (value === "yes" || value === "no") {
    return value
  }

  return undefined
}

export function TeamSessionsToolbar({
  scope,
  venueOptions,
  campOptions,
  highlightOptions,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  venueDisabled = false,
  campDisabled = false,
  action,
}: {
  scope: NavigationScope
  venueOptions: TeamSessionsToolbarOption[]
  campOptions: TeamSessionsToolbarOption[]
  highlightOptions: TeamSessionsToolbarOption[]
  selectedVenueId: string
  selectedCampId: string
  selectedHighlight: string
  venueDisabled?: boolean
  campDisabled?: boolean
  action?: ReactNode
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftVenueId, setDraftVenueId] = useState(selectedVenueId)
  const [draftCampId, setDraftCampId] = useState(selectedCampId)
  const [draftHighlight, setDraftHighlight] = useState(selectedHighlight)

  const hasActiveFilter =
    selectedVenueId.length > 0 ||
    selectedCampId.length > 0 ||
    selectedHighlight.length > 0
  const hasVenueDraftChanged = draftVenueId !== selectedVenueId
  const isCampSelectDisabled = campDisabled || hasVenueDraftChanged

  function applyDraftFilters(): void {
    router.push(
      buildTeamSessionsHref({
        scope,
        venueId: draftVenueId || undefined,
        campId: hasVenueDraftChanged ? undefined : draftCampId || undefined,
        highlight: normalizeHighlightValue(draftHighlight),
      }),
    )
    setIsDrawerOpen(false)
  }

  function clearFilters(): void {
    router.push(
      buildTeamSessionsHref({
        scope,
      }),
    )
    setIsDrawerOpen(false)
  }

  if (isMobile) {
    return (
      <section className="flex w-full items-center justify-between gap-2">
        <Drawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open)

            if (open) {
              setDraftVenueId(selectedVenueId)
              setDraftCampId(selectedCampId)
              setDraftHighlight(selectedHighlight)
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="default"
              className="relative h-9 px-3"
              aria-label="Session filters"
            >
              <FilterIcon className="size-4" />
              {hasActiveFilter ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-secondary"
                />
              ) : null}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription>Set filters and apply.</DrawerDescription>
            </DrawerHeader>

            <div className="space-y-3 px-4 pb-2">
              <div className="space-y-2">
                <label
                  htmlFor="mobile-sessions-venue-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Venue
                </label>
                <select
                  id="mobile-sessions-venue-filter"
                  value={draftVenueId}
                  onChange={(event) => {
                    setDraftVenueId(event.target.value)
                    setDraftCampId("")
                  }}
                  disabled={venueDisabled}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {venueOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="mobile-sessions-camp-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Camp
                </label>
                <select
                  id="mobile-sessions-camp-filter"
                  value={draftCampId}
                  onChange={(event) => setDraftCampId(event.target.value)}
                  disabled={isCampSelectDisabled}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {campOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {hasVenueDraftChanged ? (
                  <p className="text-xs text-muted-foreground">
                    Apply venue first to refresh camp options.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="mobile-sessions-highlight-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Highlight
                </label>
                <select
                  id="mobile-sessions-highlight-filter"
                  value={draftHighlight}
                  onChange={(event) => setDraftHighlight(event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px]"
                >
                  {highlightOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DrawerFooter>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear
              </Button>
              <Button type="button" onClick={applyDraftFilters}>
                Apply
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {action ? <div className="flex justify-end">{action}</div> : null}
      </section>
    )
  }

  return (
    <section className="flex items-center justify-end gap-2">
      <SessionsFilterDropdown
        label="Venue"
        options={venueOptions}
        selectedValue={selectedVenueId}
        disabled={venueDisabled}
      />
      <SessionsFilterDropdown
        label="Camp"
        options={campOptions}
        selectedValue={selectedCampId}
        disabled={campDisabled}
      />
      <SessionsFilterDropdown
        label="Highlight"
        options={highlightOptions}
        selectedValue={selectedHighlight}
        disabled={false}
      />
      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
