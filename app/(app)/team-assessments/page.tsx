import { AssessmentsFeedback } from "@/features/assessments/assessments-feedback"
import { TeamAssessmentsPageClient } from "@/features/assessments/team-assessments-page-client"
import { getTeamAssessmentsPageData } from "@/features/assessments/data"
import { resolveTeamAssessmentsListRequest } from "@/features/assessments/list-route-state.mjs"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamAssessmentsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Assessment created successfully."
  }

  if (status === "template_created") {
    return "Assessment template created successfully."
  }

  if (status === "template_updated") {
    return "Assessment template updated successfully."
  }

  if (status === "closed") {
    return "Assessment closed successfully."
  }

  if (status === "deleted") {
    return "Assessment deleted successfully."
  }

  if (status === "answers_saved") {
    return "Assessment answers saved successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted assessment data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage assessments for this team."
  }

  if (error === "create_failed") {
    return "Could not create the assessment. Confirm your permissions and try again."
  }

  if (error === "save_failed") {
    return "Could not save the assessment template. Confirm your permissions and try again."
  }

  if (error === "close_failed") {
    return "Could not close the assessment. Confirm your permissions and try again."
  }

  if (error === "delete_failed") {
    return "Could not delete the assessment. Confirm your permissions and try again."
  }

  if (error === "answer_failed") {
    return "Could not save your assessment answers. Confirm your access and try again."
  }

  return null
}

export default async function TeamAssessmentsPage({
  searchParams,
}: {
  searchParams: TeamAssessmentsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const {
    requestedLoadMoreMode,
    requestedNewTemplate,
    requestedPage,
    requestedTab,
    requestedTemplateId,
  } = resolveTeamAssessmentsListRequest({
    tabParam: getSingleSearchParamValue(resolvedSearchParams.tab),
    pageParam: getSingleSearchParamValue(resolvedSearchParams.page),
    loadMoreParam: getSingleSearchParamValue(resolvedSearchParams.loadMore),
    templateParam: getSingleSearchParamValue(resolvedSearchParams.template),
    newParam: getSingleSearchParamValue(resolvedSearchParams.new),
  })

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Team assessments unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  if (!context.profile) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Team assessments unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Your account profile is still being prepared. Try again shortly.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const canManageAssessments =
    scope.activeTeamId !== null &&
    canManageTeamStructure({
      context,
      organizationId: scope.activeOrgId,
      teamId: scope.activeTeamId,
    })
  const data = scope.activeTeamId
    ? await getTeamAssessmentsPageData({
        activeTeamId: scope.activeTeamId,
        currentProfileId: context.profile.id,
        page: requestedPage,
        accumulatePages: requestedLoadMoreMode,
      })
    : {
        venueOptions: [],
        campOptions: [],
        templates: [],
        runs: [],
        pagination: {
          currentPage: requestedPage,
          pageCount: 1,
          hasPreviousPage: requestedPage > 1,
          hasNextPage: false,
        },
      }

  return (
    <div className="space-y-6">
      <AssessmentsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Team selection required
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageAssessments ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view assessments in this scope, but only super admins,
            organization admins, team admins, and coaches can create or edit them.
          </p>
        </section>
      ) : null}

      <TeamAssessmentsPageClient
        canManageAssessments={canManageAssessments}
        data={data}
        creatingTemplate={requestedNewTemplate}
        noTeamSelected={noTeamSelected}
        scope={scope}
        selectedTab={requestedTab}
        selectedTemplateId={requestedTemplateId}
      />
    </div>
  )
}
