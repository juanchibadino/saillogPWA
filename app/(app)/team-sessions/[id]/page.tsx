import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getSessionDetailShellData,
  getSessionDetailSetupData,
  getSessionDetailTabData,
} from "@/features/sessions/detail-data"
import type {
  SessionDetailSetupData,
  SessionDetailTabPayload,
} from "@/features/sessions/detail-types"
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

function formatSessionDetailTabLabel(tab: SessionDetailTab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1)
}

function SessionHeaderActionsFallback() {
  return (
    <div className="flex items-center gap-2" aria-busy="true">
      <button
        type="button"
        disabled
        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-muted-foreground opacity-70"
      >
        <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />
        <span>Setup</span>
      </button>
      <button
        type="button"
        disabled
        className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-muted-foreground opacity-70"
      >
        Edit
      </button>
    </div>
  )
}

function SessionDetailTabsFallback({
  selectedTab,
}: {
  selectedTab: SessionDetailTab
}) {
  const selectedTabLabel = formatSessionDetailTabLabel(selectedTab)

  return (
    <div className="space-y-4" aria-busy="true">
      <div className="md:hidden">
        <div className="flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {SESSION_DETAIL_TABS.map((tab) => (
            <button
              key={`mobile-tab-loading-${tab}`}
              type="button"
              disabled
              className="inline-flex h-8 min-w-fit items-center justify-center rounded-md px-2 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
              data-active={tab === selectedTab ? "true" : undefined}
            >
              {formatSessionDetailTabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden h-10 items-center gap-1 rounded-lg bg-muted p-1 md:inline-flex">
        {SESSION_DETAIL_TABS.map((tab) => (
          <button
            key={`tab-loading-${tab}`}
            type="button"
            disabled
            className="inline-flex h-8 min-w-fit items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground"
            data-active={tab === selectedTab ? "true" : undefined}
          >
            {formatSessionDetailTabLabel(tab)}
          </button>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">{selectedTabLabel}</h3>
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Loader2Icon
              aria-label={`Loading ${selectedTabLabel}`}
              className="mt-1 size-4 animate-spin text-muted-foreground"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-20 rounded-lg sm:col-span-2" />
          </div>
        </div>
      </section>
    </div>
  )
}

async function SessionHeaderActionsSlot(input: {
  setupDataPromise: Promise<SessionDetailSetupData>
  sessionId: string
  scope: NonNullable<Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]>
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
  canManageSession: boolean
}) {
  const setupData = await input.setupDataPromise

  return (
    <SessionHeaderActions
      sessionId={input.sessionId}
      scope={input.scope}
      setupDialogItems={setupData.setupDialogItems}
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
  initialTab: SessionDetailTab
  initialTabDataPromise: Promise<SessionDetailTabPayload>
  scope: NonNullable<Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]>
  sessionId: string
  sessionType: "training" | "regatta"
  goals: string | null
  canManageSession: boolean
}) {
  const initialTabData = await input.initialTabDataPromise

  return (
    <SessionDetailTabsClient
      initialTab={input.initialTab}
      initialTabData={initialTabData}
      scope={input.scope}
      sessionId={input.sessionId}
      sessionType={input.sessionType}
      goals={input.goals}
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

  const detailData = await getSessionDetailShellData({
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: scope.activeTeamId,
    sessionId: resolvedParams.id,
  })

  if (!detailData) {
    return (
      <div className="space-y-6">
        <SessionsFeedback mode="toast" statusMessage={statusMessage} errorMessage={errorMessage} />
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
  const scopedDetailInput = {
    activeOrganizationId: scope.activeOrgId,
    activeTeamId: detailData.team.id,
    teamVenueId: detailData.camp.team_venue_id,
    sessionId: detailData.session.id,
  }
  const selectedTabDataPromise = getSessionDetailTabData({
    ...scopedDetailInput,
    goals: detailData.session.goals,
    tab: selectedTab,
  })
  const setupDataPromise = canManageSession
    ? getSessionDetailSetupData(scopedDetailInput)
    : Promise.resolve<SessionDetailSetupData>({ setupDialogItems: [] })

  const sessionTypeLabel = formatSessionTypeLabel(detailData.session.session_type)
  const sessionDateLabel = formatDateLabel(detailData.session.session_date)
  const durationMinutes = resolveDurationMinutes({
    dockOutAt: detailData.session.dock_out_at,
    dockInAt: detailData.session.dock_in_at,
    fallbackNetTimeMinutes: detailData.session.net_time_minutes,
  })

  return (
    <div className="space-y-6">
      <SessionsFeedback mode="toast" statusMessage={statusMessage} errorMessage={errorMessage} />

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
            <h1 className="text-2xl font-semibold tracking-tight">Team Session</h1>
          </div>

          {canManageSession ? (
            <Suspense fallback={<SessionHeaderActionsFallback />}>
              <SessionHeaderActionsSlot
                setupDataPromise={setupDataPromise}
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

        <Card className="overflow-hidden p-0 md:hidden">
          <div className="divide-y divide-border px-6 py-3">
            <div className="flex min-h-12 items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="text-right text-sm font-semibold">{sessionTypeLabel}</p>
            </div>

            <div className="flex min-h-12 items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-right text-sm font-semibold">{sessionDateLabel}</p>
            </div>

            <div className="flex min-h-12 items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Dock Out</p>
              <p className="text-right text-sm font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_out_at)}
              </p>
            </div>

            <div className="flex min-h-12 items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-right text-sm font-semibold tabular-nums">
                {formatDurationLabel(durationMinutes)}
              </p>
            </div>
          </div>
        </Card>

        <div className="hidden gap-4 md:grid md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Type</CardDescription>
              <CardTitle className="text-xl font-semibold">{sessionTypeLabel}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Date</CardDescription>
              <CardTitle className="text-xl font-semibold">{sessionDateLabel}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Dock Out</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatTimeLabel(detailData.session.dock_out_at)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Duration</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {formatDurationLabel(durationMinutes)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <Suspense fallback={<SessionDetailTabsFallback selectedTab={selectedTab} />}>
        <SessionDetailTabsSlot
          initialTab={selectedTab}
          initialTabDataPromise={selectedTabDataPromise}
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
