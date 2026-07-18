"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
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
import type { TeamNoteVenueFilterOption } from "@/features/notes/data"
import { buildTeamNotesHref } from "@/features/notes/list-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type TeamNotesNavigateOptions = {
  replace?: boolean
}

type TeamNotesToolbarNavigate = (
  href: string,
  options?: TeamNotesNavigateOptions,
) => void

function toggleValue(currentValues: string[], value: string): string[] {
  if (currentValues.includes(value)) {
    return currentValues.filter((currentValue) => currentValue !== value)
  }

  return [...currentValues, value]
}

function buildNotesHref(input: {
  scope: NavigationScope
  searchQuery: string
  venueId?: string
  twsValues: string[]
  conditionsValues: string[]
}): string {
  return buildTeamNotesHref({
    scopeOrgId: input.scope.activeOrgId,
    scopeTeamId: input.scope.activeTeamId,
    searchQuery: input.searchQuery,
    venueId: input.venueId,
    twsValues: input.twsValues,
    conditionsValues: input.conditionsValues,
    page: 1,
  })
}

function SelectIndicator({ active }: { active: boolean }) {
  return (
    <span className="flex size-4 items-center justify-center">
      {active ? <CheckIcon className="size-4" /> : null}
    </span>
  )
}

function FilterBadge({ value }: { value: number }) {
  if (value <= 0) {
    return null
  }

  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
      {value}
    </span>
  )
}

function TeamNotesFilterDropdown(input: {
  disabled: boolean
  hasActiveFilter: boolean
  label: string
  badgeValue?: number
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={input.disabled}
            className={cn(
              input.hasActiveFilter &&
                "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
            )}
          />
        }
      >
        <FilterIcon className="size-4" />
        <span>{input.label}</span>
        <FilterBadge value={input.badgeValue ?? 0} />
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      {input.children}
    </DropdownMenu>
  )
}

function MobileFilterOption(input: {
  active: boolean
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={input.disabled}
      className={cn(
        buttonVariants({
          variant: input.active ? "secondary" : "ghost",
          className: "h-11 w-full justify-start gap-3 px-3",
        }),
      )}
      onClick={input.onClick}
    >
      <SelectIndicator active={input.active} />
      <span className="min-w-0 flex-1 truncate text-left">{input.children}</span>
    </button>
  )
}

export function TeamNotesToolbar(input: {
  scope: NavigationScope
  searchQuery: string
  selectedVenueId?: string
  selectedTwsValues: string[]
  selectedConditionsValues: string[]
  venueFilterOptions: TeamNoteVenueFilterOption[]
  twsFilterOptions: string[]
  conditionsFilterOptions: string[]
  isNavigating?: boolean
  onNavigate: TeamNotesToolbarNavigate
}) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false)
  const [isSearchPending, setIsSearchPending] = React.useState(false)
  const [searchText, setSearchText] = React.useState(input.searchQuery)
  const [draftVenueId, setDraftVenueId] = React.useState<string | undefined>(
    input.selectedVenueId,
  )
  const [draftTwsValues, setDraftTwsValues] = React.useState(
    input.selectedTwsValues,
  )
  const [draftConditionsValues, setDraftConditionsValues] = React.useState(
    input.selectedConditionsValues,
  )
  const isNavigating = input.isNavigating === true
  const normalizedSearchText = searchText.trim()
  const hasSearchDraftChange = normalizedSearchText !== input.searchQuery
  const showSearchPending = isSearchPending && isNavigating
  const hasActiveFilters =
    Boolean(input.selectedVenueId) ||
    input.selectedTwsValues.length > 0 ||
    input.selectedConditionsValues.length > 0

  React.useEffect(() => {
    setSearchText(input.searchQuery)
  }, [input.searchQuery])

  React.useEffect(() => {
    if (!isFilterDrawerOpen) {
      return
    }

    setDraftVenueId(input.selectedVenueId)
    setDraftTwsValues(input.selectedTwsValues)
    setDraftConditionsValues(input.selectedConditionsValues)
  }, [
    input.selectedConditionsValues,
    input.selectedTwsValues,
    input.selectedVenueId,
    isFilterDrawerOpen,
  ])

  React.useEffect(() => {
    if (!isNavigating) {
      setIsSearchPending(false)
    }
  }, [isNavigating])

  function navigateToHref(href: string, options?: TeamNotesNavigateOptions) {
    input.onNavigate(href, options)
  }

  function handleSearchChange(nextQuery: string) {
    setSearchText(nextQuery)
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isNavigating || !hasSearchDraftChange) {
      return
    }

    setIsSearchPending(true)
    navigateToHref(
      buildNotesHref({
        scope: input.scope,
        searchQuery: searchText,
        venueId: input.selectedVenueId,
        twsValues: input.selectedTwsValues,
        conditionsValues: input.selectedConditionsValues,
      }),
      { replace: true },
    )
  }

  function applyMobileFilters() {
    setIsFilterDrawerOpen(false)
    navigateToHref(
      buildNotesHref({
        scope: input.scope,
        searchQuery: searchText,
        venueId: draftVenueId,
        twsValues: draftTwsValues,
        conditionsValues: draftConditionsValues,
      }),
    )
  }

  function clearMobileFilters() {
    setDraftVenueId(undefined)
    setDraftTwsValues([])
    setDraftConditionsValues([])
    setIsFilterDrawerOpen(false)
    navigateToHref(
      buildNotesHref({
        scope: input.scope,
        searchQuery: searchText,
        twsValues: [],
        conditionsValues: [],
      }),
    )
  }

  return (
    <section className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex w-full items-center gap-2 md:max-w-md">
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={handleSearchSubmit}
        >
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search notes, setup, venue..."
              className="h-11 pl-9 md:h-8"
              aria-label="Search notes"
              disabled={isNavigating}
            />
          </div>
          <Button
            type="submit"
            disabled={isNavigating || !hasSearchDraftChange}
            aria-label="Search notes"
            className="h-11 w-11 md:h-8 md:w-auto md:px-3"
          >
            {showSearchPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SearchIcon className="size-4" />
            )}
            <span className="hidden md:inline">
              {showSearchPending ? "Searching..." : "Search"}
            </span>
          </Button>
        </form>

        <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
          <button
            type="button"
            disabled={isNavigating}
            aria-label="Filter notes"
            aria-haspopup="dialog"
            aria-expanded={isFilterDrawerOpen}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-11 w-11 md:hidden",
              hasActiveFilters &&
                "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
            )}
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <FilterIcon className="size-4" />
          </button>
          <DrawerContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden">
            <DrawerHeader className="shrink-0 border-b text-left">
              <DrawerTitle>Filters</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Venue</h3>
                <div className="space-y-2">
                  <MobileFilterOption
                    active={!draftVenueId}
                    disabled={isNavigating}
                    onClick={() => setDraftVenueId(undefined)}
                  >
                    All venues
                  </MobileFilterOption>
                  {input.venueFilterOptions.map((option) => (
                    <MobileFilterOption
                      key={option.venueId}
                      active={draftVenueId === option.venueId}
                      disabled={isNavigating}
                      onClick={() => setDraftVenueId(option.venueId)}
                    >
                      {option.venueName}
                    </MobileFilterOption>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">TWS</h3>
                <div className="space-y-2">
                  <MobileFilterOption
                    active={draftTwsValues.length === 0}
                    disabled={isNavigating}
                    onClick={() => setDraftTwsValues([])}
                  >
                    All
                  </MobileFilterOption>
                  {input.twsFilterOptions.map((option) => (
                    <MobileFilterOption
                      key={option}
                      active={draftTwsValues.includes(option)}
                      disabled={isNavigating}
                      onClick={() => setDraftTwsValues((current) => toggleValue(current, option))}
                    >
                      {option}
                    </MobileFilterOption>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Conditions</h3>
                <div className="space-y-2">
                  <MobileFilterOption
                    active={draftConditionsValues.length === 0}
                    disabled={isNavigating}
                    onClick={() => setDraftConditionsValues([])}
                  >
                    All
                  </MobileFilterOption>
                  {input.conditionsFilterOptions.map((option) => (
                    <MobileFilterOption
                      key={option}
                      active={draftConditionsValues.includes(option)}
                      disabled={isNavigating}
                      onClick={() =>
                        setDraftConditionsValues((current) => toggleValue(current, option))
                      }
                    >
                      {option}
                    </MobileFilterOption>
                  ))}
                </div>
              </section>
            </div>
            <DrawerFooter className="grid shrink-0 grid-cols-2 gap-2 border-t">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
                disabled={isNavigating || !hasActiveFilters}
                onClick={clearMobileFilters}
              >
                Clear
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}
                disabled={isNavigating}
                onClick={applyMobileFilters}
              >
                Apply
              </button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <section className="hidden w-full items-center justify-end gap-2 md:flex md:w-auto">
        <TeamNotesFilterDropdown
          label="Venue"
          disabled={isNavigating || input.venueFilterOptions.length === 0}
          hasActiveFilter={Boolean(input.selectedVenueId)}
        >
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              onClick={() => {
                if (input.selectedVenueId) {
                  navigateToHref(
                    buildNotesHref({
                      scope: input.scope,
                      searchQuery: searchText,
                      twsValues: input.selectedTwsValues,
                      conditionsValues: input.selectedConditionsValues,
                    }),
                  )
                }
              }}
              disabled={isNavigating}
              className="gap-2"
            >
              <SelectIndicator active={!input.selectedVenueId} />
              <span className="flex-1">All venues</span>
            </DropdownMenuItem>
            {input.venueFilterOptions.map((option) => {
              const isActive = input.selectedVenueId === option.venueId

              return (
                <DropdownMenuItem
                  key={option.venueId}
                  onClick={() => {
                    if (!isActive) {
                      navigateToHref(
                        buildNotesHref({
                          scope: input.scope,
                          searchQuery: searchText,
                          venueId: option.venueId,
                          twsValues: input.selectedTwsValues,
                          conditionsValues: input.selectedConditionsValues,
                        }),
                      )
                    }
                  }}
                  disabled={isNavigating}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option.venueName}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </TeamNotesFilterDropdown>

        <TeamNotesFilterDropdown
          label="TWS"
          disabled={isNavigating || input.twsFilterOptions.length === 0}
          hasActiveFilter={input.selectedTwsValues.length > 0}
          badgeValue={input.selectedTwsValues.length}
        >
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem
              onClick={() => {
                if (input.selectedTwsValues.length > 0) {
                  navigateToHref(
                    buildNotesHref({
                      scope: input.scope,
                      searchQuery: searchText,
                      venueId: input.selectedVenueId,
                      twsValues: [],
                      conditionsValues: input.selectedConditionsValues,
                    }),
                  )
                }
              }}
              disabled={isNavigating}
              className="gap-2"
            >
              <SelectIndicator active={input.selectedTwsValues.length === 0} />
              <span className="flex-1">All</span>
            </DropdownMenuItem>
            {input.twsFilterOptions.map((option) => {
              const isActive = input.selectedTwsValues.includes(option)

              return (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    navigateToHref(
                      buildNotesHref({
                        scope: input.scope,
                        searchQuery: searchText,
                        venueId: input.selectedVenueId,
                        twsValues: toggleValue(input.selectedTwsValues, option),
                        conditionsValues: input.selectedConditionsValues,
                      }),
                    )
                  }}
                  disabled={isNavigating}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </TeamNotesFilterDropdown>

        <TeamNotesFilterDropdown
          label="Conditions"
          disabled={isNavigating || input.conditionsFilterOptions.length === 0}
          hasActiveFilter={input.selectedConditionsValues.length > 0}
          badgeValue={input.selectedConditionsValues.length}
        >
          <DropdownMenuContent align="end" className="min-w-72 max-w-[90vw]">
            <DropdownMenuItem
              onClick={() => {
                if (input.selectedConditionsValues.length > 0) {
                  navigateToHref(
                    buildNotesHref({
                      scope: input.scope,
                      searchQuery: searchText,
                      venueId: input.selectedVenueId,
                      twsValues: input.selectedTwsValues,
                      conditionsValues: [],
                    }),
                  )
                }
              }}
              disabled={isNavigating}
              className="gap-2"
            >
              <SelectIndicator active={input.selectedConditionsValues.length === 0} />
              <span className="flex-1">All</span>
            </DropdownMenuItem>
            {input.conditionsFilterOptions.map((option) => {
              const isActive = input.selectedConditionsValues.includes(option)

              return (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    navigateToHref(
                      buildNotesHref({
                        scope: input.scope,
                        searchQuery: searchText,
                        venueId: input.selectedVenueId,
                        twsValues: input.selectedTwsValues,
                        conditionsValues: toggleValue(
                          input.selectedConditionsValues,
                          option,
                        ),
                      }),
                    )
                  }}
                  disabled={isNavigating}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </TeamNotesFilterDropdown>
      </section>
    </section>
  )
}
