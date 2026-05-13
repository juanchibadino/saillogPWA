import { TeamNotesCards } from "@/features/notes/team-notes-cards"
import { getTeamNotesPageData } from "@/features/notes/data"
import { TeamNotesToolbar } from "@/features/notes/team-notes-toolbar"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamNotesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function parseRequestedPage(value: string | undefined): number {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

function getMultiSearchParamValues(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return []
  }

  const items = Array.isArray(value) ? value : [value]
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function buildTeamNotesHref(input: {
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
  searchQuery: string
  venueId?: string
  twsValues: string[]
  conditionsValues: string[]
  page: number
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.searchQuery.trim().length > 0) {
    params.set("q", input.searchQuery.trim())
  }

  if (input.venueId) {
    params.set("venue", input.venueId)
  }

  for (const value of input.twsValues) {
    params.append("tws", value)
  }

  for (const value of input.conditionsValues) {
    params.append("conditions", value)
  }

  if (input.page > 1) {
    params.set("page", String(input.page))
  }

  return `/team-notes?${params.toString()}`
}

export default async function TeamNotesPage({
  searchParams,
}: {
  searchParams: TeamNotesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const requestedSearchQuery = getSingleSearchParamValue(resolvedSearchParams.q) ?? ""
  const requestedVenueId = getSingleSearchParamValue(resolvedSearchParams.venue)
  const requestedTwsValues = getMultiSearchParamValues(resolvedSearchParams.tws)
  const requestedConditionsValues = getMultiSearchParamValues(
    resolvedSearchParams.conditions,
  )
  const requestedPage = parseRequestedPage(
    getSingleSearchParamValue(resolvedSearchParams.page),
  )

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

  const pageData = await getTeamNotesPageData({
    activeTeamId: scope.activeTeamId,
    selectedVenueId: requestedVenueId,
    selectedTwsValues: requestedTwsValues,
    selectedConditionsValues: requestedConditionsValues,
    searchQuery: requestedSearchQuery,
    page: requestedPage,
  })

  const loadMoreHref = pageData.hasNextPage
    ? buildTeamNotesHref({
        scope,
        searchQuery: pageData.searchQuery,
        venueId: pageData.selectedVenueId,
        twsValues: pageData.selectedTwsValues,
        conditionsValues: pageData.selectedConditionsValues,
        page: pageData.currentPage + 1,
      })
    : null

  const hasActiveFilters =
    pageData.searchQuery.length > 0 ||
    Boolean(pageData.selectedVenueId) ||
    pageData.selectedTwsValues.length > 0 ||
    pageData.selectedConditionsValues.length > 0
  const emptyStateMessage = hasActiveFilters
    ? "No sessions match the current notes filters."
    : "No sessions with setup or notes data are available for this team yet."

  return (
    <div className="space-y-4">
      <TeamNotesToolbar
        scope={scope}
        searchQuery={pageData.searchQuery}
        selectedVenueId={pageData.selectedVenueId}
        selectedTwsValues={pageData.selectedTwsValues}
        selectedConditionsValues={pageData.selectedConditionsValues}
        venueFilterOptions={pageData.venueFilterOptions}
        twsFilterOptions={pageData.twsFilterOptions}
        conditionsFilterOptions={pageData.conditionsFilterOptions}
      />

      <TeamNotesCards
        scope={scope}
        cards={pageData.cards}
        hasNextPage={pageData.hasNextPage}
        loadMoreHref={loadMoreHref}
        emptyStateMessage={emptyStateMessage}
      />
    </div>
  )
}
