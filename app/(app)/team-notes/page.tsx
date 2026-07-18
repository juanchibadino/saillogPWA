import { Suspense } from "react"

import {
  TeamNotesPageSkeleton,
  TeamNotesResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { TeamNotesCards } from "@/features/notes/team-notes-cards"
import {
  getTeamNotesChromeData,
  getTeamNotesResultsData,
  type TeamNotesChromeData,
} from "@/features/notes/data"
import { resolveTeamNotesListRequest } from "@/features/notes/list-route-state.mjs"
import { TeamNotesResultsRetry } from "@/features/notes/team-notes-results-retry"
import { TeamNotesRouteShell } from "@/features/notes/team-notes-route-shell"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamNotesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamNotesScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamNotesChromeDataPromise = Promise<TeamNotesChromeData>

async function TeamNotesShellSlot(input: {
  activeTeamId: string
  chromeDataPromise: TeamNotesChromeDataPromise
  requestedPage: number
  scope: ResolvedTeamNotesScope
}) {
  const chromeData = await input.chromeDataPromise

  return (
    <TeamNotesRouteShell chromeData={chromeData} scope={input.scope}>
      <Suspense fallback={<TeamNotesResultsSkeleton />}>
        <TeamNotesResultsContent
          activeTeamId={input.activeTeamId}
          chromeData={chromeData}
          requestedPage={input.requestedPage}
        />
      </Suspense>
    </TeamNotesRouteShell>
  )
}

async function TeamNotesResultsContent(input: {
  activeTeamId: string
  chromeData: TeamNotesChromeData
  requestedPage: number
}) {
  let resultsData: Awaited<ReturnType<typeof getTeamNotesResultsData>>

  try {
    resultsData = await getTeamNotesResultsData({
      activeTeamId: input.activeTeamId,
      chromeData: input.chromeData,
      page: input.requestedPage,
    })
  } catch {
    return <TeamNotesResultsRetry />
  }

  const hasActiveFilters =
    input.chromeData.searchQuery.length > 0 ||
    Boolean(input.chromeData.selectedVenueId) ||
    input.chromeData.selectedTwsValues.length > 0 ||
    input.chromeData.selectedConditionsValues.length > 0
  const emptyStateMessage = hasActiveFilters
    ? "No sessions match the current notes filters."
    : "No sessions with setup or notes data are available for this team yet."

  return (
    <TeamNotesCards
      cards={resultsData.cards}
      currentPage={resultsData.currentPage}
      hasNextPage={resultsData.hasNextPage}
      emptyStateMessage={emptyStateMessage}
      searchQuery={input.chromeData.searchQuery}
    />
  )
}

export default async function TeamNotesPage({
  searchParams,
}: {
  searchParams: TeamNotesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const {
    requestedConditionsValues,
    requestedPage,
    requestedSearchQuery,
    requestedTwsValues,
    requestedVenueId,
  } = resolveTeamNotesListRequest({
    searchQueryParam: getSingleSearchParamValue(resolvedSearchParams.q),
    venueParam: getSingleSearchParamValue(resolvedSearchParams.venue),
    twsParam: resolvedSearchParams.tws,
    conditionsParam: resolvedSearchParams.conditions,
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
  }) as {
    requestedConditionsValues: string[]
    requestedPage: number
    requestedSearchQuery: string
    requestedTwsValues: string[]
    requestedVenueId?: string
  }

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team notes unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (scope.activeTeamId === null) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
        <p className="mt-2 text-sm text-amber-800">
          Team notes are disabled until a team is selected in the scope picker.
        </p>
      </section>
    )
  }

  const chromeDataPromise: TeamNotesChromeDataPromise = getTeamNotesChromeData({
    activeTeamId: scope.activeTeamId,
    selectedVenueId: requestedVenueId,
    selectedTwsValues: requestedTwsValues,
    selectedConditionsValues: requestedConditionsValues,
    searchQuery: requestedSearchQuery,
  })

  return (
    <Suspense fallback={<TeamNotesPageSkeleton />}>
      <TeamNotesShellSlot
        activeTeamId={scope.activeTeamId}
        chromeDataPromise={chromeDataPromise}
        requestedPage={requestedPage}
        scope={scope}
      />
    </Suspense>
  )
}
