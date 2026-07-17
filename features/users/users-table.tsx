"use client"

import { useState, useTransition } from "react"
import { Loader2Icon, MoreHorizontalIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type {
  CrewListItem,
  CrewTeamOption,
} from "@/features/users/data"
import { CrewActionsMenu } from "@/features/users/user-form-dialogs"
import { buildUsersPageHref } from "@/features/users/list-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { GradientCard } from "@/components/shared/gradient-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
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
import { cn } from "@/lib/utils"

type UsersPaginationItem = number | "ellipsis-start" | "ellipsis-end"
type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return "CR"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase()
}

function formatTeamRoleLabel(
  role: CrewListItem["linkedTeams"][number]["role"],
): string {
  if (role === "team_admin") {
    return "Team Admin"
  }

  if (role === "coach") {
    return "Coach"
  }

  return "Crew"
}

function InviteStatusBadge({ firstSeenAt }: { firstSeenAt: string | null }) {
  if (firstSeenAt) {
    return null
  }

  return <Badge variant="outline">Invited</Badge>
}

function TeamsAndRolesBadges({
  crew,
}: {
  crew: CrewListItem
}) {
  const hasOrganizationRole = crew.membershipKind === "organization"

  if (!hasOrganizationRole && crew.linkedTeams.length === 0) {
    return (
      <Badge variant="secondary" className="max-w-full truncate">
        No teams
      </Badge>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {hasOrganizationRole ? (
        <Badge variant="secondary" className="max-w-full truncate">
          Organization Admin
        </Badge>
      ) : null}
      {crew.linkedTeams.map((team) => {
        const roleLabel = formatTeamRoleLabel(team.role)

        return (
          <Badge
            key={team.id}
            variant="outline"
            className="max-w-full gap-1 truncate"
            title={`${team.name} · ${roleLabel}`}
          >
            <span className="min-w-0 truncate">{team.name}</span>
            <span className="shrink-0 text-muted-foreground">·</span>
            <span className="shrink-0">{roleLabel}</span>
          </Badge>
        )
      })}
    </div>
  )
}

function buildUsersPaginationItems(
  currentPage: number,
  pageCount: number,
): UsersPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: UsersPaginationItem[] = [1]
  const middleStart = Math.max(2, currentPage - 1)
  const middleEnd = Math.min(pageCount - 1, currentPage + 1)

  if (middleStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < pageCount - 1) {
    items.push("ellipsis-end")
  }

  items.push(pageCount)

  return items
}

export function UsersTable({
  currentPage,
  crews,
  hasNextPage,
  hasPreviousPage,
  loadMoreMode,
  pageCount,
  teamOptions,
  canManageUsers,
  scope,
  selectedTeamId,
}: {
  currentPage: number
  crews: CrewListItem[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  loadMoreMode: boolean
  pageCount: number
  teamOptions: CrewTeamOption[]
  canManageUsers: boolean
  scope: NavigationScope
  selectedTeamId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const paginationItems = buildUsersPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildUsersPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPaginationBusy ||
      nextPageNumber === currentPage ||
      nextPageNumber < 1 ||
      nextPageNumber > pageCount
    ) {
      return
    }

    setPendingPageNavigation({
      fromPage: currentPage,
      toPage: nextPageNumber,
    })
    startPageNavigationTransition(() => {
      router.push(buildPageHref(nextPageNumber))
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2 md:hidden">
        {crews.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            No members found for this scope.
          </GradientCard>
        ) : (
          crews.map((crew) => (
            <GradientCard
              key={`${crew.membershipKind}-${crew.membershipId}`}
              className="px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar className="size-10 shrink-0">
                    {crew.avatarUrl ? (
                      <AvatarImage src={crew.avatarUrl} alt={crew.fullName} />
                    ) : null}
                    <AvatarFallback>{getInitials(crew.fullName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">{crew.fullName}</p>
                      {crew.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {crew.email}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <TeamsAndRolesBadges crew={crew} />
                      <InviteStatusBadge firstSeenAt={crew.firstSeenAt} />
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {canManageUsers ? (
                    <CrewActionsMenu
                      crew={crew}
                      currentPage={currentPage}
                      loadMoreMode={loadMoreMode}
                      teamOptions={teamOptions}
                      scope={scope}
                      selectedTeamId={selectedTeamId}
                      surface="drawer"
                      triggerClassName="h-11 w-11"
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      aria-label="More actions unavailable"
                      className="h-11 w-11"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </GradientCard>
          ))
        )}

        {hasNextPage ? (
          <div className="pb-4 pt-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={isLoadingMore}
              aria-label="Load more members"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more members"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <GradientCard
        aria-busy={isPaginationBusy}
        className="relative hidden overflow-hidden p-0 md:block"
      >
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[50%]" />
              <col className="w-[10%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Full name</TableHead>
                <TableHead>Teams / Roles</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {crews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-sm text-muted-foreground">
                    No members found for this scope.
                  </TableCell>
                </TableRow>
              ) : (
                crews.map((crew) => (
                  <TableRow key={`${crew.membershipKind}-${crew.membershipId}`}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          {crew.avatarUrl ? (
                            <AvatarImage src={crew.avatarUrl} alt={crew.fullName} />
                          ) : null}
                          <AvatarFallback>{getInitials(crew.fullName)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">{crew.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TeamsAndRolesBadges crew={crew} />
                        <InviteStatusBadge firstSeenAt={crew.firstSeenAt} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageUsers ? (
                        <CrewActionsMenu
                          crew={crew}
                          currentPage={currentPage}
                          loadMoreMode={loadMoreMode}
                          teamOptions={teamOptions}
                          scope={scope}
                          selectedTeamId={selectedTeamId}
                          surface="sheet"
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

        {isPaginationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading members page"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

      {pageCount > 1 ? (
        <Pagination
          aria-busy={isPaginationBusy}
          className="hidden justify-start md:flex"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPreviousPage || isPaginationBusy}
                onClick={() => navigateToPage(previousPage)}
              />
            </PaginationItem>

            {paginationItems.map((pageItem) => (
              <PaginationItem key={`${pageItem}`}>
                {typeof pageItem === "number" ? (
                  <PaginationLink
                    aria-label={`Go to page ${pageItem}`}
                    disabled={isPaginationBusy}
                    isActive={pageItem === currentPage}
                    onClick={() => navigateToPage(pageItem)}
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
                disabled={!hasNextPage || isPaginationBusy}
                onClick={() => navigateToPage(nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
