"use client"

import type { ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export function TeamSessionsToolbar({
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
  return (
    <section className="flex w-full items-center justify-end gap-2">
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
