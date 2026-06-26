"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon, XIcon } from "lucide-react"
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

export type TeamSessionsToolbarNavigationProps = {
  isNavigating?: boolean
  onNavigate?: (href: string) => void
}

function SessionsFilterDropdown({
  label,
  options,
  selectedValue,
  disabled,
  isNavigating = false,
  onNavigate,
}: {
  label: string
  options: TeamSessionsToolbarOption[]
  selectedValue: string
  disabled: boolean
} & TeamSessionsToolbarNavigationProps) {
  const router = useRouter()
  const hasActiveFilter = selectedValue.length > 0
  const clearOption = options.find((option) => option.value === "")
  const isDisabled = disabled || isNavigating

  function navigateToHref(href: string): void {
    if (isNavigating) {
      return
    }

    if (onNavigate) {
      onNavigate(href)
      return
    }

    router.push(href)
  }

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
              className={cn(
                hasActiveFilter && "rounded-r-none",
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
                    navigateToHref(option.href)
                  }
                }}
                disabled={isNavigating}
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
      {hasActiveFilter && clearOption ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isNavigating}
          aria-label={`Clear ${label} filter`}
          className="rounded-l-none border-l-0 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigateToHref(clearOption.href)}
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
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
  isNavigating = false,
  onNavigate,
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
} & TeamSessionsToolbarNavigationProps) {
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
  const isCampSelectDisabled = campDisabled || hasVenueDraftChanged || isNavigating

  function navigateToHref(href: string): void {
    if (isNavigating) {
      return
    }

    if (onNavigate) {
      onNavigate(href)
      return
    }

    router.push(href)
  }

  function applyDraftFilters(): void {
    navigateToHref(
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
    navigateToHref(
      buildTeamSessionsHref({
        scope,
      }),
    )
    setIsDrawerOpen(false)
  }

  if (isMobile) {
    return (
      <section className="flex w-full items-center justify-between gap-3 md:hidden">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">Sessions</h1>
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
              disabled={isNavigating}
              className={cn(
                "h-11 w-11 px-0",
                hasActiveFilter &&
                  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
              )}
              aria-label="Filters"
            >
              <FilterIcon className="size-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription>Set filters and apply.</DrawerDescription>
            </DrawerHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
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
                  disabled={venueDisabled || isNavigating}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
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
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
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
                  disabled={isNavigating}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] md:text-sm"
                >
                  {highlightOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DrawerFooter className="shrink-0 border-t">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={isNavigating || !hasActiveFilter}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={isNavigating}
                onClick={applyDraftFilters}
              >
                Apply
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </section>
    )
  }

  return (
    <section className="hidden items-center justify-end gap-2 md:flex">
      <SessionsFilterDropdown
        label="Venue"
        options={venueOptions}
        selectedValue={selectedVenueId}
        disabled={venueDisabled}
        isNavigating={isNavigating}
        onNavigate={onNavigate}
      />
      <SessionsFilterDropdown
        label="Camp"
        options={campOptions}
        selectedValue={selectedCampId}
        disabled={campDisabled}
        isNavigating={isNavigating}
        onNavigate={onNavigate}
      />
      <SessionsFilterDropdown
        label="Highlight"
        options={highlightOptions}
        selectedValue={selectedHighlight}
        disabled={false}
        isNavigating={isNavigating}
        onNavigate={onNavigate}
      />
      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
