"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateCampDialog } from "@/features/camps/camp-form-dialogs"
import type { TeamCampsChromeData } from "@/features/camps/data"
import { buildTeamCampsHref } from "@/features/camps/navigation"
import { TeamCampsToolbar } from "@/features/camps/team-camps-toolbar"
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

export function TeamCampsRouteShell({
  canCreateCamps,
  children,
  chromeData,
  currentPage,
  noTeamSelected,
  scope,
}: {
  canCreateCamps: boolean
  children: ReactNode
  chromeData: TeamCampsChromeData
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
    noTeamSelected || !canCreateCamps || chromeData.teamVenueOptions.length === 0

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
      <div className="flex items-center justify-between gap-3 md:justify-between">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Camps
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Camps</h2>
        <div className="flex shrink-0 justify-end md:w-auto">
          <TeamCampsToolbar
            scope={scope}
            selectedVenueId={chromeData.selectedVenueId ?? ""}
            selectedCampType={chromeData.selectedCampType ?? ""}
            selectedCampStatus={chromeData.selectedCampStatus ?? ""}
            disabled={noTeamSelected}
            venueDisabled={noTeamSelected || chromeData.venueFilterOptions.length === 0}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            venueOptions={[
              {
                value: "",
                label: "Venues",
                href: buildTeamCampsHref({
                  scope,
                  campType: chromeData.selectedCampType,
                  campStatus: chromeData.selectedCampStatus,
                }),
              },
              ...chromeData.venueFilterOptions.map((option) => ({
                value: option.venueId,
                label: `${option.venueName} — ${option.venueLocation}`,
                href: buildTeamCampsHref({
                  scope,
                  venueId: option.venueId,
                  campType: chromeData.selectedCampType,
                  campStatus: chromeData.selectedCampStatus,
                }),
              })),
            ]}
            typeOptions={[
              {
                value: "",
                label: "Types",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campStatus: chromeData.selectedCampStatus,
                }),
              },
              {
                value: "training",
                label: "Training",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: "training",
                  campStatus: chromeData.selectedCampStatus,
                }),
              },
              {
                value: "regatta",
                label: "Regatta",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: "regatta",
                  campStatus: chromeData.selectedCampStatus,
                }),
              },
              {
                value: "mixed",
                label: "Mixed",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: "mixed",
                  campStatus: chromeData.selectedCampStatus,
                }),
              },
            ]}
            statusOptions={[
              {
                value: "",
                label: "Statuses",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: chromeData.selectedCampType,
                }),
              },
              {
                value: "active",
                label: "Active",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: chromeData.selectedCampType,
                  campStatus: "active",
                }),
              },
              {
                value: "inactive",
                label: "Inactive",
                href: buildTeamCampsHref({
                  scope,
                  venueId: chromeData.selectedVenueId,
                  campType: chromeData.selectedCampType,
                  campStatus: "inactive",
                }),
              },
            ]}
            action={
              <div className="hidden md:block">
                <CreateCampDialog
                  teamVenueOptions={chromeData.teamVenueOptions}
                  scope={scope}
                  selectedVenueId={chromeData.selectedVenueId}
                  selectedCampType={chromeData.selectedCampType}
                  selectedCampStatus={chromeData.selectedCampStatus}
                  currentPage={currentPage}
                  disabled={createDisabled || isFilterNavigationBusy}
                  surface="sheet"
                />
              </div>
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
                aria-label="Loading filtered camps"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered camps"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateCampDialog
        teamVenueOptions={chromeData.teamVenueOptions}
        scope={scope}
        selectedVenueId={chromeData.selectedVenueId}
        selectedCampType={chromeData.selectedCampType}
        selectedCampStatus={chromeData.selectedCampStatus}
        currentPage={currentPage}
        disabled={createDisabled || isFilterNavigationBusy}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
