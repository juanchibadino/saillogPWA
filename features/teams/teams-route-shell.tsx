"use client"

import type { ReactNode } from "react"

import { CreateTeamDialog } from "@/features/teams/team-form-dialogs"
import type { TeamsChromeData } from "@/features/teams/data"
import type { NavigationScope } from "@/lib/navigation/types"

export function TeamsRouteShell({
  canManageTeams,
  children,
  chromeData,
  currentPage,
  loadMoreMode,
  scope,
}: {
  canManageTeams: boolean
  children: ReactNode
  chromeData: TeamsChromeData
  currentPage: number
  loadMoreMode: boolean
  scope: NavigationScope
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Organization Teams
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">Organization Teams</h2>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <CreateTeamDialog
            currentPage={currentPage}
            disabled={!canManageTeams}
            loadMoreMode={loadMoreMode}
            organizationId={chromeData.activeOrganization.id}
            scope={scope}
            surface="sheet"
          />
        </div>
      </header>

      {children}

      <CreateTeamDialog
        currentPage={currentPage}
        disabled={!canManageTeams}
        loadMoreMode={loadMoreMode}
        organizationId={chromeData.activeOrganization.id}
        scope={scope}
        surface="drawer"
        triggerVariant="fab"
      />
    </section>
  )
}
