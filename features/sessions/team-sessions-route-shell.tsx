"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar"
import {
  buildTeamSessionsHref,
} from "@/features/sessions/navigation"
import type { TeamSessionsChromeData } from "@/features/sessions/data"
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

export function TeamSessionsRouteShell({
  canManageSessions,
  children,
  chromeData,
  currentPage,
  noTeamSelected,
  scope,
}: {
  canManageSessions: boolean
  children: ReactNode
  chromeData: TeamSessionsChromeData
  currentPage: number
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
    noTeamSelected || !canManageSessions || chromeData.campOptions.length === 0

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
      <div className="flex items-center justify-end gap-2 md:justify-between">
        <h2 className="hidden text-lg font-semibold md:block">Sessions</h2>
        <div className="w-full md:w-auto">
          <TeamSessionsToolbar
            scope={scope}
            selectedVenueId={chromeData.selectedVenueId ?? ""}
            selectedCampId={chromeData.selectedCampId ?? ""}
            selectedHighlight={chromeData.selectedHighlight ?? ""}
            venueDisabled={noTeamSelected || chromeData.venueFilterOptions.length === 0}
            campDisabled={noTeamSelected || chromeData.campFilterOptions.length === 0}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            venueOptions={[
              {
                value: "",
                label: "Venues",
                href: buildTeamSessionsHref({
                  scope,
                  highlight: chromeData.selectedHighlight,
                }),
              },
              ...chromeData.venueFilterOptions.map((option) => ({
                value: option.venueId,
                label: `${option.venueName} — ${option.venueLocation}`,
                href: buildTeamSessionsHref({
                  scope,
                  venueId: option.venueId,
                  highlight: chromeData.selectedHighlight,
                }),
              })),
            ]}
            campOptions={[
              {
                value: "",
                label: "Camps",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  highlight: chromeData.selectedHighlight,
                }),
              },
              ...chromeData.campFilterOptions.map((option) => ({
                value: option.campId,
                label: option.label,
                href: buildTeamSessionsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campId: option.campId,
                  highlight: chromeData.selectedHighlight,
                }),
              })),
            ]}
            highlightOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campId: chromeData.selectedCampId,
                }),
              },
              {
                value: "yes",
                label: "Yes",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campId: chromeData.selectedCampId,
                  highlight: "yes",
                }),
              },
              {
                value: "no",
                label: "No",
                href: buildTeamSessionsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campId: chromeData.selectedCampId,
                  highlight: "no",
                }),
              },
            ]}
            action={
              <CreateSessionDialog
                campOptions={chromeData.campOptions}
                scope={scope}
                selectedVenueId={chromeData.selectedVenueId}
                selectedCampId={chromeData.selectedCampId}
                selectedHighlight={chromeData.selectedHighlight}
                currentPage={currentPage}
                disabled={createDisabled || isFilterNavigationBusy}
                surface="sheet"
              />
            }
          />
        </div>
      </div>

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
                aria-label="Loading filtered sessions"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered sessions"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateSessionDialog
        campOptions={chromeData.campOptions}
        scope={scope}
        selectedVenueId={chromeData.selectedVenueId}
        selectedCampId={chromeData.selectedCampId}
        selectedHighlight={chromeData.selectedHighlight}
        currentPage={currentPage}
        disabled={createDisabled || isFilterNavigationBusy}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
