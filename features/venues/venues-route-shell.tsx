"use client"

import { useState, useTransition, type ReactNode } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
import { CreateVenueDialog } from "@/features/venues/venue-form-dialogs"
import type {
  VenuesChromeData,
  VenueStatusFilter,
} from "@/features/venues/data"
import { buildVenueStatusHref } from "@/features/venues/list-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type PendingFilterNavigation = {
  fromHref: string
  toHref: string
}

type VenuesFilterOption = {
  href: string
  label: string
  value: VenueStatusFilter
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
}

function formatVenueStatusLabel(input: {
  count: number
  status: VenueStatusFilter
}): string {
  if (input.status === "active") {
    return `Active (${input.count})`
  }

  if (input.status === "inactive") {
    return `Inactive (${input.count})`
  }

  return `All (${input.count})`
}

function VenuesFilterDropdown({
  disabled,
  isNavigating,
  label,
  onNavigate,
  options,
  selectedValue,
}: {
  disabled: boolean
  isNavigating: boolean
  label: string
  onNavigate: (href: string) => void
  options: VenuesFilterOption[]
  selectedValue: VenueStatusFilter
}) {
  const hasActiveFilter = selectedValue !== "all"
  const clearOption = options.find((option) => option.value === "all")
  const isDisabled = disabled || isNavigating

  function navigateToHref(href: string): void {
    if (isNavigating) {
      return
    }

    onNavigate(href)
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

function VenuesMobileFilterDrawer({
  disabled,
  isNavigating,
  onNavigate,
  options,
  selectedValue,
}: {
  disabled: boolean
  isNavigating: boolean
  onNavigate: (href: string) => void
  options: VenuesFilterOption[]
  selectedValue: VenueStatusFilter
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftStatus, setDraftStatus] = useState<VenueStatusFilter>(selectedValue)
  const hasActiveFilter = selectedValue !== "all"
  const selectedDraftOption = options.find((option) => option.value === draftStatus)
  const clearOption = options.find((option) => option.value === "all")

  function navigateToHref(href: string): void {
    if (isNavigating) {
      return
    }

    onNavigate(href)
    setIsDrawerOpen(false)
  }

  function applyDraftFilter(): void {
    if (!selectedDraftOption) {
      return
    }

    navigateToHref(selectedDraftOption.href)
  }

  return (
    <Drawer
      open={isDrawerOpen}
      onOpenChange={(open) => {
        setIsDrawerOpen(open)

        if (open) {
          setDraftStatus(selectedValue)
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
              htmlFor="mobile-venues-status-filter"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Status
            </label>
            <select
              id="mobile-venues-status-filter"
              value={draftStatus}
              onChange={(event) => {
                setDraftStatus(event.target.value as VenueStatusFilter)
              }}
              disabled={disabled || isNavigating}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
            >
              {options.map((option) => (
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
            disabled={isNavigating || !hasActiveFilter || !clearOption}
            onClick={() => {
              if (clearOption) {
                navigateToHref(clearOption.href)
              }
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            className="h-11 w-full"
            disabled={isNavigating || !selectedDraftOption}
            onClick={applyDraftFilter}
          >
            Apply
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function VenuesRouteShell({
  canManageVenues,
  children,
  chromeData,
  scope,
}: {
  canManageVenues: boolean
  children: ReactNode
  chromeData: VenuesChromeData
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isFilterNavigationPending, startFilterNavigationTransition] = useTransition()
  const [pendingFilterNavigation, setPendingFilterNavigation] =
    useState<PendingFilterNavigation | null>(null)
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isFilterNavigationBusy =
    isFilterNavigationPending ||
    pendingFilterNavigation?.fromHref === currentHref
  const statusOptions: VenuesFilterOption[] = ([
    { status: "all", count: chromeData.statusCounts.all },
    { status: "active", count: chromeData.statusCounts.active },
    { status: "inactive", count: chromeData.statusCounts.inactive },
  ] as Array<{ count: number; status: VenueStatusFilter }>).map((option) => ({
    value: option.status,
    label: formatVenueStatusLabel(option),
    href: buildVenueStatusHref({
      pathname,
      search: searchParams.toString(),
      nextStatus: option.status,
    }),
  }))
  const statusFilterDisabled = statusOptions.length === 0

  function navigateToFilterHref(href: string): void {
    const nextHref = normalizeInternalHref(href)

    if (isFilterNavigationBusy || nextHref === currentHref) {
      return
    }

    setPendingFilterNavigation({
      fromHref: currentHref,
      toHref: nextHref,
    })
    startFilterNavigationTransition(() => {
      router.push(href)
    })
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Organization Venues</h2>
        <div className="hidden items-center justify-end gap-2 md:flex">
          <VenuesFilterDropdown
            label="Status"
            options={statusOptions}
            selectedValue={chromeData.selectedStatusFilter}
            disabled={statusFilterDisabled}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
          />

          {canManageVenues && chromeData.organizations.length > 0 ? (
            <CreateVenueDialog
              organizations={chromeData.organizations}
              scope={scope}
              surface="sheet"
            />
          ) : null}
        </div>

        <div className="md:hidden">
          <VenuesMobileFilterDrawer
            options={statusOptions}
            selectedValue={chromeData.selectedStatusFilter}
            disabled={statusFilterDisabled}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
          />
        </div>
      </header>

      <div aria-busy={isFilterNavigationBusy} className="relative">
        <div
          aria-disabled={isFilterNavigationBusy}
          className={cn(
            "transition-opacity",
            isFilterNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          {children}
        </div>
        {isFilterNavigationBusy ? (
          <>
            <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
              <div
                role="status"
                aria-label="Loading filtered venues"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered venues"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {canManageVenues && chromeData.organizations.length > 0 ? (
        <CreateVenueDialog
          organizations={chromeData.organizations}
          scope={scope}
          surface="drawer"
          triggerVariant="fab"
        />
      ) : null}
    </section>
  )
}
