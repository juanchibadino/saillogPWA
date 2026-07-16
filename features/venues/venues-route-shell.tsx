"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateVenueDialog } from "@/features/venues/venue-form-dialogs"
import type {
  VenuesChromeData,
  VenueStatusFilter,
} from "@/features/venues/data"
import { buildVenueStatusHref } from "@/features/venues/list-route-state.mjs"
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

function formatVenueStatusLabel(input: {
  count: number
  status: VenueStatusFilter
}): string {
  if (input.status === "active") {
    return `Active (${input.count})`
  }

  if (input.status === "inactive") {
    return `Inactive (${input.count})`
  }

  return `All (${input.count})`
}

export function VenuesRouteShell({
  canManageVenues,
  children,
  chromeData,
  scope,
}: {
  canManageVenues: boolean
  children: ReactNode
  chromeData: VenuesChromeData
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
  const statusOptions: Array<{ count: number; status: VenueStatusFilter }> = [
    {
      status: "all",
      count: chromeData.statusCounts.all,
    },
    {
      status: "active",
      count: chromeData.statusCounts.active,
    },
    {
      status: "inactive",
      count: chromeData.statusCounts.inactive,
    },
  ]

  function navigateToStatus(status: VenueStatusFilter): void {
    const href = buildVenueStatusHref({
      pathname,
      search: searchParams.toString(),
      nextStatus: status,
    })
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Organization Venues</h2>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="venues-status-filter">
            Venue status
          </label>
          <select
            id="venues-status-filter"
            value={chromeData.selectedStatusFilter}
            disabled={isFilterNavigationBusy}
            onChange={(event) => {
              navigateToStatus(event.currentTarget.value as VenueStatusFilter)
            }}
            className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm font-medium outline-none ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusOptions.map((option) => (
              <option key={option.status} value={option.status}>
                {formatVenueStatusLabel(option)}
              </option>
            ))}
          </select>

          {canManageVenues && chromeData.organizations.length > 0 ? (
            <>
              <div className="hidden md:block">
                <CreateVenueDialog
                  organizations={chromeData.organizations}
                  scope={scope}
                  surface="sheet"
                />
              </div>
              <CreateVenueDialog
                organizations={chromeData.organizations}
                scope={scope}
                surface="drawer"
                triggerVariant="fab"
              />
            </>
          ) : null}
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading filtered venues"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
