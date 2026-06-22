import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import type { TeamNoteCard } from "@/features/notes/data"
import type { NavigationScope } from "@/lib/navigation/types"

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
    return "—"
  }

  return values.join(", ")
}

function renderText(value: string | null): string {
  return value ?? "—"
}

function renderWindPatterns(card: TeamNoteCard): string {
  if (card.notes.windPatterns.length > 0) {
    return renderValues(card.notes.windPatterns)
  }

  return renderText(card.notes.legacyWindPatterns)
}

export function TeamNotesCards(input: {
  scope: NavigationScope
  cards: TeamNoteCard[]
  hasNextPage: boolean
  loadMoreHref: string | null
  emptyStateMessage: string
}) {
  if (input.cards.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-base font-semibold">No notes yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">{input.emptyStateMessage}</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {input.cards.map((card) => (
        <article key={card.sessionId} className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{card.venueName}</h2>
              <p className="mt-1 text-base text-muted-foreground">{card.campName}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-xl border bg-muted/40 px-3 py-1.5 text-xs">
                {formatDateLabel(card.sessionDate)}
              </span>
              <span className="rounded-xl border bg-muted/40 px-3 py-1.5 text-xs">
                {formatSessionTypeLabel(card.sessionType)}
              </span>
            </div>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl bg-muted p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Weather
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{renderValues(card.conditions.tws)}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Sea State</dt>
                  <dd className="font-medium">{renderValues(card.conditions.seaState)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">TWD</dt>
                  <dd className="font-medium">{renderValues(card.conditions.twd)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Conditions</dt>
                  <dd className="font-medium">{renderValues(card.conditions.conditions)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl bg-muted p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Boat Setup
              </p>
              {card.boatSetup.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No boat setup values recorded.</p>
              ) : (
                <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {card.boatSetup.map((entry) => (
                    <div key={`${card.sessionId}-${entry.key}`}>
                      <p className="text-sm text-muted-foreground">{entry.label}</p>
                      <p className="font-medium">{entry.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="mt-4 rounded-xl bg-muted p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">Best</p>
                <p className="whitespace-pre-wrap font-medium">{renderText(card.notes.bestOfSession)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">To Work</p>
                <p className="whitespace-pre-wrap font-medium">{renderText(card.notes.toWork)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Free Notes</p>
                <p className="whitespace-pre-wrap font-medium">{renderText(card.notes.freeNotes)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Std. Moves</p>
                <p className="whitespace-pre-wrap font-medium">
                  {renderValues(card.notes.standardMoves)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wind Patterns</p>
                <p className="whitespace-pre-wrap font-medium">{renderWindPatterns(card)}</p>
              </div>
            </div>
          </section>
        </article>
      ))}

      {input.hasNextPage && input.loadMoreHref ? (
        <div className="flex justify-center">
          <Link href={input.loadMoreHref} className={buttonVariants({ variant: "outline" })}>
            Load more sessions
          </Link>
        </div>
      ) : null}
    </section>
  )
}
