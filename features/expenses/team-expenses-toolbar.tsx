"use client"

import * as React from "react"
import type { ReactNode } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FilterIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
import { cn } from "@/lib/utils"

export type TeamExpensesToolbarOption = {
  href: string
  label: string
  value: string
}

type ExpenseFilterGroup = {
  label: string
  options: TeamExpensesToolbarOption[]
  selectedValue: string
}

function ExpenseFilterDropdown({
  disabled,
  group,
  isNavigating,
  onNavigate,
}: {
  disabled: boolean
  group: ExpenseFilterGroup
  isNavigating: boolean
  onNavigate: (href: string) => void
}) {
  const hasActiveFilter = group.selectedValue.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isNavigating}
            className={cn(
              hasActiveFilter &&
                "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
            )}
          />
        }
      >
        <FilterIcon className="size-4" />
        <span>{group.label}</span>
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {group.options.map((option) => {
          const isActive = option.value === group.selectedValue

          return (
            <DropdownMenuItem
              key={`${group.label}-${option.value}`}
              disabled={isNavigating}
              onClick={() => {
                if (!isActive) {
                  onNavigate(option.href)
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

function ExpenseFilterDrawerGroup({
  disabled,
  group,
  onNavigate,
}: {
  disabled: boolean
  group: ExpenseFilterGroup
  onNavigate: (href: string) => void
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{group.label}</h3>
      <div className="space-y-2">
        {group.options.map((option) => {
          const isActive = option.value === group.selectedValue

          return (
            <button
              key={`${group.label}-${option.value}`}
              type="button"
              disabled={disabled}
              className={cn(
                buttonVariants({
                  variant: isActive ? "secondary" : "ghost",
                  className: "h-11 w-full justify-start gap-3 px-3",
                }),
              )}
              onClick={() => {
                if (!isActive) {
                  onNavigate(option.href)
                }
              }}
            >
              <span className="flex size-4 items-center justify-center">
                {isActive ? <CheckIcon className="size-4" /> : null}
              </span>
              <span className="flex-1 truncate text-left">{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ExpensesReportButton({
  disabled,
  reportHref,
}: {
  disabled: boolean
  reportHref: string
}) {
  return (
    <a
      href={reportHref}
      aria-disabled={disabled}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <DownloadIcon className="size-4" />
      <span>Report</span>
    </a>
  )
}

export function TeamExpensesToolbar({
  action,
  crewOptions,
  disabled = false,
  expenseTypeOptions,
  isNavigating = false,
  onNavigate,
  reportHref,
  selectedCrew,
  selectedType,
  selectedVenue,
  selectedYear,
  venueOptions,
  yearOptions,
}: {
  action?: ReactNode
  crewOptions: TeamExpensesToolbarOption[]
  disabled?: boolean
  expenseTypeOptions: TeamExpensesToolbarOption[]
  isNavigating?: boolean
  onNavigate: (href: string) => void
  reportHref: string
  selectedCrew: string
  selectedType: string
  selectedVenue: string
  selectedYear: string
  venueOptions: TeamExpensesToolbarOption[]
  yearOptions: TeamExpensesToolbarOption[]
}) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false)
  const filterGroups: ExpenseFilterGroup[] = [
    {
      label: "Crew",
      options: crewOptions,
      selectedValue: selectedCrew,
    },
    {
      label: "Year",
      options: yearOptions,
      selectedValue: selectedYear,
    },
    {
      label: "Venue",
      options: venueOptions,
      selectedValue: selectedVenue,
    },
    {
      label: "Type",
      options: expenseTypeOptions,
      selectedValue: selectedType,
    },
  ]
  const hasActiveFilter = filterGroups.some(
    (group) => group.selectedValue.length > 0 && group.label !== "Year",
  )
  const isDisabled = disabled || isNavigating

  function navigateToHref(href: string): void {
    setIsFilterDrawerOpen(false)
    onNavigate(href)
  }

  return (
    <section className="flex w-full items-center justify-end gap-2">
      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <button
          type="button"
          disabled={isDisabled}
          aria-label="Filter expenses"
          aria-haspopup="dialog"
          aria-expanded={isFilterDrawerOpen}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-11 w-11 md:hidden",
            hasActiveFilter &&
              "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
          )}
          onClick={() => setIsFilterDrawerOpen(true)}
        >
          <FilterIcon className="size-4" />
        </button>
        <DrawerContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>
              Filter expenses by crew, year, venue, and type.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {filterGroups.map((group) => (
              <ExpenseFilterDrawerGroup
                key={group.label}
                group={group}
                disabled={isDisabled}
                onNavigate={navigateToHref}
              />
            ))}
          </div>
          <DrawerFooter className="shrink-0 border-t">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
              disabled={isNavigating}
              onClick={() => setIsFilterDrawerOpen(false)}
            >
              Close
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
        {filterGroups.map((group) => (
          <ExpenseFilterDropdown
            key={group.label}
            group={group}
            disabled={disabled}
            isNavigating={isNavigating}
            onNavigate={onNavigate}
          />
        ))}
        <ExpensesReportButton disabled={isDisabled} reportHref={reportHref} />
        {action ? <div className="flex justify-end">{action}</div> : null}
      </div>

      <a
        href={reportHref}
        aria-disabled={isDisabled}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-11 w-11 md:hidden",
          isDisabled && "pointer-events-none opacity-50",
        )}
      >
        <DownloadIcon className="size-4" />
        <span className="sr-only">Download expenses report</span>
      </a>
    </section>
  )
}
