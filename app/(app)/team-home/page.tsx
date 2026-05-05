import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getTeamCampsPageData,
  type TeamCampListItem,
} from "@/features/camps/data"
import { buildCampDetailHref } from "@/features/camps/navigation"
import {
  getTeamSessionsPageData,
  type TeamSessionListItem,
} from "@/features/sessions/data"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import {
  getTeamHomeKpis,
  getTeamHomeLatestVenues,
  getTeamHomeTeamMembers,
  type TeamHomeKpi,
  type TeamHomeLatestVenueLive,
  type TeamHomeTeamMemberLive,
} from "@/features/team-home/data"
import { buildVenueDetailHref } from "@/features/venues/navigation"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { resolveNavigationScope } from "@/lib/navigation/scope"

type TeamHomeSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

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
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`
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

export default async function TeamHomePage({
  searchParams,
}: {
  searchParams: TeamHomeSearchParams
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
        <h1 className="text-xl font-semibold text-amber-900">Team home unavailable</h1>
        <p className="mt-2 text-sm text-amber-800">
          Team Home requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const activeTeam =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId]?.find(
      (team) => team.id === scope.activeTeamId,
    ) ?? null
  const activeTeamName = activeTeam?.name ?? "No team selected"
  const teamSessionsHref = buildScopedHref("/team-sessions", scope)
  const teamCampsHref = buildScopedHref("/team-camps", scope)
  const teamVenuesHref = buildScopedHref("/team-venues", scope)
  const latestSessions: TeamSessionListItem[] = []
  const latestCamps: TeamCampListItem[] = []
  const latestVenues: TeamHomeLatestVenueLive[] = []
  const teamMembers: TeamHomeTeamMemberLive[] = []
  const teamKpis: TeamHomeKpi[] = []

  if (scope.activeTeamId !== null) {
    const [sessionsData, campsData, venuesData, teamMembersData, kpisData] = await Promise.all([
      getTeamSessionsPageData({
        activeTeamId: scope.activeTeamId,
        page: 1,
      }),
      getTeamCampsPageData({
        activeTeamId: scope.activeTeamId,
        page: 1,
      }),
      getTeamHomeLatestVenues({
        activeTeamId: scope.activeTeamId,
        limit: 5,
      }),
      getTeamHomeTeamMembers({
        activeTeamId: scope.activeTeamId,
      }),
      getTeamHomeKpis({
        activeTeamId: scope.activeTeamId,
      }),
    ])

    latestSessions.push(...sessionsData.sessions.slice(0, 5))
    latestCamps.push(...campsData.camps.slice(0, 5))
    latestVenues.push(...venuesData)
    teamMembers.push(...teamMembersData)
    teamKpis.push(...kpisData)
  }

  const today = new Date()
  const currentCampIds = new Set(
    latestCamps
      .filter((camp) => isTodayWithinCampDateRange(camp.startDate, camp.endDate, today))
      .map((camp) => camp.id),
  )
  const currentVenueIds = new Set(
    latestCamps
      .filter((camp) => isTodayWithinCampDateRange(camp.startDate, camp.endDate, today))
      .map((camp) => camp.venueId),
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

      {scope.activeTeamId === null ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">No team selected</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are muted until you pick a team from the scope picker.
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {teamKpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{kpi.label}</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {kpi.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {kpi.note}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/70 bg-card/90">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <div className="space-y-1">
                  <CardTitle>Latest Sessions</CardTitle>
                  <CardDescription>Last 5 sessions</CardDescription>
                </div>
                <Link
                  href={teamSessionsHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View All
                </Link>
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
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <div className="space-y-1">
                  <CardTitle>Latest Camps</CardTitle>
                  <CardDescription>Most recent team camps</CardDescription>
                </div>
                <Link
                  href={teamCampsHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View All
                </Link>
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
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <div className="space-y-1">
                  <CardTitle>Latest Venues</CardTitle>
                  <CardDescription>Recently linked to this team</CardDescription>
                </div>
                <Link
                  href={teamVenuesHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View All
                </Link>
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
                            venueId: venue.venueId,
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
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="relative flex h-full flex-col overflow-hidden border-border/70 bg-card/90 lg:col-span-1">
              <CardContent className="relative flex min-h-[18rem] flex-1 p-6">
                <div className="relative z-10 max-w-[62%] space-y-1">
                  <p className="text-5xl font-semibold leading-none tracking-tight">
                    {sailingClassSummary.sailNumber}
                  </p>
                  <p className="text-xl font-light leading-tight text-muted-foreground">
                    {sailingClassSummary.classLabel}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sailingClassSummary.teamLabel}
                  </p>
                </div>

                <div className="pointer-events-none absolute inset-6 flex items-end justify-end">
                  <Image
                    src={sailingClassSummary.logoSrc}
                    alt={`${sailingClassSummary.classLabel} boat`}
                    width={308}
                    height={412}
                    className="h-full w-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 lg:col-span-3">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Coach and crew roster</CardDescription>
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
                              <p className="truncate text-xs text-muted-foreground">
                                {person.roleLabel}
                              </p>
                            </div>
                          </div>

                          <span
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                              className: "pointer-events-none",
                            })}
                          >
                            {badgeLabel}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
