import { Suspense } from "react"

import {
  SessionDetailDeferredContentSkeleton,
  SessionDetailHeaderActionsSkeleton,
  SessionDetailTabsSkeleton,
} from "@/components/shared/page-skeletons"
import { RouteCacheInvalidationOnSuccess } from "@/features/shared/route-cache-invalidation-on-success"
import {
  getSessionDetailShellData,
  getSessionDetailTabData,
} from "@/features/sessions/detail-data"
import { SessionDetailSummaryCards } from "@/features/sessions/detail/session-summary-cards"
import type { SessionDetailTabPayload } from "@/features/sessions/detail-types"
import {
  SessionDetailTabsClient,
  SessionHeaderActions,
} from "@/features/sessions/session-detail-tabs-client"
import { SessionsFeedback } from "@/features/sessions/sessions-feedback"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type SessionDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

type SessionDetailParams = Promise<{ id: string }>
type ResolvedSessionDetailScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type SessionDetailShellDataPromise = ReturnType<typeof getSessionDetailShellData>

function resolveTab(value: string | undefined): SessionDetailTab {
  if (!value) {
    return "info"
  }

  return SESSION_DETAIL_TABS.includes(value as SessionDetailTab)
    ? (value as SessionDetailTab)
    : "info"
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Session created successfully."
  }

  if (status === "updated") {
    return "Session updated successfully."
  }

  if (status === "info_updated") {
    return "Session info updated successfully."
  }

  if (status === "goals_updated") {
    return "Session goals updated successfully."
  }

  if (status === "results_updated") {
    return "Session results updated successfully."
  }

  if (status === "setup_updated") {
    return "Session setup updated successfully."
  }

  if (status === "setup_metric_created") {
    return "Setup metric created successfully."
  }

  if (status === "setup_metric_updated") {
    return "Setup metric updated successfully."
  }

  if (status === "setup_metric_deleted") {
    return "Setup metric deleted successfully."
  }

  if (status === "setup_metrics_reordered") {
    return "Setup metric order updated successfully."
  }

  if (status === "asset_uploaded") {
    return "File uploaded successfully."
  }

  if (status === "gear_updated") {
    return "Session gear updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage this session in the active scope."
  }

  if (error === "update_failed") {
    return "Could not update this session. Confirm your permissions and try again."
  }

  if (error === "upload_failed") {
    return "Could not upload this file. Verify bucket availability and try again."
  }

  return null
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatTimeLabel(value: string | null): string {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date)
}

function formatDurationLabel(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

function resolveDurationMinutes(input: {
  dockOutAt: string | null
  dockInAt: string | null
  fallbackNetTimeMinutes: number | null
}): number | null {
  if (!input.dockOutAt || !input.dockInAt) {
    return input.fallbackNetTimeMinutes
  }

  const start = new Date(input.dockOutAt)
  const end = new Date(input.dockInAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return input.fallbackNetTimeMinutes
  }

  const diffMillis = end.getTime() - start.getTime()

  if (diffMillis < 0) {
    return input.fallbackNetTimeMinutes
  }

  return Math.floor(diffMillis / (60 * 1000))
}

function formatSessionTypeLabel(value: "training" | "regatta"): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function SessionDetailTabsFallback({
  selectedTab,
}: {
  selectedTab: SessionDetailTab
}) {
  return <SessionDetailTabsSkeleton selectedTab={selectedTab} />
}

async function SessionDetailTabsSlot(input: {
  campId: string
  initialTab: SessionDetailTab
  initialTabDataPromise: Promise<SessionDetailTabPayload>
  scope: NonNullable<Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]>
  sessionId: string
  sessionType: "training" | "regatta"
  teamVenueId: string
  goals: string | null
  canManageSession: boolean
}) {
  const initialTabData = await input.initialTabDataPromise

  return (
    <SessionDetailTabsClient
      initialTab={input.initialTab}
      initialTabData={initialTabData}
      scope={input.scope}
      campId={input.campId}
      teamVenueId={input.teamVenueId}
      sessionId={input.sessionId}
      sessionType={input.sessionType}
      goals={input.goals}
      canManageSession={input.canManageSession}
    />
  )
}

async function SessionHeaderActionsSlot(input: {
  canManageSession: boolean
  detailDataPromise: SessionDetailShellDataPromise
  scope: ResolvedSessionDetailScope
}) {
  if (!input.canManageSession) {
    return null
  }

  const detailData = await input.detailDataPromise

  if (!detailData) {
    return null
  }

  return (
    <SessionHeaderActions
      sessionId={detailData.session.id}
      scope={input.scope}
      sessionType={detailData.session.session_type}
      sessionDate={detailData.session.session_date}
      campStartDate={detailData.camp.start_date}
      campEndDate={detailData.camp.end_date}
      dockOutAt={detailData.session.dock_out_at}
      dockInAt={detailData.session.dock_in_at}
      netTimeMinutes={detailData.session.net_time_minutes}
      canManageSession={input.canManageSession}
    />
  )
}

async function SessionDetailResolvedContent(input: {
  canManageSession: boolean
  detailDataPromise: SessionDetailShellDataPromise
  scope: ResolvedSessionDetailScope
  selectedTab: SessionDetailTab
}) {
  const detailData = await input.detailDataPromise

  if (!detailData) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Session unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          This session does not exist in the active team scope or is not accessible.
        </p>
      </section>
    )
  }

  const scopedDetailInput = {
    activeOrganizationId: input.scope.activeOrgId,
    activeTeamId: detailData.team.id,
    teamVenueId: detailData.camp.team_venue_id,
    sessionId: detailData.session.id,
  }
  const selectedTabDataPromise = getSessionDetailTabData({
    ...scopedDetailInput,
    goals: detailData.session.goals,
    tab: input.selectedTab,
  })

  const sessionTypeLabel = formatSessionTypeLabel(detailData.session.session_type)
  const sessionDateLabel = formatDateLabel(detailData.session.session_date)
  const dockOutLabel = formatTimeLabel(detailData.session.dock_out_at)
  const durationMinutes = resolveDurationMinutes({
    dockOutAt: detailData.session.dock_out_at,
    dockInAt: detailData.session.dock_in_at,
    fallbackNetTimeMinutes: detailData.session.net_time_minutes,
  })
  const durationLabel = formatDurationLabel(durationMinutes)

  return (
    <>
      <RouteCacheInvalidationOnSuccess
        mutation="camp-detail"
        scope={input.scope}
        campId={detailData.camp.id}
        tabs={["notes"]}
        successStatuses={["info_updated", "setup_updated"]}
      />

      {!input.canManageSession ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Editing and uploads are disabled.
          </p>
        </section>
      ) : null}

      <SessionDetailSummaryCards
        sessionTypeLabel={sessionTypeLabel}
        sessionDateLabel={sessionDateLabel}
        dockOutLabel={dockOutLabel}
        durationLabel={durationLabel}
      />

      <Suspense fallback={<SessionDetailTabsFallback selectedTab={input.selectedTab} />}>
        <SessionDetailTabsSlot
          initialTab={input.selectedTab}
          initialTabDataPromise={selectedTabDataPromise}
          scope={input.scope}
          campId={detailData.camp.id}
          teamVenueId={detailData.camp.team_venue_id}
          sessionId={detailData.session.id}
          sessionType={detailData.session.session_type}
          goals={detailData.session.goals}
          canManageSession={input.canManageSession}
        />
      </Suspense>
    </>
  )
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: SessionDetailParams
  searchParams: SessionDetailSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const selectedTab = resolveTab(getSingleSearchParamValue(resolvedSearchParams.tab))

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
          Session detail requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope

  if (scope.activeTeamId === null) {
    return (
      <div className="space-y-6">
        <SessionsFeedback mode="toast" statusMessage={statusMessage} errorMessage={errorMessage} />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Session operations are team-scoped. Select a team from the scope picker.
          </p>
        </section>
      </div>
    )
  }

  const canManageSession = canManageTeamSessions({
    context,
    organizationId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  })
  const detailDataPromise = getSessionDetailShellData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: scope.activeTeamId,
    sessionId: resolvedParams.id,
  })

  return (
    <div className="space-y-6">
      <SessionsFeedback mode="toast" statusMessage={statusMessage} errorMessage={errorMessage} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team Session</h1>
          </div>

          {canManageSession ? (
            <Suspense
              fallback={<SessionDetailHeaderActionsSkeleton canManageSession={canManageSession} />}
            >
              <SessionHeaderActionsSlot
                canManageSession={canManageSession}
                detailDataPromise={detailDataPromise}
                scope={scope}
              />
            </Suspense>
          ) : null}
        </div>
      </section>

      <Suspense
        fallback={<SessionDetailDeferredContentSkeleton selectedTab={selectedTab} />}
      >
        <SessionDetailResolvedContent
          canManageSession={canManageSession}
          detailDataPromise={detailDataPromise}
          scope={scope}
          selectedTab={selectedTab}
        />
      </Suspense>
    </div>
  )
}
