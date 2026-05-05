"use client"

import Link from "next/link"
import { MoreHorizontalIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import type {
  TeamSessionCampOption,
  TeamSessionListItem,
} from "@/features/sessions/data"
import {
  EditSessionDialog,
} from "@/features/sessions/session-form-dialogs"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TeamSessionsTableProps = {
  sessions: TeamSessionListItem[]
  campOptions: TeamSessionCampOption[]
  canManageSessions: boolean
  noTeamSelected: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function formatSessionTypeLabel(value: TeamSessionListItem["sessionType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatNetTime(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

export function TeamSessionsTable({
  sessions,
  campOptions,
  canManageSessions,
  noTeamSelected,
  toolbar,
  scope,
  selectedVenueId,
  selectedCampId,
  currentPage,
  hasPreviousPage,
  hasNextPage,
}: TeamSessionsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildPageHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString())

    if (nextPage <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(nextPage))
    }

    const nextSearch = params.toString()
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sessions</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Camp</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Net Time</TableHead>
              <TableHead>Highlight</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                  {noTeamSelected
                    ? "No team selected. Choose a team to view sessions."
                    : selectedCampId
                      ? "No sessions found for the selected camp."
                      : selectedVenueId
                        ? "No sessions found for the selected venue."
                        : "No sessions found for this team yet."}
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow
                  key={session.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => {
                    router.push(
                      buildSessionDetailHref({
                        scope,
                        sessionId: session.id,
                      }),
                    )
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      router.push(
                        buildSessionDetailHref({
                          scope,
                          sessionId: session.id,
                        }),
                      )
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={buildSessionDetailHref({
                        scope,
                        sessionId: session.id,
                      })}
                      className="underline-offset-4 hover:underline"
                    >
                      {formatDateLabel(session.sessionDate)}
                    </Link>
                  </TableCell>
                  <TableCell>{formatSessionTypeLabel(session.sessionType)}</TableCell>
                  <TableCell>{session.campName}</TableCell>
                  <TableCell>{session.venueName}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNetTime(session.netTimeMinutes)}
                  </TableCell>
                  <TableCell>
                    {session.highlightedByCoach ? (
                      <span className="text-emerald-700">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    {canManageSessions ? (
                      <EditSessionDialog
                        session={session}
                        campOptions={campOptions}
                        scope={scope}
                        selectedVenueId={selectedVenueId}
                        selectedCampId={selectedCampId}
                        currentPage={currentPage}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        aria-label="More actions unavailable"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasPreviousPage || hasNextPage ? (
        <Pagination className="justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage}
                onClick={() => {
                  if (hasPreviousPage) {
                    router.push(buildPageHref(currentPage - 1))
                  }
                }}
              />
            </PaginationItem>

            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">Page {currentPage}</span>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                disabled={!hasNextPage}
                onClick={() => {
                  if (hasNextPage) {
                    router.push(buildPageHref(currentPage + 1))
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
