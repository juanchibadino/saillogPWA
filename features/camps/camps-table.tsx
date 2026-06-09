"use client"

import { MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import {
  type TeamCampListItem,
  type TeamCampVenueOption,
} from "@/features/camps/data"
import { buildCampDetailHref } from "@/features/camps/navigation"
import {
  CampActionsMenu,
} from "@/features/camps/camp-form-dialogs"
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

type TeamCampsTableProps = {
  camps: TeamCampListItem[]
  teamVenueOptions: TeamCampVenueOption[]
  canManageCamps: boolean
  canDeleteCamps: boolean
  noTeamSelected: boolean
  toolbar?: ReactNode
  scope: NavigationScope
  selectedVenueId?: string
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

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`
}

function formatCampTypeLabel(value: TeamCampListItem["campType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function resolveEmptyMessage(input: {
  noTeamSelected: boolean
  selectedVenueId?: string
}): string {
  if (input.noTeamSelected) {
    return "No team selected. Choose a team to view camps."
  }

  if (input.selectedVenueId) {
    return "No camps found for the selected venue."
  }

  return "No camps found for this team yet."
}

export function TeamCampsTable({
  camps,
  teamVenueOptions,
  canManageCamps,
  canDeleteCamps,
  noTeamSelected,
  toolbar,
  scope,
  selectedVenueId,
  currentPage,
  hasPreviousPage,
  hasNextPage,
}: TeamCampsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const emptyMessage = resolveEmptyMessage({
    noTeamSelected,
    selectedVenueId,
  })

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
        <h2 className="text-lg font-semibold">Camps</h2>
        {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
      </div>

      <div className="space-y-2 md:hidden">
        {camps.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          camps.map((camp) => {
            const detailHref = buildCampDetailHref({
              scope,
              campId: camp.id,
              tab: "sessions",
            })

            return (
              <article
                key={camp.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer rounded-xl border bg-card px-3 py-3 transition-colors hover:bg-muted/30"
                onClick={() => {
                  router.push(detailHref)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    router.push(detailHref)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{camp.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {camp.venueName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCampTypeLabel(camp.campType)} ·{" "}
                      {formatDateRange(camp.startDate, camp.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sessions:{" "}
                      <span className="font-semibold text-foreground">
                        {camp.sessionCount}
                      </span>
                      {" · "}
                      <span className={camp.isActive ? "text-emerald-700" : "text-muted-foreground"}>
                        {camp.isActive ? "Active" : "Inactive"}
                      </span>
                    </p>
                  </div>

                  <div
                    className="shrink-0"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    {canManageCamps || canDeleteCamps ? (
                      <CampActionsMenu
                        camp={camp}
                        teamVenueOptions={teamVenueOptions}
                        scope={scope}
                        selectedVenueId={selectedVenueId}
                        currentPage={currentPage}
                        canEditCamp={canManageCamps}
                        canDeleteCamp={canDeleteCamps}
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
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Camp</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead># Sessions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {camps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              camps.map((camp) => (
                <TableRow
                  key={camp.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => {
                    router.push(
                      buildCampDetailHref({
                        scope,
                        campId: camp.id,
                        tab: "sessions",
                      }),
                    )
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      router.push(
                        buildCampDetailHref({
                          scope,
                          campId: camp.id,
                          tab: "sessions",
                        }),
                      )
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={buildCampDetailHref({
                        scope,
                        campId: camp.id,
                        tab: "sessions",
                      })}
                      className="underline-offset-4 hover:underline"
                    >
                      {camp.name}
                    </Link>
                  </TableCell>
                  <TableCell>{camp.venueName}</TableCell>
                  <TableCell>{formatCampTypeLabel(camp.campType)}</TableCell>
                  <TableCell>{formatDateRange(camp.startDate, camp.endDate)}</TableCell>
                  <TableCell>{camp.sessionCount}</TableCell>
                  <TableCell>
                    <span className={camp.isActive ? "text-emerald-700" : "text-muted-foreground"}>
                      {camp.isActive ? "Active" : "Inactive"}
                    </span>
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
                    {canManageCamps || canDeleteCamps ? (
                      <CampActionsMenu
                        camp={camp}
                        teamVenueOptions={teamVenueOptions}
                        scope={scope}
                        selectedVenueId={selectedVenueId}
                        currentPage={currentPage}
                        canEditCamp={canManageCamps}
                        canDeleteCamp={canDeleteCamps}
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
