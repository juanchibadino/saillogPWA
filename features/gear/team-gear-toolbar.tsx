"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"

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

export type TeamGearToolbarOption = {
  label: string
  value: string
  href: string
}

type GearFilterGroup = {
  label: string
  options: TeamGearToolbarOption[]
  selectedValue: string
}

function GearFilterDropdown({
  disabled,
  group,
  isNavigating,
  onNavigate,
}: {
  disabled: boolean
  group: GearFilterGroup
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
      <DropdownMenuContent align="end" className="min-w-44">
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

function GearFilterDrawerGroup({
  disabled,
  group,
  onNavigate,
}: {
  disabled: boolean
  group: GearFilterGroup
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
              <span className="flex-1 text-left">{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function TeamGearToolbar({
  typeOptions,
  statusOptions,
  conditionOptions,
  alertOptions,
  selectedType,
  selectedStatus,
  selectedCondition,
  selectedAlert,
  disabled = false,
  isNavigating = false,
  onNavigate,
  action,
}: {
  typeOptions: TeamGearToolbarOption[]
  statusOptions: TeamGearToolbarOption[]
  conditionOptions: TeamGearToolbarOption[]
  alertOptions: TeamGearToolbarOption[]
  selectedType: string
  selectedStatus: string
  selectedCondition: string
  selectedAlert: string
  disabled?: boolean
  isNavigating?: boolean
  onNavigate: (href: string) => void
  action?: ReactNode
}) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false)
  const filterGroups: GearFilterGroup[] = [
    {
      label: "Type",
      options: typeOptions,
      selectedValue: selectedType,
    },
    {
      label: "Status",
      options: statusOptions,
      selectedValue: selectedStatus,
    },
    {
      label: "Condition",
      options: conditionOptions,
      selectedValue: selectedCondition,
    },
    {
      label: "Alerts",
      options: alertOptions,
      selectedValue: selectedAlert,
    },
  ]
  const hasActiveFilter = filterGroups.some((group) => group.selectedValue.length > 0)
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
          aria-label="Filter gear"
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
              Filter gear by type, status, condition, and alert state.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {filterGroups.map((group) => (
              <GearFilterDrawerGroup
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
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full",
              )}
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
          <GearFilterDropdown
            key={group.label}
            group={group}
            disabled={disabled}
            isNavigating={isNavigating}
            onNavigate={onNavigate}
          />
        ))}
        {action ? <div className="flex justify-end">{action}</div> : null}
      </div>
    </section>
  )
}
