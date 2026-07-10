import { getTeamAssetsPageData } from "@/features/assets/data"
import { resolveTeamAssetsListRequest } from "@/features/assets/list-route-state.mjs"
import { TeamAssetsPageClient } from "@/features/assets/team-assets-page-client"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

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
  const requestedTab = rawRequestedTab === "files" ? "files" : "images"
  const canManageAssets = canManageTeamSessions({
    context,
    organizationId: navigation.scope.activeOrgId,
    teamId: navigation.scope.activeTeamId,
  })
  const pageData = await getTeamAssetsPageData({
    activeOrganizationId: navigation.scope.activeOrgId,
    activeTeamId: navigation.scope.activeTeamId,
    accumulatePages: requestedLoadMoreMode,
    canManageAssets,
    page: requestedPage,
    requestedFilters: {
      campId: requestedCampId,
      sessionId: requestedSessionId,
      venueId: requestedVenueId,
      year: requestedYear,
    },
    tab: requestedTab,
  })

  return (
    <TeamAssetsPageClient
      initialData={pageData}
      scope={navigation.scope}
    />
  )
}
