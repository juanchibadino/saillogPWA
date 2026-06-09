"use client"

import Link from "next/link"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { updateCampGoalsAction } from "@/features/camps/actions"
import type {
  CampDetailKpi,
  CampDetailNotesCard,
  CampDetailSessionItem,
  CampDetailTab,
} from "@/features/camps/detail-types"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import { CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import type { NavigationScope } from "@/lib/navigation/types"

const SESSIONS_PAGE_SIZE = 10
type SessionPaginationItem = number | "ellipsis-start" | "ellipsis-end"

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

function buildSessionPaginationItems(
  currentPage: number,
  totalPages: number,
): SessionPaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: SessionPaginationItem[] = [1]
  const middleStart = Math.max(2, currentPage - 1)
  const middleEnd = Math.min(totalPages - 1, currentPage + 1)

  if (middleStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < totalPages - 1) {
    items.push("ellipsis-end")
  }

  items.push(totalPages)

  return items
}

function CampGoalsDialog({
  campId,
  scope,
  goals,
}: {
  campId: string
  scope: NavigationScope
  goals: string | null
}) {
  const [nextGoals, setNextGoals] = React.useState(goals ?? "")

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit camp goals</DialogTitle>
          <DialogDescription>
            Update the current goals and priorities for this camp.
          </DialogDescription>
        </DialogHeader>

        <form action={updateCampGoalsAction} className="space-y-4">
          <input type="hidden" name="campId" value={campId} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="goals" />

          <div className="space-y-2">
            <Textarea
              name="goals"
              rows={12}
              maxLength={4000}
              value={nextGoals}
              onChange={(event) => setNextGoals(event.target.value)}
              placeholder="Write camp goals, priorities, and execution focus..."
            />
            <p className="text-xs text-muted-foreground">{nextGoals.length}/4000</p>
          </div>

          <DialogFooter>
            <Button type="submit">Save goals</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CampDetailTabsClient({
  initialTab,
  initialSessionPage,
  kpis,
  sessions,
  campName,
  goals,
  notesCards,
  canManageGoals,
  scope,
  campId,
}: {
  initialTab: CampDetailTab
  initialSessionPage: number
  kpis: CampDetailKpi[]
  sessions: CampDetailSessionItem[]
  campName: string
  goals: string | null
  notesCards: CampDetailNotesCard[]
  canManageGoals: boolean
  scope: NavigationScope
  campId: string
}) {
  const [selectedTab, setSelectedTab] = React.useState<CampDetailTab>(initialTab)
  const totalSessionItems = sessions.length
  const sessionPageCount = Math.max(1, Math.ceil(totalSessionItems / SESSIONS_PAGE_SIZE))
  const normalizedInitialSessionPage = Math.max(1, Math.min(initialSessionPage, sessionPageCount))
  const [sessionPage, setSessionPage] = React.useState<number>(normalizedInitialSessionPage)
  const safeSessionPage = Math.max(1, Math.min(sessionPage, sessionPageCount))
  const sessionPaginationItems = React.useMemo(
    () => buildSessionPaginationItems(safeSessionPage, sessionPageCount),
    [safeSessionPage, sessionPageCount],
  )
  const sessionsStartIndex = (safeSessionPage - 1) * SESSIONS_PAGE_SIZE
  const paginatedSessions = React.useMemo(
    () => sessions.slice(sessionsStartIndex, sessionsStartIndex + SESSIONS_PAGE_SIZE),
    [sessions, sessionsStartIndex],
  )
  const visibleSessionsFrom = totalSessionItems > 0 ? sessionsStartIndex + 1 : 0
  const visibleSessionsTo = sessionsStartIndex + paginatedSessions.length

  function setSessionPageSafely(nextPage: number): void {
    const normalizedPage = Math.max(1, Math.min(nextPage, sessionPageCount))
    setSessionPage(normalizedPage)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{kpi.note}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(resolveTab(value))}
        className="space-y-4"
      >
        <TabsList className="h-10">
          {CAMP_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <TabsContent value="sessions">
            <div className="space-y-4">
              <header className="space-y-1">
                <h3 className="text-base font-semibold">Latest Sessions</h3>
                <p className="text-sm text-muted-foreground">Last 10 sessions of this camp</p>
              </header>

              {totalSessionItems === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sessions found for this camp.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {paginatedSessions.map((session) => (
                    <li key={session.id}>
                      <Link
                        href={buildSessionDetailHref({
                          scope,
                          sessionId: session.id,
                        })}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)_auto] items-center gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium underline-offset-4 hover:underline">
                            {session.sessionDateLabel}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{campName}</p>
                        </div>

                        <p className="justify-self-start text-left text-xs font-medium text-muted-foreground md:text-sm">
                          {session.sessionTypeLabel}
                        </p>

                        <div className="text-right">
                          <p className="shrink-0 text-sm font-semibold tabular-nums">
                            {session.durationLabel}
                          </p>
                          {session.highlightedByCoach ? (
                            <p className="text-xs text-emerald-700">Highlighted</p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {sessionPageCount > 1 ? (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {visibleSessionsFrom}-{visibleSessionsTo} of {totalSessionItems}
                  </p>

                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setSessionPageSafely(safeSessionPage - 1)}
                          disabled={safeSessionPage === 1}
                        />
                      </PaginationItem>

                      {sessionPaginationItems.map((pageItem) => (
                        <PaginationItem key={`${pageItem}`}>
                          {typeof pageItem === "number" ? (
                            <PaginationLink
                              isActive={pageItem === safeSessionPage}
                              onClick={() => setSessionPageSafely(pageItem)}
                            >
                              {pageItem}
                            </PaginationLink>
                          ) : (
                            <PaginationEllipsis />
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setSessionPageSafely(safeSessionPage + 1)}
                          disabled={safeSessionPage === sessionPageCount}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Camp Goals</h3>
                  <p className="text-sm text-muted-foreground">
                    Main objectives and priorities for this camp.
                  </p>
                </div>
                {canManageGoals ? (
                  <CampGoalsDialog campId={campId} scope={scope} goals={goals} />
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
          </TabsContent>

          <TabsContent value="notes">
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
          </TabsContent>
        </section>
      </Tabs>
    </div>
  )
}
