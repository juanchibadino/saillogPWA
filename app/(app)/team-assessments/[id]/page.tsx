import { AssessmentDetailClient } from "@/features/assessments/assessment-detail-client"
import { AssessmentsFeedback } from "@/features/assessments/assessments-feedback"
import { getTeamAssessmentDetailData } from "@/features/assessments/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamAssessmentDetailParams = Promise<{ id: string }>
type TeamAssessmentDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "closed") {
    return "Assessment closed successfully."
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
    return "You do not have permission to manage this assessment in the active scope."
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

export default async function TeamAssessmentDetailPage({
  params,
  searchParams,
}: {
  params: TeamAssessmentDetailParams
  searchParams: TeamAssessmentDetailSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">No active scope</h2>
        <p className="mt-2 text-sm text-amber-800">
          Assessment detail requires an active organization context.
        </p>
      </section>
    )
  }

  if (!context.profile) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Assessment unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Your account profile is still being prepared. Try again shortly.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (scope.activeTeamId === null) {
    return (
      <div className="space-y-6">
        <AssessmentsFeedback
          statusMessage={statusMessage}
          errorMessage={errorMessage}
        />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Team selection required
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Assessment operations are team-scoped. Select a team from the scope picker.
          </p>
        </section>
      </div>
    )
  }

  const canManageAssessments = canManageTeamStructure({
    context,
    organizationId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  })
  const detail = await getTeamAssessmentDetailData({
    activeTeamId: scope.activeTeamId,
    currentProfileId: context.profile.id,
    assessmentId: resolvedParams.id,
  })

  return (
    <div className="space-y-6">
      <AssessmentsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageAssessments ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Management actions are disabled.
          </p>
        </section>
      ) : null}

      {detail ? (
        <AssessmentDetailClient
          canManageAssessments={canManageAssessments}
          detail={detail}
          scope={scope}
        />
      ) : (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Assessment unavailable
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            This assessment does not exist in the active team scope or is not
            accessible.
          </p>
        </section>
      )}
    </div>
  )
}
