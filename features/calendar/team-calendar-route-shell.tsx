"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CreateCalendarEventDialog } from "@/features/calendar/calendar-event-dialogs"
import type { TeamCalendarChromeData } from "@/features/calendar/data"
import { buildTeamCalendarHref } from "@/features/calendar/navigation"
import { TeamCalendarToolbar } from "@/features/calendar/team-calendar-toolbar"
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

export function TeamCalendarRouteShell({
  canManageCustomEvents,
  children,
  chromeData,
  noTeamSelected,
  scope,
}: {
  canManageCustomEvents: boolean
  children: ReactNode
  chromeData: TeamCalendarChromeData
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
  const createDisabled = noTeamSelected || !canManageCustomEvents
  const selectedEventValue = chromeData.selectedEventFilter?.value ?? ""
  const selectedMemberId = chromeData.selectedMemberId ?? ""
  const eventOptions = [
    {
      value: "",
      label: "Events",
      href: buildTeamCalendarHref({
        scope,
        memberId: chromeData.selectedMemberId,
        timeFilter: chromeData.selectedTimeFilter,
      }),
    },
    ...chromeData.eventFilterOptions.map((option) => ({
      value: option.value,
      label: `${option.label} - ${option.dateRangeLabel}`,
      href: buildTeamCalendarHref({
        scope,
        memberId: chromeData.selectedMemberId,
        eventFilter: {
          sourceType: option.sourceType,
          sourceId: option.sourceId,
          value: option.value,
        },
        timeFilter: chromeData.selectedTimeFilter,
      }),
    })),
  ]
  const memberOptions = [
    {
      value: "",
      label: "My presence",
      href: buildTeamCalendarHref({
        scope,
        eventFilter: chromeData.selectedEventFilter,
        timeFilter: chromeData.selectedTimeFilter,
      }),
    },
    ...chromeData.teamMembers.map((member) => ({
      value: member.id,
      label: member.name,
      href: buildTeamCalendarHref({
        scope,
        memberId: member.id,
        eventFilter: chromeData.selectedEventFilter,
        timeFilter: chromeData.selectedTimeFilter,
      }),
    })),
  ]

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
          Calendar
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Calendar</h2>
        <div className="flex shrink-0 justify-end md:w-auto">
          <TeamCalendarToolbar
            scope={scope}
            selectedMemberId={selectedMemberId}
            selectedEventValue={selectedEventValue}
            selectedTimeFilter={chromeData.selectedTimeFilter}
            disabled={noTeamSelected}
            isNavigating={isFilterNavigationBusy}
            onNavigate={navigateToFilterHref}
            memberOptions={memberOptions}
            eventOptions={eventOptions}
            action={
              <div className="hidden md:block">
                <CreateCalendarEventDialog
                  scope={scope}
                  selectedMemberId={chromeData.selectedMemberId}
                  selectedEventValue={selectedEventValue}
                  selectedTimeFilter={chromeData.selectedTimeFilter}
                  returnPath={currentHref}
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
                aria-label="Loading filtered calendar"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered calendar"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CreateCalendarEventDialog
        scope={scope}
        selectedMemberId={chromeData.selectedMemberId}
        selectedEventValue={selectedEventValue}
        selectedTimeFilter={chromeData.selectedTimeFilter}
        returnPath={currentHref}
        disabled={createDisabled || isFilterNavigationBusy}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
