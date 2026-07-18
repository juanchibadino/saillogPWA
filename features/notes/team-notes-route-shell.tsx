"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { TeamNotesChromeData } from "@/features/notes/data"
import { TeamNotesToolbar } from "@/features/notes/team-notes-toolbar"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type PendingNotesNavigation = {
  fromHref: string
}

type TeamNotesNavigateOptions = {
  replace?: boolean
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
}

export function TeamNotesRouteShell({
  children,
  chromeData,
  scope,
}: {
  children: ReactNode
  chromeData: TeamNotesChromeData
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigationPending, startNavigationTransition] = useTransition()
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNotesNavigation | null>(null)
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isNavigationBusy =
    isNavigationPending || pendingNavigation?.fromHref === currentHref

  function navigateToHref(href: string, options?: TeamNotesNavigateOptions): void {
    const nextHref = normalizeInternalHref(href)

    if (isNavigationBusy || nextHref === currentHref) {
      return
    }

    setPendingNavigation({
      fromHref: currentHref,
    })
    startNavigationTransition(() => {
      if (options?.replace) {
        router.replace(href)
        return
      }

      router.push(href)
    })
  }

  return (
    <section className="space-y-4">
      <header>
        <TeamNotesToolbar
          scope={scope}
          searchQuery={chromeData.searchQuery}
          selectedVenueId={chromeData.selectedVenueId}
          selectedTwsValues={chromeData.selectedTwsValues}
          selectedConditionsValues={chromeData.selectedConditionsValues}
          venueFilterOptions={chromeData.venueFilterOptions}
          twsFilterOptions={chromeData.twsFilterOptions}
          conditionsFilterOptions={chromeData.conditionsFilterOptions}
          isNavigating={isNavigationBusy}
          onNavigate={navigateToHref}
        />
      </header>

      <div aria-busy={isNavigationBusy} className="relative">
        <div
          aria-disabled={isNavigationBusy}
          className={cn(
            "transition-opacity",
            isNavigationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          {children}
        </div>
        {isNavigationBusy ? (
          <>
            <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
              <div
                role="status"
                aria-label="Loading filtered notes"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading filtered notes"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
