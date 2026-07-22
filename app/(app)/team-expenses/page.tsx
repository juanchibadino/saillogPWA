import { Suspense } from "react"

import { GradientCard } from "@/components/shared/gradient-card"
import { TeamExpensesResultsSkeleton } from "@/components/shared/page-skeletons"
import {
  getTeamExpenseFormOptions,
  getTeamExpensesChromeData,
  getTeamExpensesResultsData,
  type TeamExpenseFormOptions,
  type TeamExpensesChromeData,
  type TeamExpensesResultsData,
} from "@/features/expenses/data"
import { TeamExpensesTable } from "@/features/expenses/expenses-table"
import { resolveTeamExpensesListRequest } from "@/features/expenses/list-route-state.mjs"
import { TEAM_EXPENSE_TYPE_OPTIONS } from "@/features/expenses/shared"
import { TeamExpensesRouteShell } from "@/features/expenses/team-expenses-route-shell"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageTeamFinance,
  canManageTeamSessions,
} from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamExpensesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamExpensesScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>

function getCurrentYear(): number {
  return new Date().getUTCFullYear()
}

function getEmptyTeamExpensesChromeData(input: {
  requestedPageYear?: number
  requestedScope?: string
}): TeamExpensesChromeData {
  const year = input.requestedPageYear ?? getCurrentYear()

  return {
    campOptions: [],
    canFilterByMember: false,
    memberOptions: [],
    organizationCurrencyCode: "USD",
    selectedCrewFilter: "you",
    selectedVisibilityScope: input.requestedScope === "team" ? "mine" : "mine",
    selectedYear: year,
    teamExpensesScopeLocked: false,
    teamExpensesVisible: false,
    typeOptions: TEAM_EXPENSE_TYPE_OPTIONS,
    venueOptions: [],
    yearOptions: [
      {
        label: String(year),
        year,
      },
    ],
  }
}

function getEmptyTeamExpensesFormOptions(): TeamExpenseFormOptions {
  return {
    canAssignMembers: false,
    currencyOptions: ["USD"],
    defaultAssignedToProfileId: "",
    memberOptions: [],
    organizationCurrencyCode: "USD",
    typeOptions: TEAM_EXPENSE_TYPE_OPTIONS,
    venueOptions: [],
  }
}

function getEmptyTeamExpensesResults(input: {
  chromeData: TeamExpensesChromeData
  requestedLoadMoreMode: boolean
  requestedPage: number
}): TeamExpensesResultsData {
  return {
    currentPage: input.requestedPage,
    expenses: [],
    hasNextPage: false,
    hasPreviousPage: input.requestedLoadMoreMode ? false : input.requestedPage > 1,
    loadMoreMode: input.requestedLoadMoreMode,
    metrics: {
      myTotalLabel: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: input.chromeData.organizationCurrencyCode,
      }).format(0),
      myTotalValue: 0,
      teamTotalLabel: input.chromeData.teamExpensesVisible
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: input.chromeData.organizationCurrencyCode,
          }).format(0)
        : null,
      teamTotalValue: input.chromeData.teamExpensesVisible ? 0 : null,
    },
    pageCount: 1,
  }
}

async function TeamExpensesResultsContent(input: {
  activeOrganizationId: string
  activeTeamId: string | null
  canManageExpenseRows: boolean
  canManageTeamFinanceRows: boolean
  chromeData: TeamExpensesChromeData
  currentProfileId: string
  formOptions: TeamExpenseFormOptions
  requestedLoadMoreMode: boolean
  requestedPage: number
  scope: ResolvedTeamExpensesScope
}) {
  let resultsData: TeamExpensesResultsData

  try {
    resultsData = input.activeTeamId
      ? await getTeamExpensesResultsData({
          activeOrganizationId: input.activeOrganizationId,
          activeTeamId: input.activeTeamId,
          canManageTeamFinance: input.canManageTeamFinanceRows,
          canManageTeamSessions: input.canManageExpenseRows,
          chromeData: input.chromeData,
          currentProfileId: input.currentProfileId,
          page: input.requestedPage,
          accumulatePages: input.requestedLoadMoreMode,
        })
      : getEmptyTeamExpensesResults({
          chromeData: input.chromeData,
          requestedLoadMoreMode: input.requestedLoadMoreMode,
          requestedPage: input.requestedPage,
        })
  } catch {
    return (
      <GradientCard className="px-4 py-6" role="alert">
        <p className="text-sm font-medium">Could not load expenses.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Refresh the page and retry this view.
        </p>
      </GradientCard>
    )
  }

  return (
    <TeamExpensesTable
      currentPage={resultsData.currentPage}
      expenses={resultsData.expenses}
      formOptions={input.formOptions}
      hasNextPage={resultsData.hasNextPage}
      hasPreviousPage={resultsData.hasPreviousPage}
      metrics={resultsData.metrics}
      pageCount={resultsData.pageCount}
      scope={input.scope}
      selectedMemberId={input.chromeData.selectedMemberId}
      selectedTeamVenueId={input.chromeData.selectedVenueId}
      selectedType={input.chromeData.selectedType}
      selectedYear={input.chromeData.selectedYear}
      visibilityScope={input.chromeData.selectedVisibilityScope}
    />
  )
}

export default async function TeamExpensesPage({
  searchParams,
}: {
  searchParams: TeamExpensesSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const {
    requestedCampId,
    requestedCrewFilter,
    requestedLoadMoreMode,
    requestedMemberId,
    requestedPage,
    requestedScope,
    requestedType,
    requestedVenueId,
    requestedYear,
  } = resolveTeamExpensesListRequest({
    campParam: getSingleSearchParamValue(resolvedSearchParams.camp),
    crewParam: getSingleSearchParamValue(resolvedSearchParams.crew),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    memberParam: getSingleSearchParamValue(resolvedSearchParams.member),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    scopeParam: getSingleSearchParamValue(resolvedSearchParams.scope),
    typeParam: getSingleSearchParamValue(resolvedSearchParams.type),
    venueParam: getSingleSearchParamValue(resolvedSearchParams.venue),
    yearParam: getSingleSearchParamValue(resolvedSearchParams.year),
  }) as {
    requestedCampId?: string
    requestedCrewFilter?: string
    requestedLoadMoreMode: boolean
    requestedMemberId?: string
    requestedPage: number
    requestedScope?: string
    requestedType?: string
    requestedVenueId?: string
    requestedYear?: number
  }

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Expenses unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const activeTeamId = scope.activeTeamId
  const noTeamSelected = activeTeamId === null
  const currentProfileId = context.profile?.id ?? context.user.id
  const canManageExpenseRows =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const canManageTeamFinanceRows =
    activeTeamId !== null &&
    canManageTeamFinance({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  const [chromeData, formOptions] = activeTeamId
    ? await Promise.all([
        getTeamExpensesChromeData({
          activeOrganizationId: scope.activeOrgId,
          activeTeamId,
          canManageTeamFinance: canManageTeamFinanceRows,
          currentProfileId,
          requestedCampId,
          requestedCrewFilter,
          requestedMemberId,
          requestedScope,
          requestedType,
          requestedVenueId,
          requestedYear,
        }),
        getTeamExpenseFormOptions({
          activeOrganizationId: scope.activeOrgId,
          activeTeamId,
          canManageTeamFinance: canManageTeamFinanceRows,
          currentProfileId,
        }),
      ])
    : [
        getEmptyTeamExpensesChromeData({
          requestedPageYear: requestedYear,
          requestedScope,
        }),
        getEmptyTeamExpensesFormOptions(),
      ]

  return (
    <div className="space-y-6">
      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Expenses are team-scoped. Select a team from the scope picker to load this
            module.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageExpenseRows ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view visible expenses in this scope, but only team session managers
            can create or edit expense records.
          </p>
        </section>
      ) : null}

      <TeamExpensesRouteShell
        canManageExpenses={canManageExpenseRows}
        chromeData={chromeData}
        formOptions={formOptions}
        noTeamSelected={noTeamSelected}
        scope={scope}
      >
        <Suspense fallback={<TeamExpensesResultsSkeleton />}>
          <TeamExpensesResultsContent
            activeOrganizationId={scope.activeOrgId}
            activeTeamId={activeTeamId}
            canManageExpenseRows={canManageExpenseRows}
            canManageTeamFinanceRows={canManageTeamFinanceRows}
            chromeData={chromeData}
            currentProfileId={currentProfileId}
            formOptions={formOptions}
            requestedLoadMoreMode={requestedLoadMoreMode}
            requestedPage={requestedPage}
            scope={scope}
          />
        </Suspense>
      </TeamExpensesRouteShell>
    </div>
  )
}
