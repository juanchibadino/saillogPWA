"use client"

import { useState } from "react"
import { CheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types"
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialogs"
import { TeamExpensesTable } from "@/features/expenses/expenses-table"
import { buildVenueDetailPageHref } from "@/features/venues/detail-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type VenueExpenseCrewFilterOption = {
  href: string
  label: string
  value: string
}

function VenueExpenseCrewFilter({
  data,
  selectedYear,
}: {
  data: VenueDetailTabDataByTab["expenses"]
  selectedYear: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const selectedMemberId = data.selectedMemberId ?? ""

  if (!data.canFilterByMember || data.memberOptions.length === 0) {
    return null
  }

  function buildCrewHref(memberId: string): string {
    return buildVenueDetailPageHref({
      pathname,
      search: searchParams.toString(),
      nextTab: "expenses",
      nextYear: selectedYear,
      nextMemberId: memberId,
    })
  }

  const crewOptions: VenueExpenseCrewFilterOption[] = [
    {
      value: "",
      label: "All",
      href: buildCrewHref(""),
    },
    ...data.memberOptions.map((option) => ({
      value: option.profileId,
      label:
        option.profileId === data.formOptions.defaultAssignedToProfileId
          ? "You"
          : option.label,
      href: buildCrewHref(option.profileId),
    })),
  ]
  const hasActiveFilter = selectedMemberId.length > 0
  const activeClassName =
    "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"

  function navigateToCrew(href: string): void {
    setIsDrawerOpen(false)
    router.push(href)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("hidden md:inline-flex", hasActiveFilter && activeClassName)}
            />
          }
        >
          <FilterIcon className="size-4" />
          <span>Crew</span>
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {crewOptions.map((option) => {
            const isActive = option.value === selectedMemberId

            return (
              <DropdownMenuLinkItem
                key={option.value || "all"}
                href={option.href}
                className="gap-2"
              >
                <span className="flex size-4 items-center justify-center">
                  {isActive ? <CheckIcon className="size-4" /> : null}
                </span>
                <span className="flex-1 truncate">{option.label}</span>
              </DropdownMenuLinkItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <button
          type="button"
          aria-label="Filter expenses by crew"
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-11 w-11 md:hidden",
            hasActiveFilter && activeClassName,
          )}
          onClick={() => setIsDrawerOpen(true)}
        >
          <FilterIcon className="size-4" />
        </button>
        <DrawerContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Crew</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {crewOptions.map((option) => {
              const isActive = option.value === selectedMemberId

              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                      className: "h-11 w-full justify-start gap-3 px-3",
                    }),
                  )}
                  onClick={() => navigateToCrew(option.href)}
                >
                  <span className="flex size-4 items-center justify-center">
                    {isActive ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="flex-1 truncate text-left">{option.label}</span>
                </button>
              )
            })}
          </div>
          <DrawerFooter className="shrink-0 border-t">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setIsDrawerOpen(false)}
            >
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function VenueExpensesPanel({
  canManageExpenses,
  data,
  scope,
  selectedYear,
  teamVenueId,
}: {
  canManageExpenses: boolean
  data: VenueDetailTabDataByTab["expenses"]
  scope: NavigationScope
  selectedYear: number
  teamVenueId: string
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Expenses {selectedYear}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VenueExpenseCrewFilter data={data} selectedYear={selectedYear} />
          <div className="hidden md:block">
            <ExpenseFormDialog
              defaultTeamVenueId={teamVenueId}
              disabled={!canManageExpenses}
              lockTeamVenue
              mode="create"
              options={data.formOptions}
              scope={scope}
              selectedYear={selectedYear}
              surface="sheet"
              triggerVariant="button"
            />
          </div>
        </div>
      </header>

      <TeamExpensesTable
        currentPage={1}
        expenses={data.expenses}
        formOptions={data.formOptions}
        hasNextPage={false}
        hasPreviousPage={false}
        metrics={data.metrics}
        pageCount={1}
        scope={scope}
        selectedMemberId={data.selectedMemberId}
        selectedTeamVenueId={teamVenueId}
        selectedYear={selectedYear}
        visibilityScope={data.selectedVisibilityScope}
      />

      <ExpenseFormDialog
        defaultTeamVenueId={teamVenueId}
        disabled={!canManageExpenses}
        lockTeamVenue
        mode="create"
        options={data.formOptions}
        scope={scope}
        selectedYear={selectedYear}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
