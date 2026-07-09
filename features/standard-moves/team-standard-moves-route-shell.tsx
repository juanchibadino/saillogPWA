"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateStandardMoveDialog } from "@/features/standard-moves/standard-moves-form-dialogs"
import type {
  TeamStandardMoveStatusFilter,
  TeamStandardMovesChromeData,
} from "@/features/standard-moves/data"
import { TeamStandardMovesToolbar } from "@/features/standard-moves/team-standard-moves-toolbar"
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

function buildTeamStandardMoveStatusHref(input: {
  scope: NavigationScope
  statusFilter: TeamStandardMoveStatusFilter
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.statusFilter !== "active") {
    params.set("statusFilter", input.statusFilter)
  }

  return `/team-standard-moves?${params.toString()}`
}

export function TeamStandardMovesRouteShell({
  canManageStandardMoves,
  children,
  chromeData,
  currentPage,
  loadMoreMode,
  noTeamSelected,
  scope,
}: {
  canManageStandardMoves: boolean
  children: ReactNode
  chromeData: TeamStandardMovesChromeData
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
  const createDisabled =
    noTeamSelected || !canManageStandardMoves || isFilterNavigationBusy

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
          Standard Moves
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Standard Moves</h2>
        <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto">
          <TeamStandardMovesToolbar
            selectedValue={chromeData.selectedStatusFilter}
            disabled={noTeamSelected}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            options={[
              {
                value: "active",
                label: "Active",
                href: buildTeamStandardMoveStatusHref({
                  scope,
                  statusFilter: "active",
                }),
                count: chromeData.statusCounts.active,
              },
              {
                value: "archived",
                label: "Archived",
                href: buildTeamStandardMoveStatusHref({
                  scope,
                  statusFilter: "archived",
                }),
                count: chromeData.statusCounts.archived,
              },
              {
                value: "all",
                label: "All",
                href: buildTeamStandardMoveStatusHref({
                  scope,
                  statusFilter: "all",
                }),
                count:
                  chromeData.statusCounts.active +
                  chromeData.statusCounts.archived,
              },
            ]}
            action={
              <div className="hidden md:block">
                <CreateStandardMoveDialog
                  scope={scope}
                  statusFilter={chromeData.selectedStatusFilter}
                  currentPage={currentPage}
                  loadMoreMode={loadMoreMode}
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
                aria-label="Loading filtered standard moves"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered standard moves"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateStandardMoveDialog
        scope={scope}
        statusFilter={chromeData.selectedStatusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        disabled={createDisabled}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
