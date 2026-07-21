import { Suspense } from "react"

import { TeamAssetsResultsSkeleton } from "@/components/shared/page-skeletons"
import {
  getTeamAssetsChromeData,
  getTeamAssetsResultsData,
  type TeamAssetsChromeData,
  type TeamAssetsResultsData,
} from "@/features/assets/data"
import { resolveTeamAssetsListRequest } from "@/features/assets/list-route-state.mjs"
import {
  TeamAssetsResultsClient,
  TeamAssetsResultsRetry,
  TeamAssetsRouteShell,
} from "@/features/assets/team-assets-page-client"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"
import type { NavigationScope } from "@/lib/navigation/types"

type TeamAssetsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

export default async function TeamAssetsPage({
  searchParams,
}: {
  searchParams: TeamAssetsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Assets unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  if (navigation.scope.activeTeamId === null) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
        <p className="mt-2 text-sm text-amber-800">
          Assets are disabled until a team is selected in the scope picker.
        </p>
      </section>
    )
  }

  const {
    requestedCampId,
    requestedLoadMoreMode,
    requestedPage,
    requestedSessionId,
    requestedTab: rawRequestedTab,
    requestedVenueId,
    requestedYear,
  } = resolveTeamAssetsListRequest({
    campParam: getSingleSearchParamValue(resolvedSearchParams.camp),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    sessionParam: getSingleSearchParamValue(resolvedSearchParams.session),
    tabParam: getSingleSearchParamValue(resolvedSearchParams.tab),
    venueParam: getSingleSearchParamValue(resolvedSearchParams.venue),
    yearParam: getSingleSearchParamValue(resolvedSearchParams.year),
  })
  const requestedTab = rawRequestedTab
  const canManageAssets = canManageTeamSessions({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })
  const chromeData = await getTeamAssetsChromeData({
    activeTeamId: navigation.scope.activeTeamId,
    canManageAssets,
    requestedFilters: {
      campId: requestedCampId,
      sessionId: requestedSessionId,
      venueId: requestedVenueId,
      year: requestedYear,
    },
    tab: requestedTab,
  })

  return (
    <TeamAssetsRouteShell
      chromeData={chromeData}
      scope={navigation.scope}
    >
      <Suspense fallback={<TeamAssetsResultsSkeleton />}>
        <TeamAssetsResults
          activeOrganizationId={navigation.scope.activeOrgId}
          activeTeamId={navigation.scope.activeTeamId}
          accumulatePages={requestedLoadMoreMode}
          chromeData={chromeData}
          page={requestedPage}
          scope={navigation.scope}
        />
      </Suspense>
    </TeamAssetsRouteShell>
  )
}

async function TeamAssetsResults(input: {
  activeOrganizationId: string
  activeTeamId: string
  accumulatePages: boolean
  chromeData: TeamAssetsChromeData
  page: number
  scope: NavigationScope
}) {
  let resultsData: TeamAssetsResultsData | null = null
  let errorMessage: string | null = null

  try {
    resultsData = await getTeamAssetsResultsData({
      activeOrganizationId: input.activeOrganizationId,
      activeTeamId: input.activeTeamId,
      accumulatePages: input.accumulatePages,
      page: input.page,
      selectedFilters: input.chromeData.selectedFilters,
      tab: input.chromeData.tab,
    })
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Could not load asset results. Try again."
  }

  if (errorMessage || !resultsData) {
    return <TeamAssetsResultsRetry message={errorMessage ?? undefined} />
  }

  return (
    <TeamAssetsResultsClient
      chromeData={input.chromeData}
      initialResults={resultsData}
      scope={input.scope}
    />
  )
}
