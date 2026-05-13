"use client"

import { CheckIcon, ChevronDownIcon, FilterIcon, SearchIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { TeamNoteVenueFilterOption } from "@/features/notes/data"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 300

function buildTeamNotesHref(input: {
  scope: NavigationScope
  searchQuery?: string
  venueId?: string
  twsValues: string[]
  conditionsValues: string[]
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  const normalizedSearch = input.searchQuery?.trim()
  if (normalizedSearch && normalizedSearch.length > 0) {
    params.set("q", normalizedSearch)
  }

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  for (const twsValue of input.twsValues) {
    params.append("tws", twsValue)
  }

  for (const conditionValue of input.conditionsValues) {
    params.append("conditions", conditionValue)
  }

  return `/team-notes?${params.toString()}`
}

function toggleValue(currentValues: string[], value: string): string[] {
  if (currentValues.includes(value)) {
    return currentValues.filter((currentValue) => currentValue !== value)
  }

  return [...currentValues, value]
}

function FilterDropdownButton(input: {
  label: string
  hasActiveFilter: boolean
  badgeValue?: number
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        input.hasActiveFilter &&
          "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
      )}
    >
      <FilterIcon className="size-4" />
      <span>{input.label}</span>
      {typeof input.badgeValue === "number" && input.badgeValue > 0 ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
          {input.badgeValue}
        </span>
      ) : null}
      <ChevronDownIcon className="size-4" />
    </Button>
  )
}

function SelectIndicator({ active }: { active: boolean }) {
  return (
    <span className="flex size-4 items-center justify-center">
      {active ? <CheckIcon className="size-4" /> : null}
    </span>
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
}) {
  const router = useRouter()
  const [searchText, setSearchText] = useState(input.searchQuery)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [])

  function queueSearch(nextQuery: string) {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    searchTimerRef.current = setTimeout(() => {
      router.replace(
        buildTeamNotesHref({
          scope: input.scope,
          searchQuery: nextQuery,
          venueId: input.selectedVenueId,
          twsValues: input.selectedTwsValues,
          conditionsValues: input.selectedConditionsValues,
        }),
      )
    }, SEARCH_DEBOUNCE_MS)
  }

  function handleSearchChange(nextQuery: string) {
    setSearchText(nextQuery)
    queueSearch(nextQuery)
  }

  return (
    <section className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search notes, setup, venue..."
          className="pl-9"
        />
      </div>

      <section className="flex w-full items-center justify-end gap-2 md:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <FilterDropdownButton
                label="Venue"
                hasActiveFilter={Boolean(input.selectedVenueId)}
              />
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              onClick={() => {
                if (!input.selectedVenueId) {
                  return
                }

                router.push(
                  buildTeamNotesHref({
                    scope: input.scope,
                    searchQuery: searchText,
                    twsValues: input.selectedTwsValues,
                    conditionsValues: input.selectedConditionsValues,
                  }),
                )
              }}
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
                    if (isActive) {
                      return
                    }

                    router.push(
                      buildTeamNotesHref({
                        scope: input.scope,
                        searchQuery: searchText,
                        venueId: option.venueId,
                        twsValues: input.selectedTwsValues,
                        conditionsValues: input.selectedConditionsValues,
                      }),
                    )
                  }}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option.venueName}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <FilterDropdownButton
                label="TWS"
                hasActiveFilter={input.selectedTwsValues.length > 0}
                badgeValue={input.selectedTwsValues.length}
              />
            }
          />
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem
              onClick={() => {
                if (input.selectedTwsValues.length === 0) {
                  return
                }

                router.push(
                  buildTeamNotesHref({
                    scope: input.scope,
                    searchQuery: searchText,
                    venueId: input.selectedVenueId,
                    twsValues: [],
                    conditionsValues: input.selectedConditionsValues,
                  }),
                )
              }}
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
                    const nextValues = toggleValue(input.selectedTwsValues, option)

                    router.push(
                      buildTeamNotesHref({
                        scope: input.scope,
                        searchQuery: searchText,
                        venueId: input.selectedVenueId,
                        twsValues: nextValues,
                        conditionsValues: input.selectedConditionsValues,
                      }),
                    )
                  }}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <FilterDropdownButton
                label="Conditions"
                hasActiveFilter={input.selectedConditionsValues.length > 0}
                badgeValue={input.selectedConditionsValues.length}
              />
            }
          />
          <DropdownMenuContent align="end" className="min-w-72 max-w-[90vw]">
            <DropdownMenuItem
              onClick={() => {
                if (input.selectedConditionsValues.length === 0) {
                  return
                }

                router.push(
                  buildTeamNotesHref({
                    scope: input.scope,
                    searchQuery: searchText,
                    venueId: input.selectedVenueId,
                    twsValues: input.selectedTwsValues,
                    conditionsValues: [],
                  }),
                )
              }}
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
                    const nextValues = toggleValue(input.selectedConditionsValues, option)

                    router.push(
                      buildTeamNotesHref({
                        scope: input.scope,
                        searchQuery: searchText,
                        venueId: input.selectedVenueId,
                        twsValues: input.selectedTwsValues,
                        conditionsValues: nextValues,
                      }),
                    )
                  }}
                  className="gap-2"
                >
                  <SelectIndicator active={isActive} />
                  <span className="flex-1">{option}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
    </section>
  )
}
