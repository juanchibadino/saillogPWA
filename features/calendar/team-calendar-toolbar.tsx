"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  buildTeamCalendarHref,
  type TeamCalendarHrefInput,
} from "@/features/calendar/navigation"
import type {
  TeamCalendarEventFilter,
  TeamCalendarTimeFilter,
} from "@/features/calendar/data"
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

type CalendarToolbarOption = {
  href: string
  label: string
  value: string
}

export type TeamCalendarToolbarNavigationProps = {
  isNavigating?: boolean
  onNavigate?: (href: string) => void
}

function CalendarFilterDropdown({
  disabled,
  isNavigating = false,
  label,
  onNavigate,
  options,
  selectedValue,
}: {
  disabled: boolean
  label: string
  options: CalendarToolbarOption[]
  selectedValue: string
} & TeamCalendarToolbarNavigationProps) {
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
        <DropdownMenuContent align="end" className="min-w-48">
          {options.map((option) => {
            const isActive = option.value === selectedValue

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={isNavigating}
                className="gap-2"
                onClick={() => {
                  if (!isActive) {
                    navigateToHref(option.href)
                  }
                }}
              >
                <span className="flex size-4 items-center justify-center">
                  {isActive ? <CheckIcon className="size-4" /> : null}
                </span>
                <span className="flex-1 truncate">{option.label}</span>
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

function normalizeTimeFilter(value: string): TeamCalendarTimeFilter {
  return value === "all" ? "all" : "future"
}

function normalizeEventFilter(value: string): TeamCalendarEventFilter | undefined {
  const [sourceType, sourceId] = value.split(":")

  if ((sourceType !== "camp" && sourceType !== "event") || !sourceId) {
    return undefined
  }

  return {
    sourceType,
    sourceId,
    value,
  }
}

export function TeamCalendarToolbar({
  action,
  buildHref = buildTeamCalendarHref,
  disabled = false,
  eventOptions,
  isNavigating = false,
  memberOptions,
  onNavigate,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
}: {
  action?: ReactNode
  buildHref?: (input: TeamCalendarHrefInput) => string
  disabled?: boolean
  eventOptions: CalendarToolbarOption[]
  memberOptions: CalendarToolbarOption[]
  scope: TeamCalendarHrefInput["scope"]
  selectedEventValue: string
  selectedMemberId: string
  selectedTimeFilter: TeamCalendarTimeFilter
} & TeamCalendarToolbarNavigationProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftMemberId, setDraftMemberId] = useState(selectedMemberId)
  const [draftEventValue, setDraftEventValue] = useState(selectedEventValue)
  const [draftTimeFilter, setDraftTimeFilter] = useState(selectedTimeFilter)
  const hasActiveFilter =
    selectedMemberId.length > 0 ||
    selectedEventValue.length > 0 ||
    selectedTimeFilter === "all"
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
        memberId: draftMemberId || undefined,
        eventFilter: normalizeEventFilter(draftEventValue),
        timeFilter: normalizeTimeFilter(draftTimeFilter),
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
              setDraftMemberId(selectedMemberId)
              setDraftEventValue(selectedEventValue)
              setDraftTimeFilter(selectedTimeFilter)
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
                  htmlFor="mobile-calendar-member-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Member
                </label>
                <select
                  id="mobile-calendar-member-filter"
                  value={draftMemberId}
                  onChange={(event) => setDraftMemberId(event.target.value)}
                  disabled={isDisabled}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  {memberOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="mobile-calendar-event-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Event
                </label>
                <select
                  id="mobile-calendar-event-filter"
                  value={draftEventValue}
                  onChange={(event) => setDraftEventValue(event.target.value)}
                  disabled={isDisabled}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  {eventOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="mobile-calendar-time-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Time
                </label>
                <select
                  id="mobile-calendar-time-filter"
                  value={draftTimeFilter}
                  onChange={(event) =>
                    setDraftTimeFilter(normalizeTimeFilter(event.target.value))
                  }
                  disabled={isDisabled}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  <option value="future">Future days</option>
                  <option value="all">All</option>
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
      <CalendarFilterDropdown
        label="Member"
        options={memberOptions}
        selectedValue={selectedMemberId}
        disabled={false}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      <CalendarFilterDropdown
        label="Event"
        options={eventOptions}
        selectedValue={selectedEventValue}
        disabled={false}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      <CalendarFilterDropdown
        label="Time"
        options={[
          {
            value: "",
            label: "Future days",
            href: buildHref({
              scope,
              memberId: selectedMemberId || undefined,
              eventFilter: normalizeEventFilter(selectedEventValue),
              timeFilter: "future",
            }),
          },
          {
            value: "all",
            label: "All",
            href: buildHref({
              scope,
              memberId: selectedMemberId || undefined,
              eventFilter: normalizeEventFilter(selectedEventValue),
              timeFilter: "all",
            }),
          },
        ]}
        selectedValue={selectedTimeFilter === "all" ? "all" : ""}
        disabled={false}
        isNavigating={isDisabled}
        onNavigate={onNavigate}
      />
      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
