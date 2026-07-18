import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GradientCard } from "@/components/shared/gradient-card"
import { FreeTierQuotaDialog } from "@/features/billing/free-tier-quota-dialog"
import { buildCampDetailHref } from "@/features/camps/navigation"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import {
  getTeamHomeKpis,
  getTeamHomeLatestCamps,
  getTeamHomeLatestSessions,
  getTeamHomeLatestVenues,
  getTeamHomeTeamMembers,
  type TeamHomeKpi,
  type TeamHomeLatestCampLive,
  type TeamHomeLatestSessionLive,
  type TeamHomeLatestVenueLive,
  type TeamHomeTeamMemberLive,
} from "@/features/team-home/data"
import { TeamHomeFeedback } from "@/features/team-home/team-home-feedback"
import type { TeamCrewListItem } from "@/features/users/data"
import {
  CreateCrewMemberDialog,
  CrewActionsMenu,
} from "@/features/users/user-form-dialogs"
import {
  formatTeamHomeTimingError,
  logTeamHomeTiming,
  startTeamHomeTiming,
  type TeamHomeTimingMetadata,
  type TeamHomeTimingPhase,
} from "@/features/team-home/timing"
import { buildVenueDetailHref } from "@/features/venues/navigation"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageOrganizationOperations,
  canManageTeamStructure,
} from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"
import type { NavigationScope } from "@/lib/navigation/types"

type TeamHomeSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

type TeamHomeDataTimingPhase = Exclude<TeamHomeTimingPhase, "scope">
type ActiveTeamHomeScope = Omit<NavigationScope, "activeTeamId"> & {
  activeTeamId: string
}
type TeamHomeDateParts = {
  day: number
  month: string
  year: number
}

const TEAM_HOME_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
})

const TEAM_HOME_KPI_SKELETON_LABELS = [
  "Total Camps",
  "Total Sessions",
  "Avg. Session",
  "Net Time Sailed",
] as const

function toUtcDayValue(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isTodayWithinCampDateRange(
  startDate: string,
  endDate: string,
  today: Date,
): boolean {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false
  }

  const todayValue = toUtcDayValue(today)
  const rangeStartValue = toUtcDayValue(start)
  const rangeEndValue = toUtcDayValue(end)

  return todayValue >= rangeStartValue && todayValue <= rangeEndValue
}

function CurrentBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <span className="size-2 rounded-full bg-emerald-500" />
      Current
    </span>
  )
}

type TeamMemberBadgeLabel = "Team Admin" | "Coach" | "Crew"

function TeamHomeHeaderViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={buttonVariants({
        variant: "outline",
        size: "sm",
        className: "!hidden md:!inline-flex",
      })}
    >
      View All
    </Link>
  )
}

function TeamHomeMobileViewAllFooter({ href }: { href: string }) {
  return (
    <CardFooter className="pt-0 md:hidden">
      <Link
        href={href}
        className={buttonVariants({
          variant: "outline",
          size: "default",
          className: "!h-11 w-full",
        })}
      >
        View All
      </Link>
    </CardFooter>
  )
}

function TeamHomeRoleBadge({ label }: { label: TeamMemberBadgeLabel }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground">
      {label}
    </span>
  )
}

function TeamHomeInvitedBadge({ firstSeenAt }: { firstSeenAt: string | null }) {
  if (firstSeenAt) {
    return null
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground">
      Invited
    </span>
  )
}

function resolveTeamMemberBadgeLabel(
  role: TeamHomeTeamMemberLive["role"],
): TeamMemberBadgeLabel {
  if (role === "team_admin") {
    return "Team Admin"
  }

  if (role === "coach") {
    return "Coach"
  }

  return "Crew"
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return "SU"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

function buildTeamHomeCrewActionItem(input: {
  activeTeamName: string
  member: TeamHomeTeamMemberLive
}): TeamCrewListItem {
  return {
    membershipKind: "team",
    membershipId: input.member.membershipId,
    profileId: input.member.profileId,
    firstName: input.member.firstName,
    lastName: input.member.lastName,
    email: input.member.email,
    fullName: input.member.fullName,
    avatarUrl: input.member.avatarUrl,
    firstSeenAt: input.member.firstSeenAt,
    teamId: input.member.teamId,
    teamName: input.activeTeamName,
    linkedTeams: [
      {
        id: input.member.teamId,
        name: input.activeTeamName,
        role: input.member.role,
      },
    ],
    role: input.member.role,
  }
}

function buildScopedHref(
  path: string,
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  },
): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }

  const query = params.toString()
  return query.length > 0 ? `${path}?${query}` : path
}

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function getTeamHomeDateParts(value: string): TeamHomeDateParts | null {
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return {
    day: date.getUTCDate(),
    month: TEAM_HOME_MONTH_FORMATTER.format(date),
    year: date.getUTCFullYear(),
  }
}

function formatTimestampDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(value))
}

function formatCampDateRangeLabel(startDate: string, endDate: string): string {
  const start = getTeamHomeDateParts(startDate)
  const end = getTeamHomeDateParts(endDate)

  if (!start || !end) {
    return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`
  }

  if (
    start.year === end.year &&
    start.month === end.month &&
    start.day === end.day
  ) {
    return `${start.month} ${start.day} / ${start.year}`
  }

  if (start.year === end.year && start.month === end.month) {
    return `${start.month} ${start.day}-${end.day} / ${start.year}`
  }

  if (start.year === end.year) {
    return `${start.month} ${start.day} - ${end.month} ${end.day} / ${start.year}`
  }

  return `${start.month} ${start.day} / ${start.year} - ${end.month} ${end.day} / ${end.year}`
}

function formatSessionTypeLabel(value: "training" | "regatta"): "Training" | "Regatta" {
  return value === "training" ? "Training" : "Regatta"
}

function formatDurationLabel(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`
}

function getTeamHomeErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted member data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to invite members to this team."
  }

  if (error === "member_exists") {
    return "This member already has the selected access."
  }

  if (error === "create_failed") {
    return "Could not create member access. Confirm the email and permissions, then try again."
  }

  if (error === "invite_email_failed") {
    return "Access was created, but the invite email could not be sent."
  }

  if (error === "unlink_failed") {
    return "Could not unlink member from this team. Confirm your permissions and try again."
  }

  if (error === "unlink_blocked_last_access") {
    return "Unlink would leave this user without app access. Delete the user instead if you want to remove their account."
  }

  if (error === "delete_failed") {
    return "Could not delete user. Confirm your permissions and try again."
  }

  if (error === "delete_blocked_linked_elsewhere") {
    return "This user has active access outside this organization. Remove those links before deleting the user."
  }

  if (error === "plan_limit_reached") {
    return null
  }

  if (error === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue."
  }

  return null
}

function getTeamHomeStatusMessage(status: string | undefined): string | null {
  if (status === "invited") {
    return "Invite created successfully."
  }

  if (status === "unlinked") {
    return "Member unlinked from team."
  }

  if (status === "deleted") {
    return "User deleted successfully."
  }

  return null
}

function loadTeamHomeSection<T>(
  input: {
    activeTeamId: string
    getMetadata?: (result: T) => TeamHomeTimingMetadata
    metadata?: TeamHomeTimingMetadata
    phase: TeamHomeDataTimingPhase
  },
  load: () => Promise<T>,
): Promise<T> {
  const startedAt = startTeamHomeTiming()

  return load().then(
    (result) => {
      const resultMetadata = input.getMetadata?.(result)

      logTeamHomeTiming({
        activeTeamId: input.activeTeamId,
        metadata: {
          ...input.metadata,
          ...resultMetadata,
        },
        phase: input.phase,
        startedAt,
        status: "success",
      })

      return result
    },
    (error: unknown) => {
      logTeamHomeTiming({
        activeTeamId: input.activeTeamId,
        error: formatTeamHomeTimingError(error),
        metadata: input.metadata,
        phase: input.phase,
        startedAt,
        status: "error",
      })

      throw error
    },
  )
}

function getCurrentCampIds(
  camps: TeamHomeLatestCampLive[],
  today: Date,
): Set<string> {
  return new Set(
    camps
      .filter((camp) => isTodayWithinCampDateRange(camp.startDate, camp.endDate, today))
      .map((camp) => camp.id),
  )
}

function getCurrentVenueIds(
  camps: TeamHomeLatestCampLive[],
  today: Date,
): Set<string> {
  return new Set(
    camps
      .filter((camp) => isTodayWithinCampDateRange(camp.startDate, camp.endDate, today))
      .map((camp) => camp.venueId),
  )
}

function TeamHomeKpiCardsSkeleton() {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {TEAM_HOME_KPI_SKELETON_LABELS.map((label) => (
            <div
              key={`team-home-mobile-kpi-section-skeleton-${label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {TEAM_HOME_KPI_SKELETON_LABELS.map((label) => (
          <GradientCard key={`team-home-desktop-kpi-section-skeleton-${label}`}>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-8 w-20" />
            </CardHeader>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

function TeamHomeListCardSkeleton({
  descriptionWidthClassName = "w-32",
  rowCount = 3,
  titleWidthClassName = "w-36",
}: {
  descriptionWidthClassName?: string
  rowCount?: number
  titleWidthClassName?: string
}) {
  return (
    <GradientCard>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <div className="space-y-2">
          <Skeleton className={`h-5 ${titleWidthClassName}`} />
          <Skeleton className={`h-4 ${descriptionWidthClassName}`} />
        </div>
        <Skeleton className="hidden h-7 w-16 md:block" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {Array.from({ length: rowCount }).map((_, index) => (
            <div
              key={`team-home-list-section-skeleton-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
            >
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-full max-w-40" />
                <Skeleton className="h-3 w-full max-w-28" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0 md:hidden">
        <Skeleton className="h-11 w-full" />
      </CardFooter>
    </GradientCard>
  )
}

function TeamHomeLatestActivitySkeleton() {
  return (
    <>
      <TeamHomeListCardSkeleton
        descriptionWidthClassName="w-28"
        titleWidthClassName="w-32"
      />
      <TeamHomeListCardSkeleton
        descriptionWidthClassName="w-40"
        titleWidthClassName="w-28"
      />
    </>
  )
}

function TeamHomeLatestVenuesSkeleton() {
  return (
    <TeamHomeListCardSkeleton
      descriptionWidthClassName="w-44"
      titleWidthClassName="w-32"
    />
  )
}

function TeamHomeRosterSkeleton() {
  return (
    <GradientCard className="lg:col-span-3">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`team-home-roster-section-skeleton-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </GradientCard>
  )
}

async function TeamHomeKpiCards({
  kpisPromise,
}: {
  kpisPromise: Promise<TeamHomeKpi[]>
}) {
  const teamKpis = await kpisPromise

  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {teamKpis.map((kpi) => (
            <div
              key={`mobile-team-home-kpi-${kpi.label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-right text-sm font-semibold tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {teamKpis.map((kpi) => (
          <GradientCard key={`desktop-team-home-kpi-${kpi.label}`}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {kpi.value}
              </CardTitle>
            </CardHeader>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

async function TeamHomeLatestActivitySection({
  latestCampsPromise,
  latestSessionsPromise,
  scope,
  teamCampsHref,
  teamSessionsHref,
}: {
  latestCampsPromise: Promise<TeamHomeLatestCampLive[]>
  latestSessionsPromise: Promise<TeamHomeLatestSessionLive[]>
  scope: ActiveTeamHomeScope
  teamCampsHref: string
  teamSessionsHref: string
}) {
  const [latestSessions, latestCamps] = await Promise.all([
    latestSessionsPromise,
    latestCampsPromise,
  ])
  const currentCampIds = getCurrentCampIds(latestCamps, new Date())

  return (
    <>
      <GradientCard>
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <div className="space-y-1">
            <CardTitle>Latest Sessions</CardTitle>
            <CardDescription>Last 5 sessions</CardDescription>
          </div>
          <TeamHomeHeaderViewAllLink href={teamSessionsHref} />
        </CardHeader>
        <CardContent className="pt-0">
          {latestSessions.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No sessions found for this team.</p>
          ) : (
            <ul className="divide-y divide-border">
              {latestSessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={buildSessionDetailHref({
                      scope,
                      sessionId: session.id,
                    })}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)_auto] items-center gap-3 rounded-md -mx-2 px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium underline-offset-4 hover:underline">
                        {formatDateLabel(session.sessionDate)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{session.campName}</p>
                    </div>

                    <p className="justify-self-center text-center text-xs font-medium text-muted-foreground md:text-sm">
                      {formatSessionTypeLabel(session.sessionType)}
                    </p>

                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatDurationLabel(session.netTimeMinutes)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <TeamHomeMobileViewAllFooter href={teamSessionsHref} />
      </GradientCard>

      <GradientCard>
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <div className="space-y-1">
            <CardTitle>Latest Camps</CardTitle>
            <CardDescription>Most recent team camps</CardDescription>
          </div>
          <TeamHomeHeaderViewAllLink href={teamCampsHref} />
        </CardHeader>
        <CardContent className="pt-0">
          {latestCamps.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No camps found for this team.</p>
          ) : (
            <ul className="divide-y divide-border">
              {latestCamps.map((camp) => (
                <li key={camp.id}>
                  <Link
                    href={buildCampDetailHref({
                      scope,
                      campId: camp.id,
                      tab: "sessions",
                    })}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md -mx-2 px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium underline-offset-4 hover:underline">
                          {camp.name}
                        </p>
                        {currentCampIds.has(camp.id) ? <CurrentBadge /> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {camp.venueName}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs text-muted-foreground md:text-sm">
                      {formatCampDateRangeLabel(camp.startDate, camp.endDate)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <TeamHomeMobileViewAllFooter href={teamCampsHref} />
      </GradientCard>
    </>
  )
}

async function TeamHomeLatestVenuesSection({
  latestCampsPromise,
  latestVenuesPromise,
  scope,
  teamVenuesHref,
}: {
  latestCampsPromise: Promise<TeamHomeLatestCampLive[]>
  latestVenuesPromise: Promise<TeamHomeLatestVenueLive[]>
  scope: ActiveTeamHomeScope
  teamVenuesHref: string
}) {
  const [latestVenues, latestCamps] = await Promise.all([
    latestVenuesPromise,
    latestCampsPromise,
  ])
  const currentVenueIds = getCurrentVenueIds(latestCamps, new Date())

  return (
    <GradientCard>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <div className="space-y-1">
          <CardTitle>Latest Venues</CardTitle>
          <CardDescription>Recently linked to this team</CardDescription>
        </div>
        <TeamHomeHeaderViewAllLink href={teamVenuesHref} />
      </CardHeader>
      <CardContent className="pt-0">
        {latestVenues.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No venues linked to this team yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {latestVenues.map((venue) => (
              <li key={venue.teamVenueId}>
                <Link
                  href={buildVenueDetailHref({
                    scope,
                    teamVenueId: venue.teamVenueId,
                  })}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md -mx-2 px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium underline-offset-4 hover:underline">
                        {venue.name}
                      </p>
                      {currentVenueIds.has(venue.venueId) ? <CurrentBadge /> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {venue.location}
                    </p>
                  </div>

                  <p className="shrink-0 text-xs text-muted-foreground md:text-sm">
                    {`Linked ${formatTimestampDateLabel(venue.linkedAt)}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <TeamHomeMobileViewAllFooter href={teamVenuesHref} />
    </GradientCard>
  )
}

function TeamHomeSailingClassCard({
  classLabel,
  logoSrc,
  sailNumber,
  teamLabel,
}: {
  classLabel: string
  logoSrc: string
  sailNumber: string
  teamLabel: string
}) {
  return (
    <GradientCard className="relative flex h-full flex-col overflow-hidden lg:col-span-1">
      <CardContent className="relative flex min-h-[18rem] flex-1 p-6">
        <div className="relative z-10 max-w-[62%] space-y-1">
          <p className="text-5xl font-semibold leading-none tracking-tight">
            {sailNumber}
          </p>
          <p className="text-xl font-light leading-tight text-muted-foreground">
            {classLabel}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {teamLabel}
          </p>
        </div>

        <div className="pointer-events-none absolute inset-6 flex items-end justify-end">
          <Image
            src={logoSrc}
            alt={`${classLabel} boat`}
            width={308}
            height={412}
            className="h-full w-auto"
          />
        </div>
      </CardContent>
    </GradientCard>
  )
}

async function TeamHomeRosterSection({
  activeTeamName,
  canInviteMembers,
  canManageMemberActions,
  scope,
  teamMembersPromise,
}: {
  activeTeamName: string
  canInviteMembers: boolean
  canManageMemberActions: boolean
  scope: ActiveTeamHomeScope
  teamMembersPromise: Promise<TeamHomeTeamMemberLive[]>
}) {
  const teamMembers = await teamMembersPromise
  const teamOptions = [{ id: scope.activeTeamId, name: activeTeamName }]

  return (
    <GradientCard className="lg:col-span-3">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Coach and crew roster</CardDescription>
        </div>
        {canInviteMembers ? (
          <>
            <div className="hidden shrink-0 md:block">
              <CreateCrewMemberDialog
                allowedInviteTargets="team"
                disabled={false}
                redirectTo="/team-home"
                scope={scope}
                selectedTeamId={scope.activeTeamId}
                surface="sheet"
                teamOptions={teamOptions}
              />
            </div>
          </>
        ) : null}
      </CardHeader>
      <CardContent>
        {teamMembers.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No active team members found for this team.
          </p>
        ) : (
          <ul className="space-y-2">
            {teamMembers.map((person) => {
              const badgeLabel = resolveTeamMemberBadgeLabel(person.role)
              const crewActionItem = buildTeamHomeCrewActionItem({
                activeTeamName,
                member: person,
              })

              return (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-lg p-1"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9">
                      {person.avatarUrl ? (
                        <AvatarImage src={person.avatarUrl} alt={person.name} />
                      ) : null}
                      <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {person.roleLabel}
                        </p>
                        <TeamHomeInvitedBadge firstSeenAt={person.firstSeenAt} />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <TeamHomeRoleBadge label={badgeLabel} />
                    {canManageMemberActions ? (
                      <CrewActionsMenu
                        crew={crewActionItem}
                        redirectTo="/team-home"
                        scope={scope}
                        selectedTeamId={scope.activeTeamId}
                        showEdit={false}
                        surface="drawer"
                        teamOptions={teamOptions}
                        triggerClassName="h-11 w-11"
                        unlinkLabel="Unlink"
                      />
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      {canInviteMembers ? (
        <CardFooter className="md:hidden">
          <CreateCrewMemberDialog
            allowedInviteTargets="team"
            disabled={false}
            redirectTo="/team-home"
            scope={scope}
            selectedTeamId={scope.activeTeamId}
            surface="drawer"
            teamOptions={teamOptions}
            triggerClassName="w-full"
          />
        </CardFooter>
      ) : null}
    </GradientCard>
  )
}

export default async function TeamHomePage({
  searchParams,
}: {
  searchParams: TeamHomeSearchParams
}) {
  const scopeStartedAt = startTeamHomeTiming()
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const teamHomeStatusMessage = getTeamHomeStatusMessage(status)
  const teamHomeErrorMessage = getTeamHomeErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  logTeamHomeTiming({
    activeOrgId: navigation.scope?.activeOrgId ?? null,
    activeTeamId: navigation.scope?.activeTeamId ?? null,
    metadata: {
      hasActiveTeam: Boolean(navigation.scope?.activeTeamId),
      hasScope: Boolean(navigation.scope),
    },
    phase: "scope",
    startedAt: scopeStartedAt,
    status: "success",
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">Team home unavailable</h1>
        <p className="mt-2 text-sm text-amber-800">
          Team Home requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const statusMessage = teamHomeStatusMessage
  const errorMessage = teamHomeErrorMessage

  if (scope.activeTeamId === null) {
    return (
      <div className="space-y-6">
        <TeamHomeFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
        <FreeTierQuotaDialog organizationId={scope.activeOrgId} />

        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">No team selected</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are muted until you pick a team from the scope picker.
          </p>
        </section>
      </div>
    )
  }

  const activeTeamScope: ActiveTeamHomeScope = {
    ...scope,
    activeTeamId: scope.activeTeamId,
  }
  const activeTeam =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId]?.find(
      (team) => team.id === scope.activeTeamId,
    ) ?? null
  const activeTeamName = activeTeam?.name ?? "No team selected"
  const activeTeamId = activeTeamScope.activeTeamId
  const canInviteTeamMembers = canManageTeamStructure({
    context,
    organizationId: scope.activeOrgId,
    teamId: activeTeamId,
  })
  const canManageTeamMemberActions = canManageOrganizationOperations(
    context,
    scope.activeOrgId,
  )
  const teamSessionsHref = buildScopedHref("/team-sessions", activeTeamScope)
  const teamCampsHref = buildScopedHref("/team-camps", activeTeamScope)
  const teamVenuesHref = buildScopedHref("/team-venues", activeTeamScope)
  const latestSessionsPromise = loadTeamHomeSection(
    {
      activeTeamId,
      getMetadata: (data) => ({
        returnedItems: data.length,
      }),
      metadata: {
        limit: 5,
      },
      phase: "latest_sessions",
    },
    () =>
      getTeamHomeLatestSessions({
        activeTeamId,
        limit: 5,
      }),
  )
  const latestCampsPromise = loadTeamHomeSection(
    {
      activeTeamId,
      getMetadata: (data) => ({
        returnedItems: data.length,
      }),
      metadata: {
        limit: 5,
      },
      phase: "latest_camps",
    },
    () =>
      getTeamHomeLatestCamps({
        activeTeamId,
        limit: 5,
      }),
  )
  const latestVenuesPromise = loadTeamHomeSection(
    {
      activeTeamId,
      getMetadata: (data) => ({
        returnedItems: data.length,
      }),
      metadata: {
        limit: 5,
      },
      phase: "latest_venues",
    },
    () =>
      getTeamHomeLatestVenues({
        activeTeamId,
        limit: 5,
      }),
  )
  const teamMembersPromise = loadTeamHomeSection(
    {
      activeTeamId,
      getMetadata: (data) => ({
        returnedItems: data.length,
      }),
      phase: "team_members",
    },
    () =>
      getTeamHomeTeamMembers({
        activeTeamId,
      }),
  )
  const kpisPromise = loadTeamHomeSection(
    {
      activeTeamId,
      getMetadata: (data) => ({
        kpiCount: data.length,
      }),
      phase: "kpis",
    },
    () =>
      getTeamHomeKpis({
        activeTeamId,
      }),
  )
  // Temporary static class card until the sailing classes table is wired to teams.
  const sailingClassSummary = {
    sailNumber: "USA31",
    teamLabel: activeTeamName,
    classLabel: "49er class",
    logoSrc: "/Black_49er.svg",
  }

  return (
    <div className="space-y-6">
      <TeamHomeFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
      <FreeTierQuotaDialog organizationId={scope.activeOrgId} teamId={activeTeamId} />

      <Suspense fallback={<TeamHomeKpiCardsSkeleton />}>
        <TeamHomeKpiCards kpisPromise={kpisPromise} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<TeamHomeLatestActivitySkeleton />}>
          <TeamHomeLatestActivitySection
            latestCampsPromise={latestCampsPromise}
            latestSessionsPromise={latestSessionsPromise}
            scope={activeTeamScope}
            teamCampsHref={teamCampsHref}
            teamSessionsHref={teamSessionsHref}
          />
        </Suspense>

        <Suspense fallback={<TeamHomeLatestVenuesSkeleton />}>
          <TeamHomeLatestVenuesSection
            latestCampsPromise={latestCampsPromise}
            latestVenuesPromise={latestVenuesPromise}
            scope={activeTeamScope}
            teamVenuesHref={teamVenuesHref}
          />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <TeamHomeSailingClassCard
          classLabel={sailingClassSummary.classLabel}
          logoSrc={sailingClassSummary.logoSrc}
          sailNumber={sailingClassSummary.sailNumber}
          teamLabel={sailingClassSummary.teamLabel}
        />

        <Suspense fallback={<TeamHomeRosterSkeleton />}>
          <TeamHomeRosterSection
            activeTeamName={activeTeamName}
            canInviteMembers={canInviteTeamMembers}
            canManageMemberActions={canManageTeamMemberActions}
            scope={activeTeamScope}
            teamMembersPromise={teamMembersPromise}
          />
        </Suspense>
      </div>
    </div>
  )
}
