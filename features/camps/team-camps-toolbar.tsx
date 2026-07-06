"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  buildTeamCampsHref,
  type TeamCampsHrefInput,
} from "@/features/camps/navigation"
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
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type TeamCampsToolbarOption = {
  label: string
  value: string
  href: string
}

export type TeamCampsToolbarNavigationProps = {
  isNavigating?: boolean
  onNavigate?: (href: string) => void
}

function CampsFilterDropdown({
  label,
  options,
  selectedValue,
  disabled,
  isNavigating = false,
  onNavigate,
}: {
  label: string
  options: TeamCampsToolbarOption[]
  selectedValue: string
  disabled: boolean
} & TeamCampsToolbarNavigationProps) {
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

function normalizeCampTypeValue(value: string): TeamCampsHrefInput["campType"] {
  if (value === "training" || value === "regatta" || value === "mixed") {
    return value
  }

  return undefined
}

function normalizeCampStatusValue(
  value: string,
): TeamCampsHrefInput["campStatus"] {
  if (value === "active" || value === "inactive") {
    return value
  }

  return undefined
}

export function TeamCampsToolbar({
  action,
  buildHref = buildTeamCampsHref,
  disabled = false,
  isNavigating = false,
  onNavigate,
  selectedCampStatus,
  selectedCampType,
  selectedVenueId,
  scope,
  statusOptions,
  typeOptions,
  venueDisabled = false,
  venueOptions,
}: {
  action?: ReactNode
  buildHref?: (input: TeamCampsHrefInput) => string
  disabled?: boolean
  selectedCampStatus: string
  selectedCampType: string
  selectedVenueId: string
  scope: TeamCampsHrefInput["scope"]
  statusOptions: TeamCampsToolbarOption[]
  typeOptions: TeamCampsToolbarOption[]
  venueDisabled?: boolean
  venueOptions: TeamCampsToolbarOption[]
} & TeamCampsToolbarNavigationProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftVenueId, setDraftVenueId] = useState(selectedVenueId)
  const [draftCampType, setDraftCampType] = useState(selectedCampType)
  const [draftCampStatus, setDraftCampStatus] = useState(selectedCampStatus)

  const hasActiveFilter =
    selectedVenueId.length > 0 ||
    selectedCampType.length > 0 ||
    selectedCampStatus.length > 0
  const isDisabled = disabled || isNavigating

  function navigateToHref(href: string): void {
    if (isDisabled) {
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
      buildHref({
        scope,
        venueId: draftVenueId || undefined,
        campType: normalizeCampTypeValue(draftCampType),
        campStatus: normalizeCampStatusValue(draftCampStatus),
      }),
    )
    setIsDrawerOpen(false)
  }

  function clearFilters(): void {
    navigateToHref(buildHref({ scope }))
    setIsDrawerOpen(false)
  }

  if (isMobile) {
    return (
      <section className="flex w-full items-center justify-between gap-3 md:hidden">
        <Drawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open)

            if (open) {
              setDraftVenueId(selectedVenueId)
              setDraftCampType(selectedCampType)
              setDraftCampStatus(selectedCampStatus)
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="default"
              disabled={isDisabled}
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
                  htmlFor="mobile-camps-venue-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Venue
                </label>
                <select
                  id="mobile-camps-venue-filter"
                  value={draftVenueId}
                  onChange={(event) => setDraftVenueId(event.target.value)}
                  disabled={venueDisabled || isDisabled}
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
                  htmlFor="mobile-camps-type-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Type
                </label>
                <select
                  id="mobile-camps-type-filter"
                  value={draftCampType}
                  onChange={(event) => setDraftCampType(event.target.value)}
                  disabled={isDisabled}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="mobile-camps-status-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Status
                </label>
                <select
                  id="mobile-camps-status-filter"
                  value={draftCampStatus}
                  onChange={(event) => setDraftCampStatus(event.target.value)}
                  disabled={isDisabled}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  {statusOptions.map((option) => (
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
                disabled={isDisabled || !hasActiveFilter}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={isDisabled}
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
      <CampsFilterDropdown
        label="Venue"
        options={venueOptions}
        selectedValue={selectedVenueId}
        disabled={venueDisabled}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      <CampsFilterDropdown
        label="Type"
        options={typeOptions}
        selectedValue={selectedCampType}
        disabled={false}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      <CampsFilterDropdown
        label="Status"
        options={statusOptions}
        selectedValue={selectedCampStatus}
        disabled={false}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
