"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateGearDialog } from "@/features/gear/gear-form-dialogs"
import type { TeamGearChromeData } from "@/features/gear/data"
import { buildTeamGearFiltersHref } from "@/features/gear/list-route-state.mjs"
import { TeamGearToolbar } from "@/features/gear/team-gear-toolbar"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type PendingFilterNavigation = {
  fromHref: string
  toHref: string
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
}

export function TeamGearRouteShell({
  canManageGear,
  children,
  chromeData,
  currentPage,
  loadMoreMode,
  noTeamSelected,
  scope,
}: {
  canManageGear: boolean
  children: ReactNode
  chromeData: TeamGearChromeData
  currentPage: number
  loadMoreMode: boolean
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
  const createDisabled = noTeamSelected || !canManageGear || isFilterNavigationBusy

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
          Gear
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Gear</h2>
        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <TeamGearToolbar
            selectedType={chromeData.selectedType ?? ""}
            selectedStatus={chromeData.selectedStatus ?? ""}
            selectedCondition={chromeData.selectedCondition ?? ""}
            selectedAlert={chromeData.selectedAlertState ?? ""}
            disabled={noTeamSelected}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            typeOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  statusFilter: chromeData.selectedStatus,
                  condition: chromeData.selectedCondition,
                  alert: chromeData.selectedAlertState,
                }),
              },
              ...chromeData.typeOptions.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: option.value,
                  statusFilter: chromeData.selectedStatus,
                  condition: chromeData.selectedCondition,
                  alert: chromeData.selectedAlertState,
                }),
              })),
            ]}
            statusOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  condition: chromeData.selectedCondition,
                  alert: chromeData.selectedAlertState,
                }),
              },
              ...chromeData.statusOptions.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  statusFilter: option.value,
                  condition: chromeData.selectedCondition,
                  alert: chromeData.selectedAlertState,
                }),
              })),
            ]}
            conditionOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  statusFilter: chromeData.selectedStatus,
                  alert: chromeData.selectedAlertState,
                }),
              },
              ...chromeData.conditionOptions.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  statusFilter: chromeData.selectedStatus,
                  condition: option.value,
                  alert: chromeData.selectedAlertState,
                }),
              })),
            ]}
            alertOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  statusFilter: chromeData.selectedStatus,
                  condition: chromeData.selectedCondition,
                }),
              },
              ...chromeData.alertOptions.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: chromeData.selectedType,
                  statusFilter: chromeData.selectedStatus,
                  condition: chromeData.selectedCondition,
                  alert: option.value,
                }),
              })),
            ]}
            action={
              <div className="hidden md:block">
                <CreateGearDialog
                  scope={scope}
                  selectedType={chromeData.selectedType}
                  selectedStatusFilter={chromeData.selectedStatus}
                  selectedCondition={chromeData.selectedCondition}
                  selectedAlert={chromeData.selectedAlertState}
                  currentPage={currentPage}
                  loadMoreMode={loadMoreMode}
                  gearTypeOptions={chromeData.typeOptions}
                  gearStatusOptions={chromeData.statusOptions}
                  gearConditionOptions={chromeData.conditionOptions}
                  disabled={createDisabled}
                  surface="sheet"
                />
              </div>
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
                aria-label="Loading filtered gear"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered gear"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateGearDialog
        scope={scope}
        selectedType={chromeData.selectedType}
        selectedStatusFilter={chromeData.selectedStatus}
        selectedCondition={chromeData.selectedCondition}
        selectedAlert={chromeData.selectedAlertState}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        gearTypeOptions={chromeData.typeOptions}
        gearStatusOptions={chromeData.statusOptions}
        gearConditionOptions={chromeData.conditionOptions}
        disabled={createDisabled}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
