"use client"

import {
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FilterIcon,
  Loader2Icon,
} from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types"
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialogs"
import { TeamExpensesTable } from "@/features/expenses/expenses-table"
import { buildTeamExpensesReportHref } from "@/features/expenses/list-route-state.mjs"
import { buildVenueDetailPageHref } from "@/features/venues/detail-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type VenueExpenseFilterOption = {
  href: string
  label: string
  value: string
}

type VenueExpenseFilterGroup = {
  id: "crew" | "type"
  label: string
  options: VenueExpenseFilterOption[]
  selectedValue: string
}

const ACTIVE_EXPENSE_FILTER_CLASS =
  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"

function VenueExpenseReportButton({
  crewLabel,
  reportHref,
  selectedYear,
  venueName,
}: {
  crewLabel: string
  reportHref: string
  selectedYear: number
  venueName: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isReportPending, setIsReportPending] = useState(false)
  const pendingResetTimerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (pendingResetTimerRef.current !== null) {
        window.clearTimeout(pendingResetTimerRef.current)
      }
    },
    [],
  )

  function handleConfirmReport(event: MouseEvent<HTMLAnchorElement>): void {
    if (isReportPending) {
      event.preventDefault()
      return
    }

    setIsReportPending(true)
    setIsOpen(false)

    if (pendingResetTimerRef.current !== null) {
      window.clearTimeout(pendingResetTimerRef.current)
    }

    pendingResetTimerRef.current = window.setTimeout(() => {
      setIsReportPending(false)
      pendingResetTimerRef.current = null
    }, 5000)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isReportPending}
        className="hidden min-w-[6.5rem] md:inline-flex"
        onClick={() => setIsOpen(true)}
      >
        {isReportPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <DownloadIcon className="size-4" />
        )}
        <span>{isReportPending ? "Generating..." : "Report"}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 md:hidden"
        aria-label={
          isReportPending ? "Generating expenses report" : "Download expenses report"
        }
        disabled={isReportPending}
        onClick={() => setIsOpen(true)}
      >
        {isReportPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <DownloadIcon className="size-4" />
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="sm:max-w-md"
          forceOverlayRender
          overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
        >
          <DialogHeader>
            <DialogTitle>Generate expense report</DialogTitle>
            <DialogDescription>
              You are about to generate an expense report for{" "}
              <strong>{crewLabel}</strong> at <strong>{venueName}</strong> for{" "}
              <strong>{selectedYear}</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:h-8 sm:w-auto"
              disabled={isReportPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <a
              href={reportHref}
              aria-disabled={isReportPending}
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-11 w-full sm:h-8 sm:w-auto",
                isReportPending && "pointer-events-none opacity-80",
              )}
              onClick={handleConfirmReport}
            >
              {isReportPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              {isReportPending ? "Generating..." : "Confirm"}
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function resolveVenueExpenseReportCrewLabel(
  data: VenueDetailTabDataByTab["expenses"],
): string {
  if (data.selectedMemberId) {
    return (
      data.memberOptions.find((option) => option.profileId === data.selectedMemberId)
        ?.label ??
      data.formOptions.memberOptions.find(
        (option) => option.profileId === data.selectedMemberId,
      )?.label ??
      "selected crew"
    )
  }

  if (data.selectedVisibilityScope === "mine") {
    return (
      data.formOptions.memberOptions.find(
        (option) => option.profileId === data.formOptions.defaultAssignedToProfileId,
      )?.label ?? "you"
    )
  }

  return "all crew"
}

function resolveVenueExpenseReportVenueName(input: {
  data: VenueDetailTabDataByTab["expenses"]
  teamVenueId: string
}): string {
  return (
    input.data.formOptions.venueOptions.find(
      (option) => option.teamVenueId === input.teamVenueId,
    )?.venueName ?? "this venue"
  )
}

function VenueExpenseFilterDropdown({
  disabled,
  group,
  onNavigate,
}: {
  disabled: boolean
  group: VenueExpenseFilterGroup
  onNavigate: (href: string) => void
}) {
  const hasActiveFilter = group.selectedValue.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(hasActiveFilter && ACTIVE_EXPENSE_FILTER_CLASS)}
          />
        }
      >
        <FilterIcon className="size-4" />
        <span>{group.label}</span>
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {group.options.map((option) => {
          const isActive = option.value === group.selectedValue

          return (
            <DropdownMenuItem
              key={`${group.label}-${option.value || "all"}`}
              disabled={disabled}
              className="gap-2"
              onClick={() => {
                if (!isActive) {
                  onNavigate(option.href)
                }
              }}
            >
              <span className="flex size-4 items-center justify-center">
                {isActive ? <CheckIcon className="size-4" /> : null}
              </span>
              <span className="flex-1 truncate">{option.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function VenueExpenseFilters({
  data,
  isNavigating,
  onNavigate,
  selectedYear,
}: {
  data: VenueDetailTabDataByTab["expenses"]
  isNavigating: boolean
  onNavigate: (href: string) => void
  selectedYear: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const selectedMemberId = data.selectedMemberId ?? ""
  const selectedType = data.selectedType ?? ""
  const [draftMemberId, setDraftMemberId] = useState(selectedMemberId)
  const [draftType, setDraftType] = useState(selectedType)

  function buildCrewHref(memberId: string): string {
    return buildVenueDetailPageHref({
      pathname,
      search: searchParams.toString(),
      nextTab: "expenses",
      nextYear: selectedYear,
      nextCrewFilter: memberId ? null : "all",
      nextMemberId: memberId || null,
    })
  }

  function buildTypeHref(expenseType: string): string {
    return buildVenueDetailPageHref({
      pathname,
      search: searchParams.toString(),
      nextTab: "expenses",
      nextYear: selectedYear,
      nextExpenseType: expenseType,
    })
  }

  function buildFiltersHref(input: {
    expenseType: string
    memberId: string
  }): string {
    return buildVenueDetailPageHref({
      pathname,
      search: searchParams.toString(),
      nextTab: "expenses",
      nextYear: selectedYear,
      nextCrewFilter: input.memberId ? null : "all",
      nextMemberId: input.memberId || null,
      nextExpenseType: input.expenseType || null,
    })
  }

  function buildClearFiltersHref(): string {
    return buildVenueDetailPageHref({
      pathname,
      search: searchParams.toString(),
      nextTab: "expenses",
      nextYear: selectedYear,
      nextCrewFilter: null,
      nextMemberId: null,
      nextExpenseType: null,
    })
  }

  const filterGroups: VenueExpenseFilterGroup[] = []

  if (data.canFilterByMember && data.memberOptions.length > 0) {
    filterGroups.push({
      id: "crew",
      label: "Crew",
      selectedValue: selectedMemberId,
      options: [
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
      ],
    })
  }

  if (data.typeOptions.length > 0) {
    filterGroups.push({
      id: "type",
      label: "Type",
      selectedValue: selectedType,
      options: [
        {
          value: "",
          label: "All",
          href: buildTypeHref(""),
        },
        ...data.typeOptions.map((option) => ({
          value: option.value,
          label: option.label,
          href: buildTypeHref(option.value),
        })),
      ],
    })
  }

  if (filterGroups.length === 0) {
    return null
  }

  const hasActiveFilter = filterGroups.some((group) => group.selectedValue.length > 0)

  function handleDrawerOpenChange(open: boolean): void {
    setIsDrawerOpen(open)

    if (open) {
      setDraftMemberId(selectedMemberId)
      setDraftType(selectedType)
    }
  }

  function navigateToFilter(href: string): void {
    setIsDrawerOpen(false)
    onNavigate(href)
  }

  function applyDraftFilters(): void {
    navigateToFilter(
      buildFiltersHref({
        expenseType: draftType,
        memberId: draftMemberId,
      }),
    )
  }

  function clearFilters(): void {
    setDraftMemberId("")
    setDraftType("")
    navigateToFilter(buildClearFiltersHref())
  }

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {filterGroups.map((group) => (
          <VenueExpenseFilterDropdown
            key={group.label}
            disabled={isNavigating}
            group={group}
            onNavigate={navigateToFilter}
          />
        ))}
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={handleDrawerOpenChange}>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="default"
            disabled={isNavigating}
            aria-label="Filters"
            className={cn(
              "h-11 w-11 px-0 md:hidden",
              hasActiveFilter && ACTIVE_EXPENSE_FILTER_CLASS,
            )}
          >
            <FilterIcon className="size-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>Set filters and apply.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {filterGroups.map((group) => (
              <section key={group.label} className="space-y-2">
                <label
                  htmlFor={`mobile-expenses-${group.id}-filter`}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {group.label}
                </label>
                <select
                  id={`mobile-expenses-${group.id}-filter`}
                  value={group.id === "crew" ? draftMemberId : draftType}
                  onChange={(event) => {
                    if (group.id === "crew") {
                      setDraftMemberId(event.target.value)
                      return
                    }

                    setDraftType(event.target.value)
                  }}
                  disabled={isNavigating}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                >
                  {group.options.map((option) => (
                    <option key={`${group.id}-${option.value || "all"}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </section>
            ))}
          </div>
          <DrawerFooter className="shrink-0 border-t">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={isNavigating || !hasActiveFilter}
              onClick={clearFilters}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="h-11 w-full"
              disabled={isNavigating}
              onClick={applyDraftFilters}
            >
              Apply
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
  isFilterNavigating = false,
  onFilterNavigate,
  scope,
  selectedYear,
  teamVenueId,
}: {
  canManageExpenses: boolean
  data: VenueDetailTabDataByTab["expenses"]
  isFilterNavigating?: boolean
  onFilterNavigate: (href: string) => void
  scope: NavigationScope
  selectedYear: number
  teamVenueId: string
}) {
  const reportHref = buildTeamExpensesReportHref({
    scope,
    visibilityScope: data.selectedVisibilityScope,
    teamScopeAllowed: data.teamExpensesVisible,
    year: selectedYear,
    crewFilter: data.selectedCrewFilter,
    memberId: data.selectedMemberId,
    teamVenueId,
    expenseType: data.selectedType,
  })
  const reportCrewLabel = resolveVenueExpenseReportCrewLabel(data)
  const reportVenueName = resolveVenueExpenseReportVenueName({ data, teamVenueId })

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Expenses {selectedYear}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VenueExpenseFilters
            data={data}
            isNavigating={isFilterNavigating}
            onNavigate={onFilterNavigate}
            selectedYear={selectedYear}
          />
          <VenueExpenseReportButton
            crewLabel={reportCrewLabel}
            reportHref={reportHref}
            selectedYear={selectedYear}
            venueName={reportVenueName}
          />
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
        isFiltering={isFilterNavigating}
        metrics={data.metrics}
        pageCount={1}
        scope={scope}
        selectedMemberId={data.selectedMemberId}
        selectedTeamVenueId={teamVenueId}
        selectedType={data.selectedType}
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
