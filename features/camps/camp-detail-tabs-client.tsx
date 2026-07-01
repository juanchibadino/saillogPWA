"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { CampDetailPanelSkeleton } from "@/components/shared/page-skeletons"
import { GradientCard } from "@/components/shared/gradient-card"
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampGoalsEditSurface } from "@/features/camps/detail/camp-goals-edit-surface"
import type {
  CampDetailGoalsTabData,
  CampDetailKpi,
  CampDetailNotesTabData,
  CampDetailSessionsTabData,
  CampDetailTab,
  CampDetailTabPayload,
} from "@/features/camps/detail-types"
import { buildCampDetailHref, CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import type { TeamSessionHighlightFilter } from "@/features/sessions/data"
import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { cn } from "@/lib/utils"
import type { NavigationScope } from "@/lib/navigation/types"

type CampDetailTabDataState = {
  goals?: CampDetailGoalsTabData
  notes?: CampDetailNotesTabData
  sessions?: CampDetailSessionsTabData
}

type CampDetailTabDataResponse = {
  data: CampDetailTabPayload
  tab: CampDetailTab
}

type CampDetailTabErrorPayload = {
  detail?: unknown
  error?: unknown
}

type CampDetailTabLoadError = {
  message: string
  tab: CampDetailTab
}

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

function applyCampDetailTabData(input: {
  data: CampDetailTabPayload
  state: CampDetailTabDataState
  tab: CampDetailTab
}): CampDetailTabDataState {
  if (input.tab === "sessions") {
    return {
      ...input.state,
      sessions: input.data as CampDetailSessionsTabData,
    }
  }

  if (input.tab === "goals") {
    return {
      ...input.state,
      goals: input.data as CampDetailGoalsTabData,
    }
  }

  return {
    ...input.state,
    notes: input.data as CampDetailNotesTabData,
  }
}

function appendUniqueNotesCards(input: {
  currentCards: CampDetailNotesTabData["notesCards"]
  nextCards: CampDetailNotesTabData["notesCards"]
}): CampDetailNotesTabData["notesCards"] {
  const seenSessionIds = new Set(input.currentCards.map((card) => card.sessionId))
  const uniqueNextCards = input.nextCards.filter((card) => {
    if (seenSessionIds.has(card.sessionId)) {
      return false
    }

    seenSessionIds.add(card.sessionId)
    return true
  })

  return [...input.currentCards, ...uniqueNextCards]
}

function appendCampDetailNotesTabData(input: {
  data: CampDetailTabPayload
  state: CampDetailTabDataState
}): CampDetailTabDataState {
  const nextData = input.data as CampDetailNotesTabData
  const currentNotes = input.state.notes

  if (!currentNotes) {
    return {
      ...input.state,
      notes: nextData,
    }
  }

  return {
    ...input.state,
    notes: {
      ...nextData,
      notesCards: appendUniqueNotesCards({
        currentCards: currentNotes.notesCards,
        nextCards: nextData.notesCards,
      }),
      sessionOffset: currentNotes.sessionOffset,
    },
  }
}

function buildCampDetailTabDataState(input: {
  initialTab: CampDetailTab
  initialTabData: CampDetailTabPayload
}): CampDetailTabDataState {
  return applyCampDetailTabData({
    data: input.initialTabData,
    state: {},
    tab: input.initialTab,
  })
}

function hasCampDetailTabData(
  state: CampDetailTabDataState,
  tab: CampDetailTab,
): boolean {
  if (tab === "sessions") {
    return typeof state.sessions !== "undefined"
  }

  if (tab === "goals") {
    return typeof state.goals !== "undefined"
  }

  return typeof state.notes !== "undefined"
}

function buildCampDetailTabDataUrl(input: {
  campId: string
  loadMore?: boolean
  notesOffset?: number
  page?: number
  scope: NavigationScope
  selectedHighlight?: TeamSessionHighlightFilter
  tab: CampDetailTab
}): string {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.selectedHighlight) {
    params.set("highlight", input.selectedHighlight)
  }

  if (
    typeof input.page === "number" &&
    Number.isFinite(input.page) &&
    input.page > 1
  ) {
    params.set("page", String(Math.floor(input.page)))
  }

  if (input.loadMore) {
    params.set("loadMore", "1")
  }

  if (
    input.tab === "notes" &&
    typeof input.notesOffset === "number" &&
    Number.isFinite(input.notesOffset) &&
    input.notesOffset > 0
  ) {
    params.set("notesOffset", String(Math.floor(input.notesOffset)))
  }

  return `/api/team-camps/${encodeURIComponent(input.campId)}/tab-data?${params.toString()}`
}

async function resolveCampDetailTabErrorMessage(response: Response): Promise<string> {
  let payload: CampDetailTabErrorPayload | null = null

  try {
    payload = (await response.json()) as CampDetailTabErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry this tab."
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return "This tab needs an active team scope. Select the correct team and retry."
  }

  if (response.status === 404 || errorCode === "camp_not_found") {
    return "This camp is unavailable in the active team scope."
  }

  if (response.status === 400) {
    return "This tab request is invalid. Refresh the page and try again."
  }

  return "This tab hit a runtime error while loading. Retry just this tab."
}

async function fetchCampDetailTabData(input: {
  campId: string
  loadMore?: boolean
  notesOffset?: number
  page?: number
  scope: NavigationScope
  selectedHighlight?: TeamSessionHighlightFilter
  tab: CampDetailTab
}): Promise<CampDetailTabPayload> {
  const response = await fetch(buildCampDetailTabDataUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveCampDetailTabErrorMessage(response))
  }

  const payload = (await response.json()) as CampDetailTabDataResponse

  if (payload.tab !== input.tab) {
    throw new Error("The loaded tab data did not match the selected tab.")
  }

  return payload.data
}

function CampTabDataError(input: {
  error: CampDetailTabLoadError
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Could not load {input.error.tab}.</p>
        <p className="text-sm text-muted-foreground">{input.error.message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={input.onRetry}>
        Retry
      </Button>
    </div>
  )
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
  initialTabData,
  initialSessionHighlight,
  initialSessionLoadMore,
  initialSessionPage,
  kpis,
  campName,
  venueId,
  venueName,
  venueLocation,
  canManageSessions,
  canManageGoals,
  scope,
  campId,
}: {
  initialTab: CampDetailTab
  initialTabData: CampDetailTabPayload
  initialSessionHighlight?: TeamSessionHighlightFilter
  initialSessionLoadMore?: boolean
  initialSessionPage: number
  kpis: CampDetailKpi[]
  campName: string
  venueId: string
  venueName: string
  venueLocation: string
  canManageSessions: boolean
  canManageGoals: boolean
  scope: NavigationScope
  campId: string
}) {
  const [selectedTab, setSelectedTab] = React.useState<CampDetailTab>(initialTab)
  const [tabData, setTabData] = React.useState<CampDetailTabDataState>(() =>
    buildCampDetailTabDataState({
      initialTab,
      initialTabData,
    }),
  )
  const [loadError, setLoadError] = React.useState<CampDetailTabLoadError | null>(null)
  const [loadingMoreNotes, setLoadingMoreNotes] = React.useState(false)
  const campIdRef = React.useRef(campId)
  const inFlightTabsRef = React.useRef<Set<CampDetailTab>>(new Set())
  const requestVersionRef = React.useRef(0)
  const latestTabRequestVersionRef = React.useRef<Record<CampDetailTab, number>>({
    goals: 0,
    notes: 0,
    sessions: 0,
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

  const loadTabData = React.useCallback(
    async (tab: CampDetailTab, options?: { force?: boolean }) => {
      if (!options?.force && hasCampDetailTabData(tabData, tab)) {
        return
      }

      if (inFlightTabsRef.current.has(tab)) {
        return
      }

      const requestVersion = requestVersionRef.current + 1
      requestVersionRef.current = requestVersion
      latestTabRequestVersionRef.current[tab] = requestVersion
      inFlightTabsRef.current.add(tab)
      setLoadError((currentError) => (currentError?.tab === tab ? null : currentError))

      try {
        const nextTabData = await fetchCampDetailTabData({
          campId,
          loadMore: initialSessionLoadMore,
          page: initialSessionPage,
          scope,
          selectedHighlight: initialSessionHighlight,
          tab,
        })

        if (latestTabRequestVersionRef.current[tab] !== requestVersion) {
          return
        }

        setTabData((currentState) =>
          applyCampDetailTabData({
            data: nextTabData,
            state: currentState,
            tab,
          }),
        )
      } catch (error) {
        if (latestTabRequestVersionRef.current[tab] !== requestVersion) {
          return
        }

        const message = error instanceof Error ? error.message : "Could not load this tab."
        setLoadError({ message, tab })
      } finally {
        inFlightTabsRef.current.delete(tab)
      }
    },
    [
      campId,
      initialSessionHighlight,
      initialSessionLoadMore,
      initialSessionPage,
      scope,
      tabData,
    ],
  )

  React.useEffect(() => {
    const didCampChange = campIdRef.current !== campId
    campIdRef.current = campId

    requestVersionRef.current += 1
    latestTabRequestVersionRef.current = {
      goals: 0,
      notes: 0,
      sessions: 0,
    }
    inFlightTabsRef.current.clear()

    if (didCampChange) {
      setSelectedTab(initialTab)
    }

    setTabData(
      buildCampDetailTabDataState({
        initialTab,
        initialTabData,
      }),
    )
    setLoadError((currentError) => (currentError?.tab === initialTab ? null : currentError))
    setLoadingMoreNotes(false)
  }, [campId, initialTab, initialTabData, scope.activeOrgId, scope.activeTeamId])

  React.useEffect(() => {
    void loadTabData(selectedTab)
  }, [loadTabData, selectedTab])

  const retrySelectedTab = React.useCallback(() => {
    void loadTabData(selectedTab, { force: true })
  }, [loadTabData, selectedTab])

  const loadMoreNotes = React.useCallback(async () => {
    const notesData = tabData.notes

    if (!notesData || notesData.nextSessionOffset === null || loadingMoreNotes) {
      return
    }

    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    latestTabRequestVersionRef.current.notes = requestVersion
    setLoadingMoreNotes(true)
    setLoadError((currentError) => (currentError?.tab === "notes" ? null : currentError))

    try {
      const nextTabData = await fetchCampDetailTabData({
        campId,
        notesOffset: notesData.nextSessionOffset,
        scope,
        tab: "notes",
      })

      if (latestTabRequestVersionRef.current.notes !== requestVersion) {
        return
      }

      setTabData((currentState) =>
        appendCampDetailNotesTabData({
          data: nextTabData,
          state: currentState,
        }),
      )
      setLoadError((currentError) => (currentError?.tab === "notes" ? null : currentError))
    } catch (error) {
      if (latestTabRequestVersionRef.current.notes !== requestVersion) {
        return
      }

      const message = error instanceof Error ? error.message : "Could not load more notes."
      setLoadError({ message, tab: "notes" })
    } finally {
      if (latestTabRequestVersionRef.current.notes === requestVersion) {
        setLoadingMoreNotes(false)
      }
    }
  }, [campId, loadingMoreNotes, scope, tabData.notes])

  function renderPendingTab(tab: CampDetailTab) {
    if (loadError?.tab === tab) {
      return <CampTabDataError error={loadError} onRetry={retrySelectedTab} />
    }

    return <CampDetailPanelSkeleton selectedTab={tab} />
  }

  function renderSessionsTab() {
    const sessionsData = tabData.sessions

    if (!sessionsData) {
      return renderPendingTab("sessions")
    }

    const sessionReturnPath = buildCampDetailHref({
      scope,
      campId,
      tab: "sessions",
      highlight: sessionsData.selectedHighlight,
      page: sessionsData.currentPage,
    })

    return (
      <TeamSessionsTable
        sessions={sessionsData.sessions}
        campOptions={sessionsData.campOptions}
        canManageSessions={canManageSessions}
        noTeamSelected={false}
        toolbar={
          <TeamSessionsToolbar
            scope={scope}
            selectedVenueId=""
            selectedCampId=""
            selectedHighlight={sessionsData.selectedHighlight ?? ""}
            venueDisabled
            campDisabled
            showVenueFilter={false}
            showCampFilter={false}
            venueOptions={[
              {
                value: "",
                label: `${venueName} — ${venueLocation}`,
                href: buildCampSessionsHref({
                  highlight: sessionsData.selectedHighlight,
                }),
              },
            ]}
            campOptions={[
              {
                value: "",
                label: campName,
                href: buildCampSessionsHref({
                  highlight: sessionsData.selectedHighlight,
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
                campOptions={sessionsData.campOptions}
                scope={scope}
                selectedVenueId={venueId}
                selectedCampId={campId}
                selectedHighlight={sessionsData.selectedHighlight}
                currentPage={sessionsData.currentPage}
                returnPath={sessionReturnPath}
                disabled={!canManageSessions || sessionsData.campOptions.length === 0}
                surface="sheet"
              />
            }
          />
        }
        scope={scope}
        selectedVenueId={venueId}
        selectedCampId={campId}
        selectedHighlight={sessionsData.selectedHighlight}
        currentPage={sessionsData.currentPage}
        pageCount={sessionsData.pageCount}
        hasPreviousPage={sessionsData.hasPreviousPage}
        hasNextPage={sessionsData.hasNextPage}
        returnPath={sessionReturnPath}
      />
    )
  }

  function renderGoalsTab() {
    const goalsData = tabData.goals

    if (!goalsData) {
      return renderPendingTab("goals")
    }

    return (
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
              <CampGoalsEditSurface campId={campId} scope={scope} goals={goalsData.goals} />
            ) : null}
          </div>

          <div className="min-h-48 rounded-xl border bg-muted/20 p-4">
            {goalsData.goals && goalsData.goals.trim().length > 0 ? (
              <p className="whitespace-pre-wrap text-base leading-relaxed">{goalsData.goals}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No goals set for this camp yet.</p>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderNotesTab() {
    const notesData = tabData.notes

    if (!notesData) {
      return renderPendingTab("notes")
    }

    const hasMoreNotes = notesData.nextSessionOffset !== null

    return (
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold">Session Notes</h3>
            <p className="text-sm text-muted-foreground">
              Notes and review points from sessions in this camp.
            </p>
          </header>

          {notesData.notesCards.length === 0 && !hasMoreNotes ? (
            <p className="text-sm text-muted-foreground">
              No session notes recorded for this camp yet.
            </p>
          ) : (
            <div className="space-y-4">
              {notesData.notesCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No session notes found in the loaded sessions.
                </p>
              ) : (
                <ul className="space-y-4">
                  {notesData.notesCards.map((card) => (
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

              {loadError?.tab === "notes" ? (
                <p role="alert" className="text-sm text-destructive">
                  {loadError.message}
                </p>
              ) : null}

              {hasMoreNotes ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={loadingMoreNotes}
                  onClick={() => void loadMoreNotes()}
                >
                  {loadingMoreNotes ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                      Loading more...
                    </>
                  ) : (
                    "Load more notes"
                  )}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <CampDetailSummaryCards kpis={kpis} />

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(resolveTab(value))}
        className="space-y-4"
      >
        <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
          <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
            {CAMP_DETAIL_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="min-w-0 basis-0 px-2 capitalize">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsList className="hidden h-10 md:inline-flex">
          {CAMP_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {selectedTab === "sessions" ? (
          <TabsContent value="sessions">{renderSessionsTab()}</TabsContent>
        ) : null}

        {selectedTab === "goals" ? (
          <TabsContent value="goals">{renderGoalsTab()}</TabsContent>
        ) : null}

        {selectedTab === "notes" ? (
          <TabsContent value="notes">{renderNotesTab()}</TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
