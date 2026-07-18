"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import type { TeamNoteCard } from "@/features/notes/data"
import { buildTeamNotesPageHref } from "@/features/notes/list-route-state.mjs"
import { cn } from "@/lib/utils"

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function formatSessionTypeLabel(value: TeamNoteCard["sessionType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function renderValues(values: string[]): string {
  if (values.length === 0) {
    return "-"
  }

  return values.join(", ")
}

function renderText(value: string | null): string {
  return value ?? "-"
}

function renderWindPatterns(card: TeamNoteCard): string {
  if (card.notes.windPatterns.length > 0) {
    return renderValues(card.notes.windPatterns)
  }

  return renderText(card.notes.legacyWindPatterns)
}

function renderHighlightedText(input: {
  searchQuery: string
  text: string
}): React.ReactNode {
  const query = input.searchQuery.trim()

  if (query.length === 0 || input.text === "-") {
    return input.text
  }

  const lowerText = input.text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0
  let matchIndex = lowerText.indexOf(lowerQuery)

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(input.text.slice(cursor, matchIndex))
    }

    const matchEnd = matchIndex + lowerQuery.length
    parts.push(
      <mark
        key={`${matchIndex}-${matchEnd}`}
        className="rounded bg-amber-200 px-0.5 text-foreground dark:bg-amber-400/30"
      >
        {input.text.slice(matchIndex, matchEnd)}
      </mark>,
    )
    cursor = matchEnd
    matchIndex = lowerText.indexOf(lowerQuery, cursor)
  }

  if (cursor < input.text.length) {
    parts.push(input.text.slice(cursor))
  }

  return parts.length > 0 ? parts : input.text
}

function HighlightedText({
  searchQuery,
  text,
}: {
  searchQuery: string
  text: string
}) {
  return <>{renderHighlightedText({ searchQuery, text })}</>
}

function BoatSetupValues({
  card,
  className,
  searchQuery,
}: {
  card: TeamNoteCard
  className?: string
  searchQuery: string
}) {
  if (card.boatSetup.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No boat setup values recorded.
      </p>
    )
  }

  return (
    <div className={cn("grid gap-x-4 gap-y-3 sm:grid-cols-2", className)}>
      {card.boatSetup.map((entry) => (
        <div key={`${card.sessionId}-${entry.key}`}>
          <p className="text-sm text-muted-foreground">{entry.label}</p>
          <p className="font-medium">
            <HighlightedText searchQuery={searchQuery} text={entry.value} />
          </p>
        </div>
      ))}
    </div>
  )
}

export function TeamNotesCards(input: {
  cards: TeamNoteCard[]
  currentPage: number
  hasNextPage: boolean
  emptyStateMessage: string
  searchQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = React.useTransition()
  const cardsTopRef = React.useRef<HTMLElement | null>(null)
  const previousPageRef = React.useRef(input.currentPage)
  const shouldRestoreCardsTopRef = React.useRef(false)

  React.useEffect(() => {
    if (
      shouldRestoreCardsTopRef.current &&
      !isLoadingMore &&
      input.currentPage > previousPageRef.current
    ) {
      shouldRestoreCardsTopRef.current = false

      window.requestAnimationFrame(() => {
        cardsTopRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        })
        cardsTopRef.current?.focus({ preventScroll: true })
      })
    }

    previousPageRef.current = input.currentPage
  }, [input.currentPage, isLoadingMore])

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamNotesPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  if (input.cards.length === 0) {
    return (
      <section
        ref={cardsTopRef}
        tabIndex={-1}
        className="rounded-xl border bg-card p-6 outline-none"
      >
        <h2 className="text-base font-semibold">No notes yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">{input.emptyStateMessage}</p>
      </section>
    )
  }

  return (
    <section ref={cardsTopRef} tabIndex={-1} className="space-y-4 outline-none">
      {input.cards.map((card) => (
        <article key={card.sessionId} className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                <HighlightedText searchQuery={input.searchQuery} text={card.venueName} />
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                <HighlightedText searchQuery={input.searchQuery} text={card.campName} />
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-xl border bg-muted/40 px-3 py-1.5 text-xs">
                <HighlightedText
                  searchQuery={input.searchQuery}
                  text={formatDateLabel(card.sessionDate)}
                />
              </span>
              <span className="rounded-xl border bg-muted/40 px-3 py-1.5 text-xs">
                <HighlightedText
                  searchQuery={input.searchQuery}
                  text={formatSessionTypeLabel(card.sessionType)}
                />
              </span>
            </div>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl bg-muted p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Weather
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight md:text-4xl">
                <HighlightedText
                  searchQuery={input.searchQuery}
                  text={renderValues(card.conditions.tws)}
                />
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Sea State</dt>
                  <dd className="font-medium">
                    <HighlightedText
                      searchQuery={input.searchQuery}
                      text={renderValues(card.conditions.seaState)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">TWD</dt>
                  <dd className="font-medium">
                    <HighlightedText
                      searchQuery={input.searchQuery}
                      text={renderValues(card.conditions.twd)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Conditions</dt>
                  <dd className="font-medium">
                    <HighlightedText
                      searchQuery={input.searchQuery}
                      text={renderValues(card.conditions.conditions)}
                    />
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl bg-muted p-4 md:hidden">
              <Accordion>
                <AccordionItem
                  value={`${card.sessionId}-boat-setup`}
                  className="border-0"
                >
                  <AccordionTrigger className="items-center py-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:no-underline [&_[data-slot=accordion-trigger-icon]]:size-4">
                    <span>Boat Setup</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 pb-0 [&_p:not(:last-child)]:mb-0">
                    <BoatSetupValues card={card} searchQuery={input.searchQuery} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            <section className="hidden rounded-xl bg-muted p-4 md:block">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Boat Setup
              </p>
              <BoatSetupValues
                card={card}
                className="mt-3"
                searchQuery={input.searchQuery}
              />
            </section>
          </div>

          <section className="mt-4 rounded-xl bg-muted p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">Best</p>
                <p className="whitespace-pre-wrap font-medium">
                  <HighlightedText
                    searchQuery={input.searchQuery}
                    text={renderText(card.notes.bestOfSession)}
                  />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">To Work</p>
                <p className="whitespace-pre-wrap font-medium">
                  <HighlightedText
                    searchQuery={input.searchQuery}
                    text={renderText(card.notes.toWork)}
                  />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Free Notes</p>
                <p className="whitespace-pre-wrap font-medium">
                  <HighlightedText
                    searchQuery={input.searchQuery}
                    text={renderText(card.notes.freeNotes)}
                  />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Std. Moves</p>
                <p className="whitespace-pre-wrap font-medium">
                  <HighlightedText
                    searchQuery={input.searchQuery}
                    text={renderValues(card.notes.standardMoves)}
                  />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wind Patterns</p>
                <p className="whitespace-pre-wrap font-medium">
                  <HighlightedText
                    searchQuery={input.searchQuery}
                    text={renderWindPatterns(card)}
                  />
                </p>
              </div>
            </div>
          </section>
        </article>
      ))}

      {input.hasNextPage ? (
        <div className="pb-4 pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={isLoadingMore}
            aria-label="Load more notes"
            className="h-11 w-full md:mx-auto md:max-w-xs"
            onClick={() => {
              shouldRestoreCardsTopRef.current = true
              startLoadMoreTransition(() => {
                router.push(buildPageHref(input.currentPage + 1, true))
              })
            }}
          >
            {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
            <span>{isLoadingMore ? "Loading more..." : "Load more sessions"}</span>
          </Button>
        </div>
      ) : null}
    </section>
  )
}
