"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type {
  TeamAssetCampFilterOption,
  TeamAssetsChromeData,
  TeamAssetsRequestedFilters,
  TeamAssetSelectedFilters,
  TeamAssetSessionFilterOption,
  TeamAssetTab,
  TeamAssetVenueFilterOption,
  TeamAssetYearFilterOption,
} from "@/features/assets/data"
import { buildTeamAssetsHref } from "@/features/assets/list-route-state.mjs"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type FilterOption = {
  href: string
  label: string
  value: string
}

type PendingNavigation = {
  fromHref: string
  toHref: string
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
}

function buildHref(input: {
  filters: TeamAssetsRequestedFilters
  loadMore?: boolean
  page?: number
  scope: NavigationScope
  tab: TeamAssetTab
}): string {
  return buildTeamAssetsHref({
    scope: input.scope,
    tab: input.tab,
    venueId: input.filters.venueId,
    year: input.filters.year,
    campId: input.filters.campId,
    sessionId: input.filters.sessionId,
    page: input.page,
    loadMore: input.loadMore,
  })
}

function FilterDropdown(input: {
  disabled?: boolean
  isNavigating: boolean
  label: string
  onNavigate: (href: string) => void
  options: FilterOption[]
  selectedValue: string
}) {
  const hasActiveFilter = input.selectedValue.length > 0
  const clearOption = input.options.find((option) => option.value.length === 0)
  const selectedOption = input.options.find((option) => option.value === input.selectedValue)
  const isDisabled = input.disabled || input.isNavigating

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
          <span>{selectedOption?.label ?? input.label}</span>
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {input.options.map((option) => {
            const isActive = option.value === input.selectedValue

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={input.isNavigating}
                onClick={() => {
                  if (!isActive) {
                    input.onNavigate(option.href)
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
      {hasActiveFilter && clearOption ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={input.isNavigating}
          aria-label={`Clear ${input.label} filter`}
          className="rounded-l-none border-l-0 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => input.onNavigate(clearOption.href)}
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

function buildVenueOptions(input: {
  data: TeamAssetsChromeData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          year: input.data.selectedFilters.year,
        },
      }),
      label: "Venue",
      value: "",
    },
    ...input.data.filterOptions.venues.map((option: TeamAssetVenueFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: option.venueId,
          year: input.data.selectedFilters.year,
        },
      }),
      label: option.venueName,
      value: option.venueId,
    })),
  ]
}

function buildYearOptions(input: {
  data: TeamAssetsChromeData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
        },
      }),
      label: "Year",
      value: "",
    },
    ...input.data.filterOptions.years.map((option: TeamAssetYearFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: option.year,
        },
      }),
      label: option.label,
      value: String(option.year),
    })),
  ]
}

function buildCampOptions(input: {
  data: TeamAssetsChromeData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
        },
      }),
      label: "Camp",
      value: "",
    },
    ...input.data.filterOptions.camps.map((option: TeamAssetCampFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: option.campId,
        },
      }),
      label: option.label,
      value: option.campId,
    })),
  ]
}

function buildSessionOptions(input: {
  data: TeamAssetsChromeData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: input.data.selectedFilters.campId,
        },
      }),
      label: "Session",
      value: "",
    },
    ...input.data.filterOptions.sessions.map((option: TeamAssetSessionFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: input.data.selectedFilters.campId,
          sessionId: option.sessionId,
        },
      }),
      label: option.label,
      value: option.sessionId,
    })),
  ]
}

function TeamAssetTabs(input: {
  isNavigating: boolean
  onTabChange: (tab: TeamAssetTab) => void
  tab: TeamAssetTab
}) {
  return (
    <Tabs
      value={input.tab}
      onValueChange={(value) =>
        input.onTabChange(value === "files" || value === "gps-files" ? value : "images")
      }
      className="w-full min-w-0 md:w-auto"
    >
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
        <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
          <TabsTrigger
            value="images"
            disabled={input.isNavigating}
            className="min-w-0 basis-0 px-2"
          >
            Images
          </TabsTrigger>
          <TabsTrigger
            value="files"
            disabled={input.isNavigating}
            className="min-w-0 basis-0 px-2"
          >
            Files
          </TabsTrigger>
          <TabsTrigger
            value="gps-files"
            disabled={input.isNavigating}
            className="min-w-0 basis-0 px-2"
          >
            Vakaros
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsList className="hidden h-10 w-80 md:inline-flex">
        <TabsTrigger
          value="images"
          disabled={input.isNavigating}
          className="min-w-0 basis-0"
        >
          Images
        </TabsTrigger>
        <TabsTrigger
          value="files"
          disabled={input.isNavigating}
          className="min-w-0 basis-0"
        >
          Files
        </TabsTrigger>
        <TabsTrigger
          value="gps-files"
          disabled={input.isNavigating}
          className="min-w-0 basis-0"
        >
          Vakaros
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function MobileSelect(input: {
  id: string
  label: string
  onChange: (value: string) => void
  options: FilterOption[]
  value: string
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={input.id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {input.label}
      </label>
      <select
        id={input.id}
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] md:text-sm"
      >
        {input.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TeamAssetsToolbar(input: {
  data: TeamAssetsChromeData
  isNavigating: boolean
  onNavigate: (href: string) => void
  onTabChange: (tab: TeamAssetTab) => void
  scope: NavigationScope
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [draftFilters, setDraftFilters] = React.useState<TeamAssetSelectedFilters>(
    input.data.selectedFilters,
  )
  const venueOptions = buildVenueOptions(input)
  const yearOptions = buildYearOptions(input)
  const campOptions = buildCampOptions(input)
  const sessionOptions = buildSessionOptions(input)
  const selectedYearValue =
    typeof input.data.selectedFilters.year === "number"
      ? String(input.data.selectedFilters.year)
      : ""

  function navigateWithDraft(): void {
    input.onNavigate(
      buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: draftFilters,
      }),
    )
    setDrawerOpen(false)
  }

  function clearFilters(): void {
    const href = buildHref({
      scope: input.scope,
      tab: input.data.tab,
      filters: {},
    })

    setDraftFilters({})
    input.onNavigate(href)
    setDrawerOpen(false)
  }

  return (
    <>
      <section className="flex items-center justify-between gap-3 md:hidden">
        <div className="min-w-0 flex-1">
          <TeamAssetTabs
            isNavigating={input.isNavigating}
            onTabChange={input.onTabChange}
            tab={input.data.tab}
          />
        </div>
        <Drawer
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open)

            if (open) {
              setDraftFilters(input.data.selectedFilters)
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="default"
              disabled={input.isNavigating}
              aria-label="Filters"
              className={cn(
                "h-11 w-11 px-0",
                input.data.hasActiveFilters &&
                  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
              )}
            >
              <FilterIcon className="size-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>Filters</DrawerTitle>
            </DrawerHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
              <MobileSelect
                id="mobile-assets-venue-filter"
                label="Venue"
                value={draftFilters.venueId ?? ""}
                options={venueOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    venueId: value || undefined,
                    campId: undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-year-filter"
                label="Year"
                value={typeof draftFilters.year === "number" ? String(draftFilters.year) : ""}
                options={yearOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    year: value ? Number.parseInt(value, 10) : undefined,
                    campId: undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-camp-filter"
                label="Camp"
                value={draftFilters.campId ?? ""}
                options={campOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    campId: value || undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-session-filter"
                label="Session"
                value={draftFilters.sessionId ?? ""}
                options={sessionOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    sessionId: value || undefined,
                  }))
                }
              />
            </div>

            <DrawerFooter className="shrink-0 border-t">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={input.isNavigating || !input.data.hasActiveFilters}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={input.isNavigating}
                onClick={navigateWithDraft}
              >
                Apply
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </section>

      <section className="hidden items-center justify-between gap-3 md:flex">
        <TeamAssetTabs
          isNavigating={input.isNavigating}
          onTabChange={input.onTabChange}
          tab={input.data.tab}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterDropdown
            label="Venue"
            options={venueOptions}
            selectedValue={input.data.selectedFilters.venueId ?? ""}
            disabled={input.data.filterOptions.venues.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Year"
            options={yearOptions}
            selectedValue={selectedYearValue}
            disabled={input.data.filterOptions.years.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Camp"
            options={campOptions}
            selectedValue={input.data.selectedFilters.campId ?? ""}
            disabled={input.data.filterOptions.camps.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Session"
            options={sessionOptions}
            selectedValue={input.data.selectedFilters.sessionId ?? ""}
            disabled={input.data.filterOptions.sessions.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
        </div>
      </section>
    </>
  )
}

export function TeamAssetsRouteShell(input: {
  children: React.ReactNode
  chromeData: TeamAssetsChromeData
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isRoutePending, startRouteTransition] = React.useTransition()
  const [pendingNavigation, setPendingNavigation] = React.useState<PendingNavigation | null>(
    null,
  )
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isNavigating = isRoutePending || pendingNavigation?.fromHref === currentHref

  React.useEffect(() => {
    if (pendingNavigation?.toHref === currentHref) {
      setPendingNavigation(null)
    }
  }, [currentHref, pendingNavigation])

  React.useEffect(() => {
    if (!pendingNavigation) {
      return
    }

    const timeout = window.setTimeout(() => {
      setPendingNavigation(null)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [pendingNavigation])

  function navigateToHref(href: string): void {
    const nextHref = normalizeInternalHref(href)

    if (isNavigating || nextHref === currentHref) {
      return
    }

    setPendingNavigation({
      fromHref: currentHref,
      toHref: nextHref,
    })
    startRouteTransition(() => {
      router.push(href)
    })
  }

  function navigateToTab(tab: TeamAssetTab): void {
    navigateToHref(
      buildHref({
        scope: input.scope,
        tab,
        filters: input.chromeData.selectedFilters,
      }),
    )
  }

  return (
    <section className="space-y-4">
      <TeamAssetsToolbar
        data={input.chromeData}
        isNavigating={isNavigating}
        onTabChange={navigateToTab}
        onNavigate={navigateToHref}
        scope={input.scope}
      />

      <div aria-busy={isNavigating} className="relative">
        <div
          aria-disabled={isNavigating}
          className={cn(
            "transition-opacity",
            isNavigating && "pointer-events-none select-none opacity-40",
          )}
        >
          {input.children}
        </div>

        {isNavigating ? (
          <>
            <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
              <div
                role="status"
                aria-label="Loading assets"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading assets"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
