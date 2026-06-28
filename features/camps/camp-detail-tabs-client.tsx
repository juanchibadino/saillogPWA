"use client"

import * as React from "react"

import { GradientCard } from "@/components/shared/gradient-card"
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampGoalsEditSurface } from "@/features/camps/detail/camp-goals-edit-surface"
import type {
  CampDetailKpi,
  CampDetailNotesCard,
  CampDetailTab,
} from "@/features/camps/detail-types"
import { buildCampDetailHref, CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import type {
  TeamSessionCampOption,
  TeamSessionHighlightFilter,
  TeamSessionListItem,
} from "@/features/sessions/data"
import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar"
import { cn } from "@/lib/utils"
import type { NavigationScope } from "@/lib/navigation/types"

function resolveTab(value: string): CampDetailTab {
  return CAMP_DETAIL_TABS.includes(value as CampDetailTab)
    ? (value as CampDetailTab)
    : "sessions"
}

function renderNoteValue(value: string | null): string {
  if (!value) {
    return "—"
  }

  return value
}

function isCampKpiTabular(label: string): boolean {
  return label !== "Camp Dates"
}

function CampDetailSummaryCards({ kpis }: { kpis: CampDetailKpi[] }) {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {kpis.map((kpi) => (
            <div
              key={`mobile-camp-summary-${kpi.label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p
                className={cn(
                  "text-right text-sm font-semibold",
                  isCampKpiTabular(kpi.label) ? "tabular-nums" : null,
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <GradientCard key={`desktop-camp-summary-${kpi.label}`}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-xl font-semibold",
                  isCampKpiTabular(kpi.label) ? "tabular-nums" : null,
                )}
              >
                {kpi.value}
              </CardTitle>
            </CardHeader>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

export function CampDetailTabsClient({
  initialTab,
  kpis,
  sessions,
  campOptions,
  sessionCurrentPage,
  sessionPageCount,
  hasPreviousSessionPage,
  hasNextSessionPage,
  selectedSessionHighlight,
  campName,
  venueId,
  venueName,
  venueLocation,
  goals,
  notesCards,
  canManageSessions,
  canManageGoals,
  scope,
  campId,
}: {
  initialTab: CampDetailTab
  kpis: CampDetailKpi[]
  sessions: TeamSessionListItem[]
  campOptions: TeamSessionCampOption[]
  sessionCurrentPage: number
  sessionPageCount: number
  hasPreviousSessionPage: boolean
  hasNextSessionPage: boolean
  selectedSessionHighlight?: TeamSessionHighlightFilter
  campName: string
  venueId: string
  venueName: string
  venueLocation: string
  goals: string | null
  notesCards: CampDetailNotesCard[]
  canManageSessions: boolean
  canManageGoals: boolean
  scope: NavigationScope
  campId: string
}) {
  const [selectedTab, setSelectedTab] = React.useState<CampDetailTab>(initialTab)
  const sessionReturnPath = buildCampDetailHref({
    scope,
    campId,
    tab: "sessions",
    highlight: selectedSessionHighlight,
    page: sessionCurrentPage,
  })

  function buildCampSessionsHref(input: {
    highlight?: TeamSessionHighlightFilter
    page?: number
    loadMore?: boolean
  }): string {
    return buildCampDetailHref({
      scope,
      campId,
      tab: "sessions",
      highlight: input.highlight,
      page: input.page,
      loadMore: input.loadMore,
    })
  }

  return (
    <div className="space-y-6">
      <CampDetailSummaryCards kpis={kpis} />

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(resolveTab(value))}
        className="space-y-4"
      >
        <TabsList className="h-11 w-full max-w-full md:hidden">
          {CAMP_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-0 basis-0 px-2 capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsList className="hidden h-10 md:inline-flex">
          {CAMP_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sessions">
          <TeamSessionsTable
            sessions={sessions}
            campOptions={campOptions}
            canManageSessions={canManageSessions}
            noTeamSelected={false}
            toolbar={
              <TeamSessionsToolbar
                scope={scope}
                selectedVenueId=""
                selectedCampId=""
                selectedHighlight={selectedSessionHighlight ?? ""}
                venueDisabled
                campDisabled
                showVenueFilter={false}
                showCampFilter={false}
                venueOptions={[
                  {
                    value: "",
                    label: `${venueName} — ${venueLocation}`,
                    href: buildCampSessionsHref({
                      highlight: selectedSessionHighlight,
                    }),
                  },
                ]}
                campOptions={[
                  {
                    value: "",
                    label: campName,
                    href: buildCampSessionsHref({
                      highlight: selectedSessionHighlight,
                    }),
                  },
                ]}
                highlightOptions={[
                  {
                    value: "",
                    label: "All",
                    href: buildCampSessionsHref({}),
                  },
                  {
                    value: "yes",
                    label: "Yes",
                    href: buildCampSessionsHref({ highlight: "yes" }),
                  },
                  {
                    value: "no",
                    label: "No",
                    href: buildCampSessionsHref({ highlight: "no" }),
                  },
                ]}
                buildHref={({ highlight }) =>
                  buildCampSessionsHref({
                    highlight,
                  })
                }
                action={
                  <CreateSessionDialog
                    campOptions={campOptions}
                    scope={scope}
                    selectedVenueId={venueId}
                    selectedCampId={campId}
                    selectedHighlight={selectedSessionHighlight}
                    currentPage={sessionCurrentPage}
                    returnPath={sessionReturnPath}
                    disabled={!canManageSessions || campOptions.length === 0}
                    surface="sheet"
                  />
                }
              />
            }
            scope={scope}
            selectedVenueId={venueId}
            selectedCampId={campId}
            selectedHighlight={selectedSessionHighlight}
            currentPage={sessionCurrentPage}
            pageCount={sessionPageCount}
            hasPreviousPage={hasPreviousSessionPage}
            hasNextPage={hasNextSessionPage}
            returnPath={sessionReturnPath}
          />
        </TabsContent>

        <TabsContent value="goals">
          <section className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Camp Goals</h3>
                  <p className="text-sm text-muted-foreground">
                    Main objectives and priorities for this camp.
                  </p>
                </div>
                {canManageGoals ? (
                  <CampGoalsEditSurface campId={campId} scope={scope} goals={goals} />
                ) : null}
              </div>

              <div className="min-h-48 rounded-xl border bg-muted/20 p-4">
                {goals && goals.trim().length > 0 ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{goals}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No goals set for this camp yet.</p>
                )}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="notes">
          <section className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="space-y-4">
              <header className="space-y-1">
                <h3 className="text-base font-semibold">Session Notes</h3>
                <p className="text-sm text-muted-foreground">
                  Notes and review points from sessions in this camp.
                </p>
              </header>

              {notesCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No session notes recorded for this camp yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {notesCards.map((card) => (
                    <li key={card.sessionId} className="rounded-xl border p-4">
                      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{card.sessionDateLabel}</h4>
                        <p className="text-xs font-medium text-muted-foreground">
                          {card.sessionTypeLabel}
                        </p>
                      </header>

                      <dl className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Free Notes
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.freeNotes)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Best
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.best)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            To Work
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.toWork)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Standard Moves
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.standardMoves)}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Wind Pattern
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.windPattern)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
