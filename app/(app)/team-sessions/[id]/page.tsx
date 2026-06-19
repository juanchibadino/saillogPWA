import { Suspense } from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getSessionDetailDeferredData,
  getSessionDetailShellData,
  type SessionDetailDeferredData,
} from "@/features/sessions/detail-data"
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

function resolveTab(value: string | undefined): SessionDetailTab {
  if (!value) {
    return "info"
  }

  return SESSION_DETAIL_TABS.includes(value as SessionDetailTab)
    ? (value as SessionDetailTab)
    : "info"
}

function getStatusMessage(status: string | undefined): string | null {
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
    hour12: false,
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

function SessionHeaderActionsFallback() {
  return <div className="h-8 w-36 rounded-lg bg-muted" />
}

function SessionDetailTabsFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-80 max-w-full rounded-lg bg-muted" />
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-72 max-w-full rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
          </div>
        </div>
      </section>
    </div>
  )
}

async function SessionHeaderActionsSlot(input: {
  deferredDataPromise: Promise<SessionDetailDeferredData>
  sessionId: string
  scope: NonNullable<Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]>
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
  canManageSession: boolean
}) {
  const deferredData = await input.deferredDataPromise

  return (
    <SessionHeaderActions
      sessionId={input.sessionId}
      scope={input.scope}
      setupDialogItems={deferredData.setupDialogItems}
      sessionType={input.sessionType}
      sessionDate={input.sessionDate}
      dockOutAt={input.dockOutAt}
      dockInAt={input.dockInAt}
      netTimeMinutes={input.netTimeMinutes}
      canManageSession={input.canManageSession}
    />
  )
}

async function SessionDetailTabsSlot(input: {
  deferredDataPromise: Promise<SessionDetailDeferredData>
  initialTab: SessionDetailTab
  scope: NonNullable<Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]>
  sessionId: string
  sessionType: "training" | "regatta"
  goals: string | null
  canManageSession: boolean
}) {
  const deferredData = await input.deferredDataPromise

  return (
    <SessionDetailTabsClient
      initialTab={input.initialTab}
      scope={input.scope}
      sessionId={input.sessionId}
      sessionType={input.sessionType}
      info={{
        bestOfSession: deferredData.info.bestOfSession,
        toWork: deferredData.info.toWork,
        standardMoves: deferredData.info.standardMoves,
        windPatterns: deferredData.info.windPatterns,
        freeNotes: deferredData.info.freeNotes,
      }}
      goals={input.goals}
      availableStandardMoves={deferredData.availableStandardMoves}
      linkedStandardMoveIds={deferredData.linkedStandardMoveIds}
      resultNotes={deferredData.results.resultNotes}
      images={deferredData.images}
      analyticsFiles={deferredData.analyticsFiles}
      gearItems={deferredData.gearItems}
      linkedGearItemIds={deferredData.linkedGearItemIds}
      canManageSession={input.canManageSession}
    />
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
        <SessionsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Session operations are team-scoped. Select a team from the scope picker.
          </p>
        </section>
      </div>
    )
  }

  const detailData = await getSessionDetailShellData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: scope.activeTeamId,
    sessionId: resolvedParams.id,
  })

  if (!detailData) {
    return (
      <div className="space-y-6">
        <SessionsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Session unavailable</h2>
          <p className="mt-2 text-sm text-amber-800">
            This session does not exist in the active team scope or is not accessible.
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
  const deferredDataPromise = getSessionDetailDeferredData({
    activeTeamId: detailData.team.id,
    sessionId: detailData.session.id,
  })

  const sessionTypeLabel = formatSessionTypeLabel(detailData.session.session_type)
  const sessionDateLabel = formatDateLabel(detailData.session.session_date)
  const durationMinutes = resolveDurationMinutes({
    dockOutAt: detailData.session.dock_out_at,
    dockInAt: detailData.session.dock_in_at,
    fallbackNetTimeMinutes: detailData.session.net_time_minutes,
  })

  return (
    <div className="space-y-6">
      <SessionsFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {!canManageSession ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Editing and uploads are disabled.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{sessionTypeLabel}</h1>
          </div>

          {canManageSession ? (
            <Suspense fallback={<SessionHeaderActionsFallback />}>
              <SessionHeaderActionsSlot
                deferredDataPromise={deferredDataPromise}
                sessionId={detailData.session.id}
                scope={scope}
                sessionType={detailData.session.session_type}
                sessionDate={detailData.session.session_date}
                dockOutAt={detailData.session.dock_out_at}
                dockInAt={detailData.session.dock_in_at}
                netTimeMinutes={detailData.session.net_time_minutes}
                canManageSession={canManageSession}
              />
            </Suspense>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Date</CardDescription>
              <CardTitle className="text-xl font-semibold">{sessionDateLabel}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Start Time</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_out_at)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>End Time</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_in_at)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Total duration</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatDurationLabel(durationMinutes)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <Suspense fallback={<SessionDetailTabsFallback />}>
        <SessionDetailTabsSlot
          deferredDataPromise={deferredDataPromise}
          initialTab={selectedTab}
          scope={scope}
          sessionId={detailData.session.id}
          sessionType={detailData.session.session_type}
          goals={detailData.session.goals}
          canManageSession={canManageSession}
        />
      </Suspense>
    </div>
  )
}
