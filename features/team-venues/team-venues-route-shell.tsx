"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateTeamVenueDialog } from "@/features/team-venues/team-venues-table"
import type {
  TeamVenueStatusFilter,
  TeamVenuesChromeData,
} from "@/features/team-venues/data"
import { TeamVenuesToolbar } from "@/features/team-venues/team-venues-toolbar"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
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

function buildTeamVenueStatusHref(input: {
  statusFilter: TeamVenueStatusFilter
  scope: NavigationScope
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)
  params.set("status", input.statusFilter)
  params.delete("page")
  params.delete("loadMore")

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  return `/team-venues?${params.toString()}`
}

export function TeamVenuesRouteShell({
  canManageVenueRows,
  children,
  chromeData,
  currentPage,
  loadMoreMode,
  noTeamSelected,
  scope,
}: {
  canManageVenueRows: boolean
  children: ReactNode
  chromeData: TeamVenuesChromeData
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
    isFilterNavigationPending ||
    pendingFilterNavigation?.fromHref === currentHref
  const createDisabled = noTeamSelected || !canManageVenueRows

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
          Venues
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Venues</h2>
        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <TeamVenuesToolbar
            selectedValue={chromeData.selectedStatusFilter}
            disabled={noTeamSelected}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            clearHref={buildTeamVenueStatusHref({
              statusFilter: "active",
              scope,
            })}
            options={[
              {
                label: "Active",
                value: "active",
                count: chromeData.statusCounts.active,
                href: buildTeamVenueStatusHref({
                  statusFilter: "active",
                  scope,
                }),
              },
              {
                label: "Deprecated",
                value: "deprecated",
                count: chromeData.statusCounts.deprecated,
                href: buildTeamVenueStatusHref({
                  statusFilter: "deprecated",
                  scope,
                }),
              },
            ]}
          />
          <div className="hidden md:block">
            <CreateTeamVenueDialog
              availableVenueOptions={chromeData.availableVenueOptions}
              scope={scope}
              selectedStatusFilter={chromeData.selectedStatusFilter}
              currentPage={currentPage}
              loadMoreMode={loadMoreMode}
              disabled={createDisabled || isFilterNavigationBusy}
              surface="sheet"
            />
          </div>
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
                aria-label="Loading filtered venues"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered venues"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateTeamVenueDialog
        availableVenueOptions={chromeData.availableVenueOptions}
        scope={scope}
        selectedStatusFilter={chromeData.selectedStatusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        disabled={createDisabled || isFilterNavigationBusy}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
