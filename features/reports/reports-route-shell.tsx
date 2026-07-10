"use client"

import { useState, useTransition, type FormEvent, type ReactNode } from "react"
import { FilterIcon, Loader2Icon, XIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  CreateTeamReportDialog,
  type TeamReportCreateCampOption,
  type TeamReportCreateVenueOption,
} from "@/features/reports/report-form-dialogs"
import type { OrganizationReportsChromeData } from "@/features/reports/data"
import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type PendingFilterNavigation = {
  fromHref: string
  toHref: string
}

type OrganizationReportsFilterValues = {
  year: number
  teamId: string | null
  venueId: string | null
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
}

function buildOrganizationReportsHref(input: {
  scope: NavigationScope
  values: OrganizationReportsFilterValues
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("year", String(input.values.year))

  if (input.values.teamId) {
    params.set("team", input.values.teamId)
  }

  if (input.values.venueId) {
    params.set("venue", input.values.venueId)
  }

  return `/reports?${params.toString()}`
}

function parseFilterYear(value: FormDataEntryValue | null, fallbackYear: number): number {
  if (typeof value !== "string") {
    return fallbackYear
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return fallbackYear
  }

  return parsed
}

function getOptionalFilterValue(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function OrganizationReportsFilterForm({
  chromeData,
  currentYear,
  disabled,
  onApply,
  onClear,
  requestedYear,
  surface,
}: {
  chromeData: OrganizationReportsChromeData
  currentYear: number
  disabled: boolean
  onApply: (values: OrganizationReportsFilterValues) => void
  onClear: () => void
  requestedYear: number
  surface: "desktop" | "drawer"
}) {
  const isDrawer = surface === "drawer"
  const hasActiveFilters =
    requestedYear !== currentYear ||
    chromeData.selectedTeamId !== null ||
    chromeData.selectedVenueId !== null

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    onApply({
      year: parseFilterYear(formData.get("year"), requestedYear),
      teamId: getOptionalFilterValue(formData.get("team")),
      venueId: getOptionalFilterValue(formData.get("venue")),
    })
  }

  const fieldClassName = isDrawer ? "space-y-2" : "space-y-1"
  const controlClassName = isDrawer
    ? "flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base md:text-sm"
    : "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isDrawer
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "hidden flex-wrap items-end gap-3 md:flex"
      }
    >
      <div
        className={
          isDrawer
            ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
            : "contents"
        }
      >
        <div className={fieldClassName}>
          <label htmlFor={`reports-${surface}-year`} className="text-sm font-medium">
            Year
          </label>
          <input
            id={`reports-${surface}-year`}
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={requestedYear}
            disabled={disabled}
            className={cn(controlClassName, isDrawer ? undefined : "w-32")}
          />
        </div>

        <div className={fieldClassName}>
          <label htmlFor={`reports-${surface}-team`} className="text-sm font-medium">
            Team
          </label>
          <select
            id={`reports-${surface}-team`}
            name="team"
            defaultValue={chromeData.selectedTeamId ?? ""}
            disabled={disabled || chromeData.teamOptions.length === 0}
            className={cn(controlClassName, isDrawer ? undefined : "w-72")}
          >
            <option value="">All teams</option>
            {chromeData.teamOptions.map((option) => (
              <option key={option.teamId} value={option.teamId}>
                {option.teamName}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClassName}>
          <label htmlFor={`reports-${surface}-venue`} className="text-sm font-medium">
            Venue
          </label>
          <select
            id={`reports-${surface}-venue`}
            name="venue"
            defaultValue={chromeData.selectedVenueId ?? ""}
            disabled={disabled || chromeData.venueOptions.length === 0}
            className={cn(controlClassName, isDrawer ? undefined : "w-80")}
          >
            <option value="">All venues</option>
            {chromeData.venueOptions.map((option) => (
              <option key={option.teamVenueId} value={option.teamVenueId}>
                {option.teamName} - {option.venueName}
              </option>
            ))}
          </select>
        </div>

        {!isDrawer ? (
          <>
            <Button type="submit" variant="outline" size="lg" disabled={disabled}>
              Apply
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                disabled={disabled}
                aria-label="Clear report filters"
                onClick={onClear}
              >
                <XIcon className="size-4" />
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {isDrawer ? (
        <DrawerFooter className="shrink-0 border-t">
          <Button type="submit" disabled={disabled} className="h-11 w-full">
            Apply
          </Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-11 w-full"
              onClick={onClear}
            >
              Clear
            </Button>
          ) : null}
        </DrawerFooter>
      ) : null}
    </form>
  )
}

export function OrganizationReportsRouteShell({
  children,
  chromeData,
  currentYear,
  requestedYear,
  scope,
}: {
  children: ReactNode
  chromeData: OrganizationReportsChromeData
  currentYear: number
  requestedYear: number
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  function navigateToFilters(values: OrganizationReportsFilterValues): void {
    const href = buildOrganizationReportsHref({ scope, values })
    const nextHref = normalizeInternalHref(href)

    if (isFilterNavigationBusy || nextHref === currentHref) {
      setDrawerOpen(false)
      return
    }

    setPendingFilterNavigation({
      fromHref: currentHref,
      toHref: nextHref,
    })
    setDrawerOpen(false)
    startFilterNavigationTransition(() => {
      router.push(href)
    })
  }

  function clearFilters(): void {
    navigateToFilters({
      year: currentYear,
      teamId: null,
      venueId: null,
    })
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Reports
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Reports</h2>

        <div className="hidden md:block">
          <OrganizationReportsFilterForm
            chromeData={chromeData}
            currentYear={currentYear}
            disabled={isFilterNavigationBusy}
            onApply={navigateToFilters}
            onClear={clearFilters}
            requestedYear={requestedYear}
            surface="desktop"
          />
        </div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-3 md:hidden"
            disabled={isFilterNavigationBusy}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <FilterIcon className="size-4" />
            Filters
          </Button>

          <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
            <DrawerHeader className="shrink-0 border-b text-left">
              <DrawerTitle>Filters</DrawerTitle>
            </DrawerHeader>
            <OrganizationReportsFilterForm
              chromeData={chromeData}
              currentYear={currentYear}
              disabled={isFilterNavigationBusy}
              onApply={navigateToFilters}
              onClear={clearFilters}
              requestedYear={requestedYear}
              surface="drawer"
            />
          </DrawerContent>
        </Drawer>
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
                aria-label="Loading filtered reports"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered reports"
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

export function TeamReportsRouteShell({
  canManageReports,
  children,
  currentPage,
  dialogCampOptions,
  redirectTo,
  scope,
  venueOptions,
}: {
  canManageReports: boolean
  children: ReactNode
  currentPage: number
  dialogCampOptions: TeamReportCreateCampOption[]
  redirectTo: string
  scope: NavigationScope
  venueOptions: TeamReportCreateVenueOption[]
}) {
  const createDisabled = venueOptions.length === 0 || dialogCampOptions.length === 0

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Reports
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Reports</h2>

        {canManageReports ? (
          <div className="hidden md:block">
            <CreateTeamReportDialog
              scope={scope}
              redirectTo={redirectTo}
              venueOptions={venueOptions}
              campOptions={dialogCampOptions}
              currentPage={currentPage}
              disabled={createDisabled}
            />
          </div>
        ) : null}
      </header>

      {children}

      {canManageReports ? (
        <CreateTeamReportDialog
          scope={scope}
          redirectTo={redirectTo}
          venueOptions={venueOptions}
          campOptions={dialogCampOptions}
          currentPage={currentPage}
          disabled={createDisabled}
          surface="drawer"
          triggerVariant="fab"
        />
      ) : null}
    </section>
  )
}
