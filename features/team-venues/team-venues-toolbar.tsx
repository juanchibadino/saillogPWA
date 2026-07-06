"use client"

import { useState, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"
import { useRouter } from "next/navigation"

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

type TeamVenuesToolbarOption = {
  label: string
  value: string
  href: string
  count?: number
}

function resolveSelectedOption(
  options: TeamVenuesToolbarOption[],
  selectedValue: string,
): TeamVenuesToolbarOption | null {
  return options.find((option) => option.value === selectedValue) ?? null
}

export function TeamVenuesToolbar({
  options,
  selectedValue,
  filterLabel = "Status",
  disabled = false,
  isNavigating = false,
  onNavigate,
  action,
  clearHref,
}: {
  options: TeamVenuesToolbarOption[]
  selectedValue: string
  filterLabel?: string
  disabled?: boolean
  isNavigating?: boolean
  onNavigate?: (href: string) => void
  action?: ReactNode
  clearHref?: string
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const defaultValue = options[0]?.value ?? ""
  const selectedOption = resolveSelectedOption(options, selectedValue)
  const hasActiveFilter = selectedValue !== defaultValue
  const filterIdSuffix = filterLabel.toLowerCase().replace(/\s+/g, "-")
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftSelectedValue, setDraftSelectedValue] = useState(
    selectedValue || defaultValue,
  )
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

  function applyDraftFilter(): void {
    const nextOption =
      resolveSelectedOption(options, draftSelectedValue) ?? options[0] ?? null

    if (!nextOption) {
      setIsDrawerOpen(false)
      return
    }

    navigateToHref(nextOption.href)
    setIsDrawerOpen(false)
  }

  function clearFilter(): void {
    const href = clearHref ?? options[0]?.href

    if (href) {
      navigateToHref(href)
    }

    setIsDrawerOpen(false)
  }

  if (isMobile) {
    return (
      <section
        className={cn(
          "flex w-full items-center gap-2",
          action ? "justify-between" : "justify-end",
        )}
      >
        <Drawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open)

            if (open) {
              setDraftSelectedValue(selectedValue || defaultValue)
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
              aria-label={`${filterLabel} filters`}
            >
              <FilterIcon className="size-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{filterLabel}</DrawerTitle>
              <DrawerDescription>Select filters and apply.</DrawerDescription>
            </DrawerHeader>

            <div className="space-y-2 px-4 pb-2">
              <label
                htmlFor={`mobile-${filterIdSuffix}-filter`}
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {filterLabel}
              </label>
              <select
                id={`mobile-${filterIdSuffix}-filter`}
                value={draftSelectedValue}
                onChange={(event) => setDraftSelectedValue(event.target.value)}
                disabled={isDisabled || options.length === 0}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {typeof option.count === "number" ? ` (${option.count})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <DrawerFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={clearFilter}
                disabled={isDisabled || options.length === 0}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11"
                onClick={applyDraftFilter}
                disabled={isDisabled || options.length === 0}
              >
                Apply
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {action ? <div className="flex justify-end">{action}</div> : null}
      </section>
    )
  }

  return (
    <section className="flex w-full items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
              className={cn(
                hasActiveFilter &&
                  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
              )}
            />
          }
        >
          <FilterIcon className="size-4" />
          <span>{filterLabel}</span>
          {selectedOption && typeof selectedOption.count === "number" ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              {selectedOption.count}
            </span>
          ) : null}
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
                {typeof option.count === "number" ? (
                  <span className="text-xs text-muted-foreground">{option.count}</span>
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
