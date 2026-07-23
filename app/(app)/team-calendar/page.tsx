import { Suspense } from "react"

import {
  TeamCalendarPageSkeleton,
  TeamCalendarResultsSkeleton,
} from "@/components/shared/page-skeletons"
import { CalendarFeedback } from "@/features/calendar/calendar-feedback"
import {
  getEmptyTeamCalendarChromeData,
  getTeamCalendarChromeData,
  getTeamCalendarResultsData,
  type TeamCalendarChromeData,
  type TeamCalendarResultsData,
  type TeamCalendarTimeFilter,
} from "@/features/calendar/data"
import { canEditCalendarPresence } from "@/features/calendar/action-rules.mjs"
import {
  getTeamCalendarFeedState,
  type TeamCalendarFeedState,
} from "@/features/calendar/feed-data"
import { resolveTeamCalendarListRequest } from "@/features/calendar/list-route-state.mjs"
import { TeamCalendarResultsClient } from "@/features/calendar/team-calendar-results-client"
import { TeamCalendarRouteShell } from "@/features/calendar/team-calendar-route-shell"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions, canManageTeamStructure } from "@/lib/auth/capabilities"
import { resolveCurrentRequestOrigin } from "@/lib/http/request-origin"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamCalendarSearchParams = Promise<
  Record<string, string | string[] | undefined>
>
type ResolvedTeamCalendarScope = NonNullable<
  Awaited<ReturnType<typeof resolveNavigationScope>>["scope"]
>
type TeamCalendarChromeDataPromise = Promise<TeamCalendarChromeData>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "event_created") {
    return "Event created successfully."
  }

  if (status === "event_updated") {
    return "Event updated successfully."
  }

  if (status === "event_deleted") {
    return "Event deleted successfully."
  }

  if (status === "feed_ready") {
    return "Calendar subscription link is ready."
  }

  if (status === "feed_rotated") {
    return "Calendar subscription link regenerated."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted calendar data is invalid. Review it and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to change that calendar item."
  }

  if (error === "event_create_failed") {
    return "Could not create event. Confirm your permissions and try again."
  }

  if (error === "event_update_failed") {
    return "Could not update event. Confirm your permissions and try again."
  }

  if (error === "event_delete_failed") {
    return "Could not delete event. Confirm your permissions and try again."
  }

  if (error === "presence_update_failed") {
    return "Could not update presence. Confirm your permissions and try again."
  }

  if (error === "feed_forbidden") {
    return "You do not have permission to manage the calendar export link."
  }

  if (error === "feed_generate_failed") {
    return "Could not generate the calendar export link. Try again."
  }

  if (error === "feed_rotate_failed") {
    return "Could not regenerate the calendar export link. Try again."
  }

  return null
}

function getEmptyCalendarResultsData(): TeamCalendarResultsData {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return {
    items: [],
    today: `${year}-${month}-${day}`,
  }
}

function resolveCanEditTargetPresence(input: {
  canManageAnyPresence: boolean
  chromeData: TeamCalendarChromeData
  currentProfileId: string
}): boolean {
  return canEditCalendarPresence({
    currentProfileId: input.currentProfileId,
    targetProfileId: input.chromeData.targetMember?.id ?? null,
    canManageAnyPresence: input.canManageAnyPresence,
  }) as boolean
}

async function TeamCalendarShellSlot(input: {
  activeTeamId: string | null
  calendarFeedState: TeamCalendarFeedState
  canManageAnyPresence: boolean
  canManageCustomEvents: boolean
  chromeDataPromise: TeamCalendarChromeDataPromise
  currentProfileId: string
  noTeamSelected: boolean
  scope: ResolvedTeamCalendarScope
}) {
  const chromeData = await input.chromeDataPromise
  const canEditTargetPresence = resolveCanEditTargetPresence({
    canManageAnyPresence: input.canManageAnyPresence,
    chromeData,
    currentProfileId: input.currentProfileId,
  })

  return (
    <TeamCalendarRouteShell
      calendarFeedState={input.calendarFeedState}
      canManageCustomEvents={input.canManageCustomEvents}
      chromeData={chromeData}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    >
      <Suspense fallback={<TeamCalendarResultsSkeleton />}>
        <TeamCalendarResultsContent
          activeTeamId={input.activeTeamId}
          canEditTargetPresence={canEditTargetPresence}
          canManageCustomEvents={input.canManageCustomEvents}
          chromeData={chromeData}
          noTeamSelected={input.noTeamSelected}
          scope={input.scope}
        />
      </Suspense>
    </TeamCalendarRouteShell>
  )
}

async function TeamCalendarResultsContent(input: {
  activeTeamId: string | null
  canEditTargetPresence: boolean
  canManageCustomEvents: boolean
  chromeData: TeamCalendarChromeData
  noTeamSelected: boolean
  scope: ResolvedTeamCalendarScope
}) {
  const resultsData = input.activeTeamId
    ? await getTeamCalendarResultsData({
        activeTeamId: input.activeTeamId,
        chromeData: input.chromeData,
      })
    : getEmptyCalendarResultsData()

  return (
    <TeamCalendarResultsClient
      canEditTargetPresence={input.canEditTargetPresence}
      canManageCustomEvents={input.canManageCustomEvents}
      chromeData={input.chromeData}
      initialResultsData={resultsData}
      noTeamSelected={input.noTeamSelected}
      scope={input.scope}
    />
  )
}

export default async function TeamCalendarPage({
  searchParams,
}: {
  searchParams: TeamCalendarSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const currentProfileId = context.profile?.id ?? context.user.id
  const resolvedSearchParams = await searchParams
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const calendarListRequest = resolveTeamCalendarListRequest({
    eventParam: getSingleSearchParamValue(resolvedSearchParams.event),
    memberParam: getSingleSearchParamValue(resolvedSearchParams.member),
    timeParam: getSingleSearchParamValue(resolvedSearchParams.time),
  })
  const requestedEventFilter = calendarListRequest.requestedEventFilter
  const requestedMemberId = calendarListRequest.requestedMemberId
  const requestedTimeFilter =
    calendarListRequest.requestedTimeFilter as TeamCalendarTimeFilter
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
          Team calendar unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId
  const canManageCustomEvents =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const canManageAnyPresence =
    activeTeamId !== null &&
    canManageTeamStructure({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })
  const chromeDataPromise: TeamCalendarChromeDataPromise = activeTeamId
    ? getTeamCalendarChromeData({
        activeTeamId,
        currentProfileId,
        requestedEventFilterValue: requestedEventFilter?.value,
        requestedMemberId,
        requestedTimeFilter,
      })
    : Promise.resolve(
        getEmptyTeamCalendarChromeData({
          requestedEventFilterValue: requestedEventFilter?.value,
          requestedMemberId,
          requestedTimeFilter,
        }),
      )
  const calendarFeedState =
    activeTeamId && canManageCustomEvents
      ? await getTeamCalendarFeedState({
          origin: await resolveCurrentRequestOrigin(),
          teamId: activeTeamId,
        })
      : {
          createdAt: null,
          downloadUrl: null,
          feedUrl: null,
          updatedAt: null,
        }

  return (
    <div className="space-y-6">
      <CalendarFeedback
        statusMessage={statusMessage}
        errorMessage={errorMessage}
      />

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

      <Suspense fallback={<TeamCalendarPageSkeleton />}>
        <TeamCalendarShellSlot
          activeTeamId={activeTeamId}
          calendarFeedState={calendarFeedState}
          canManageAnyPresence={canManageAnyPresence}
          canManageCustomEvents={canManageCustomEvents}
          chromeDataPromise={chromeDataPromise}
          currentProfileId={currentProfileId}
          noTeamSelected={noTeamSelected}
          scope={scope}
        />
      </Suspense>
    </div>
  )
}
