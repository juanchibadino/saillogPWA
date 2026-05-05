"use client"

import Link from "next/link"
import { FilterIcon, RotateCcwIcon } from "lucide-react"

import { buttonVariants, Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

export type TableFilterOption = {
  value: string
  label: string
}

export type TableFilterField = {
  id: string
  name: string
  label: string
  allLabel: string
  selectedValue?: string
  options: TableFilterOption[]
  disabled?: boolean
  controlClassName?: string
}

export function TableFiltersToolbar({
  scope,
  fields,
  clearHref,
  action,
  embedded = false,
  autoSubmit = false,
  className,
}: {
  scope: NavigationScope
  fields: TableFilterField[]
  clearHref?: string
  action?: React.ReactNode
  embedded?: boolean
  autoSubmit?: boolean
  className?: string
}) {
  const hasFilters = fields.length > 0

  if (!hasFilters && !action) {
    return null
  }

  const activeFilterCount = fields.filter((field) => Boolean(field.selectedValue)).length

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    if (autoSubmit) {
      event.currentTarget.form?.requestSubmit()
    }
  }

  if (embedded) {
    return (
      <section className={cn("rounded-xl border bg-card/85 p-2", className)}>
        <form method="get" className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="hidden"
            name={NAVIGATION_SCOPE_ORG_QUERY_KEY}
            value={scope.activeOrgId}
          />
          {scope.activeTeamId ? (
            <input
              type="hidden"
              name={NAVIGATION_SCOPE_TEAM_QUERY_KEY}
              value={scope.activeTeamId}
            />
          ) : null}

          <ButtonGroup className="flex-wrap">
            {fields.map((field) => {
              const selectId = `table-filter-${field.id}`
              return (
                <div
                  key={field.id}
                  className={cn(
                    "inline-flex items-center rounded-md border bg-background px-1.5",
                    field.selectedValue ? "border-border shadow-xs" : "border-input",
                  )}
                >
                  <select
                    id={selectId}
                    name={field.name}
                    defaultValue={field.selectedValue ?? ""}
                    disabled={field.disabled}
                    onChange={handleSelectChange}
                    className={cn(
                      "h-7 min-w-[8.5rem] rounded-md border-0 bg-transparent pr-6 pl-1 text-xs font-medium text-foreground outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                      field.controlClassName,
                    )}
                    aria-label={field.label}
                  >
                    <option value="">{field.allLabel}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}

            {action ?? null}
          </ButtonGroup>
        </form>
      </section>
    )
  }

  return (
    <section className={cn("rounded-xl border bg-card/85 p-2", className)}>
      <form
        method="get"
        className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
      >
        <input
          type="hidden"
          name={NAVIGATION_SCOPE_ORG_QUERY_KEY}
          value={scope.activeOrgId}
        />
        {scope.activeTeamId ? (
          <input
            type="hidden"
            name={NAVIGATION_SCOPE_TEAM_QUERY_KEY}
            value={scope.activeTeamId}
          />
        ) : null}

        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          {hasFilters ? (
            <div className="w-full overflow-x-auto xl:w-auto">
              <ButtonGroup className="min-w-max rounded-lg bg-muted/35 p-1">
                {fields.map((field) => {
                  const selectId = `table-filter-${field.id}`

                  return (
                    <div
                      key={field.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1",
                        field.selectedValue ? "border-border shadow-xs" : "border-input",
                      )}
                    >
                      <label
                        htmlFor={selectId}
                        className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                      >
                        {field.label}
                      </label>
                      <select
                        id={selectId}
                        name={field.name}
                        defaultValue={field.selectedValue ?? ""}
                        disabled={field.disabled}
                        className={cn(
                          "h-6 min-w-[10rem] rounded-md border-0 bg-transparent pr-6 pl-1 text-sm font-medium text-foreground outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                          field.controlClassName,
                        )}
                      >
                        <option value="">{field.allLabel}</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </ButtonGroup>
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-center gap-2 xl:justify-end",
              activeFilterCount > 0 ? "justify-between" : "justify-end",
            )}
          >
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-7 items-center rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground">
                {activeFilterCount} active
              </span>
            ) : null}

            <ButtonGroup>
              {hasFilters ? (
                <Button type="submit" variant="outline" size="sm">
                  <FilterIcon className="size-3.5" />
                  Apply
                </Button>
              ) : null}
              {clearHref ? (
                <Link
                  href={clearHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <RotateCcwIcon className="size-3.5" />
                  Clear
                </Link>
              ) : null}
              {action ?? null}
            </ButtonGroup>
          </div>
        </div>
      </form>
    </section>
  )
}
