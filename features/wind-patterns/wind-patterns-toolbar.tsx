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

type WindPatternsToolbarOption = {
  label: string
  value: string
  href: string
  count?: number
}

export function WindPatternsToolbar({
  options,
  selectedValue,
  disabled = false,
  action,
}: {
  options: WindPatternsToolbarOption[]
  selectedValue: string
  disabled?: boolean
  action?: ReactNode
}) {
  const router = useRouter()
  const hasActiveFilter = selectedValue.length > 0 && selectedValue !== "active"
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null

  return (
    <section className="flex w-full items-center justify-end gap-2">
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
