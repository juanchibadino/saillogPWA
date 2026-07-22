"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type {
  TeamExpenseFormOptions,
  TeamExpensesChromeData,
} from "@/features/expenses/data"
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialogs"
import {
  buildTeamExpensesFiltersHref,
  buildTeamExpensesReportHref,
} from "@/features/expenses/list-route-state.mjs"
import {
  TeamExpensesToolbar,
  type TeamExpensesToolbarOption,
} from "@/features/expenses/team-expenses-toolbar"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type PendingFilterNavigation = {
  fromHref: string
  toHref: string
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://dockout.local")

  return `${url.pathname}${url.search}`
}

function buildExpensesFilterHref(input: {
  chromeData: TeamExpensesChromeData
  expenseType?: string
  memberId?: string
  scope: NavigationScope
  teamVenueId?: string
  year?: number
}): string {
  const selectedMemberId =
    typeof input.memberId === "string"
      ? input.memberId
      : input.chromeData.selectedMemberId

  return buildTeamExpensesFiltersHref({
    scope: input.scope,
    visibilityScope: input.chromeData.teamExpensesVisible ? "team" : "mine",
    teamScopeAllowed: input.chromeData.teamExpensesVisible,
    year: input.year ?? input.chromeData.selectedYear,
    memberId: selectedMemberId,
    teamVenueId:
      typeof input.teamVenueId === "string"
        ? input.teamVenueId
        : input.chromeData.selectedVenueId,
    expenseType:
      typeof input.expenseType === "string"
        ? input.expenseType
        : input.chromeData.selectedType,
  })
}

function buildExpenseReportHref(input: {
  chromeData: TeamExpensesChromeData
  scope: NavigationScope
}): string {
  return buildTeamExpensesReportHref({
    scope: input.scope,
    visibilityScope: input.chromeData.selectedVisibilityScope,
    teamScopeAllowed: input.chromeData.teamExpensesVisible,
    year: input.chromeData.selectedYear,
    memberId: input.chromeData.selectedMemberId,
    teamVenueId: input.chromeData.selectedVenueId,
    expenseType: input.chromeData.selectedType,
  })
}

export function TeamExpensesRouteShell({
  canManageExpenses,
  children,
  chromeData,
  formOptions,
  noTeamSelected,
  scope,
}: {
  canManageExpenses: boolean
  children: ReactNode
  chromeData: TeamExpensesChromeData
  formOptions: TeamExpenseFormOptions
  noTeamSelected: boolean
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isFilterNavigationPending, startFilterNavigationTransition] = useTransition()
  const [pendingFilterNavigation, setPendingFilterNavigation] =
    useState<PendingFilterNavigation | null>(null)
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isFilterNavigationBusy =
    isFilterNavigationPending || pendingFilterNavigation?.fromHref === currentHref
  const createDisabled = noTeamSelected || !canManageExpenses || isFilterNavigationBusy
  const selectedVenueId = chromeData.selectedVenueId ?? ""
  const selectedMemberId = chromeData.selectedMemberId ?? ""
  const selectedType = chromeData.selectedType ?? ""
  const selectedYear = String(chromeData.selectedYear)
  const crewOptions: TeamExpensesToolbarOption[] = chromeData.teamExpensesVisible
    ? [
        {
          value: "",
          label: "All",
          href: buildExpensesFilterHref({
            chromeData,
            scope,
            memberId: "",
          }),
        },
        ...chromeData.memberOptions.map((option) => ({
          value: option.profileId,
          label:
            option.profileId === formOptions.defaultAssignedToProfileId
              ? "You"
              : option.label,
          href: buildExpensesFilterHref({
            chromeData,
            scope,
            memberId: option.profileId,
          }),
        })),
      ]
    : [
        {
          value: formOptions.defaultAssignedToProfileId,
          label: "You",
          href: buildExpensesFilterHref({
            chromeData,
            scope,
            memberId: formOptions.defaultAssignedToProfileId,
          }),
        },
      ]

  const yearOptions: TeamExpensesToolbarOption[] = chromeData.yearOptions.map((option) => ({
    value: String(option.year),
    label: option.label,
    href: buildExpensesFilterHref({
      chromeData,
      scope,
      year: option.year,
    }),
  }))
  const venueOptions: TeamExpensesToolbarOption[] = [
    {
      value: "",
      label: "All venues",
      href: buildExpensesFilterHref({
        chromeData,
        scope,
        teamVenueId: "",
      }),
    },
    ...chromeData.venueOptions.map((option) => ({
      value: option.teamVenueId,
      label: option.venueName,
      href: buildExpensesFilterHref({
        chromeData,
        scope,
        teamVenueId: option.teamVenueId,
      }),
    })),
  ]
  const typeOptions: TeamExpensesToolbarOption[] = [
    {
      value: "",
      label: "All types",
      href: buildExpensesFilterHref({
        chromeData,
        scope,
        expenseType: "",
      }),
    },
    ...chromeData.typeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      href: buildExpensesFilterHref({
        chromeData,
        scope,
        expenseType: option.value,
      }),
    })),
  ]
  const reportHref = buildExpenseReportHref({ chromeData, scope })

  function navigateToFilterHref(href: string): void {
    const nextHref = normalizeInternalHref(href)

    if (isFilterNavigationBusy || nextHref === currentHref) {
      return
    }

    setPendingFilterNavigation({
      fromHref: currentHref,
      toHref: nextHref,
    })
    startFilterNavigationTransition(() => {
      router.push(href)
    })
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Expenses
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Expenses</h2>
        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <TeamExpensesToolbar
            selectedCrew={selectedMemberId}
            selectedYear={selectedYear}
            selectedVenue={selectedVenueId}
            selectedType={selectedType}
            crewOptions={crewOptions}
            yearOptions={yearOptions}
            venueOptions={venueOptions}
            expenseTypeOptions={typeOptions}
            reportHref={reportHref}
            disabled={noTeamSelected}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            action={
              <ExpenseFormDialog
                disabled={createDisabled}
                mode="create"
                options={formOptions}
                scope={scope}
                selectedYear={chromeData.selectedYear}
                surface="sheet"
              />
            }
          />
        </div>
      </header>

      <div aria-busy={isFilterNavigationBusy} className="relative">
        <div
          aria-disabled={isFilterNavigationBusy}
          className={cn(
            "transition-opacity",
            isFilterNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          {children}
        </div>
        {isFilterNavigationBusy ? (
          <>
            <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
              <div
                role="status"
                aria-label="Loading filtered expenses"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered expenses"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <ExpenseFormDialog
        disabled={createDisabled}
        mode="create"
        options={formOptions}
        scope={scope}
        selectedYear={chromeData.selectedYear}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
