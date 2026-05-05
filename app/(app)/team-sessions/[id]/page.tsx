import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSessionDetailData } from "@/features/sessions/detail-data"
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

  if (status === "results_updated") {
    return "Session results updated successfully."
  }

  if (status === "setup_updated") {
    return "Session setup updated successfully."
  }

  if (status === "asset_uploaded") {
    return "File uploaded successfully."
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

  const detailData = await getSessionDetailData({
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

          <SessionHeaderActions
            sessionId={detailData.session.id}
            scope={scope}
            setupDialogItems={detailData.setupDialogItems}
            sessionType={detailData.session.session_type}
            sessionDate={detailData.session.session_date}
            dockOutAt={detailData.session.dock_out_at}
            dockInAt={detailData.session.dock_in_at}
            netTimeMinutes={detailData.session.net_time_minutes}
            canManageSession={canManageSession}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Date</CardDescription>
              <CardTitle className="text-xl font-semibold">{sessionDateLabel}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Session calendar date</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Start Time</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_out_at)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">UTC</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>End Time</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_in_at)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">UTC</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total duration</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatDurationLabel(durationMinutes)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Computed from start/end when available
            </CardContent>
          </Card>
        </div>
      </section>

      <SessionDetailTabsClient
        initialTab={selectedTab}
        scope={scope}
        sessionId={detailData.session.id}
        sessionType={detailData.session.session_type}
        info={{
          bestOfSession: detailData.info.bestOfSession,
          toWork: detailData.info.toWork,
          standardMoves: detailData.info.standardMoves,
          windPatterns: detailData.info.windPatterns,
          freeNotes: detailData.info.freeNotes,
        }}
        resultNotes={detailData.results.resultNotes}
        images={detailData.images}
        analyticsFiles={detailData.analyticsFiles}
        canManageSession={canManageSession}
      />
    </div>
  )
}
