"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"
import { useRouter } from "next/navigation"

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

type TeamWindPatternsToolbarOption = {
  label: string
  value: string
  href: string
  count?: number
}

export function TeamWindPatternsToolbar({
  options,
  selectedValue,
  disabled = false,
  isNavigating = false,
  onNavigate,
  action,
}: {
  options: TeamWindPatternsToolbarOption[]
  selectedValue: string
  disabled?: boolean
  isNavigating?: boolean
  onNavigate?: (href: string) => void
  action?: ReactNode
}) {
  const router = useRouter()
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false)
  const hasActiveFilter = selectedValue.length > 0 && selectedValue !== "active"
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null
  const isDisabled = disabled || isNavigating

  function navigateToOption(option: TeamWindPatternsToolbarOption): void {
    if (isNavigating || option.value === selectedValue) {
      setIsFilterDrawerOpen(false)
      return
    }

    setIsFilterDrawerOpen(false)

    if (onNavigate) {
      onNavigate(option.href)
      return
    }

    router.push(option.href)
  }

  return (
    <section className="flex w-full items-center justify-end gap-2">
      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <button
          type="button"
          disabled={isDisabled}
          aria-label="Filter wind patterns by status"
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
            <DrawerTitle>Status</DrawerTitle>
            <DrawerDescription>Filter wind patterns by active state.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {options.map((option) => {
                const isActive = option.value === selectedValue

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      buttonVariants({
                        variant: isActive ? "secondary" : "ghost",
                        className: "h-11 w-full justify-start gap-3 px-3",
                      }),
                    )}
                    disabled={isDisabled}
                    onClick={() => navigateToOption(option)}
                  >
                    <span className="flex size-4 items-center justify-center">
                      {isActive ? <CheckIcon className="size-4" /> : null}
                    </span>
                    <span className="flex-1 text-left">{option.label}</span>
                    {typeof option.count === "number" ? (
                      <span className="text-xs text-muted-foreground">{option.count}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
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

      <div className="hidden md:block">
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
            <span>Status</span>
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
                  onClick={() => navigateToOption(option)}
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
      </div>

      {action ? <div className="flex justify-end">{action}</div> : null}
    </section>
  )
}
