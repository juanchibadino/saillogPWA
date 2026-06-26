"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { InstallAppButton } from "@/components/pwa/install-app-button"
import { PwaDebugPanel } from "@/components/pwa/pwa-debug-panel"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { ResolvedNavigationScope } from "@/lib/navigation/types"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type ActiveScope = {
  activeOrgId: string | null
  activeTeamId: string | null
}

type VenueBreadcrumbResponse = {
  name: string | null
}

type SessionBreadcrumbResponse = {
  team_name: string | null
  venue_id: string | null
  venue_name: string | null
  camp_id: string | null
  camp_name: string | null
  session_date: string | null
  dock_out_at: string | null
}

function getSectionTitle(pathname: string): string {
  if (pathname.startsWith("/organizations")) {
    return "Organizations"
  }

  if (pathname.startsWith("/teams")) {
    return "Teams"
  }

  if (pathname.startsWith("/users")) {
    return "Members"
  }

  if (pathname.startsWith("/team-home")) {
    return "Team Home"
  }

  if (pathname.startsWith("/team-camps")) {
    return "Team Camps"
  }

  if (pathname.startsWith("/team-sessions")) {
    return "Team Sessions"
  }

  if (pathname.startsWith("/team-gear")) {
    return "Team Gear"
  }

  if (pathname.startsWith("/team-notes")) {
    return "Team Notes"
  }

  if (pathname.startsWith("/team-standard-moves")) {
    return "Team Std. Moves"
  }

  if (pathname.startsWith("/team-reports")) {
    return "Team Reports"
  }

  if (pathname.startsWith("/team-venues")) {
    return "Team Venues"
  }

  if (pathname.startsWith("/venues")) {
    return "Venues"
  }

  if (pathname.startsWith("/billing")) {
    return "Billing"
  }

  if (pathname.startsWith("/reports")) {
    return "Reports"
  }

  if (pathname.startsWith("/dashboard")) {
    return "Dashboard"
  }

  return "Sailog"
}

function getTeamVenuesTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Venues"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Venues`
}

function getTeamCampsTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Camps"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Camps`
}

function getTeamSessionsTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Sessions"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Sessions`
}

function formatSessionDateTimeLabel(input: {
  sessionDate: string | null | undefined
  dockOutAt: string | null | undefined
}): string | null {
  if (!input.sessionDate) {
    return null
  }

  const date = new Date(`${input.sessionDate}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(date)
  const month = dateParts.find((part) => part.type === "month")?.value
  const day = dateParts.find((part) => part.type === "day")?.value
  const dateLabel = month && day ? `${month} ${day}` : null

  if (!dateLabel) {
    return null
  }

  const fallbackTimeValue = `${input.sessionDate}T00:00:00.000Z`
  const time = new Date(input.dockOutAt ?? fallbackTimeValue)
  const safeTime = Number.isNaN(time.getTime()) ? new Date(fallbackTimeValue) : time

  const timeParts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).formatToParts(safeTime)
  const hour = timeParts.find((part) => part.type === "hour")?.value.padStart(2, "0")
  const minute = timeParts.find((part) => part.type === "minute")?.value
  const dayPeriod = timeParts.find((part) => part.type === "dayPeriod")?.value

  if (!hour || !minute || !dayPeriod) {
    return dateLabel
  }

  return `${dateLabel} ${hour}:${minute} ${dayPeriod.toUpperCase()}`
}

function getSessionDetailTitle(
  sessionBreadcrumb: SessionBreadcrumbResponse | null,
): string {
  return (
    formatSessionDateTimeLabel({
      sessionDate: sessionBreadcrumb?.session_date,
      dockOutAt: sessionBreadcrumb?.dock_out_at,
    }) ?? "Session"
  )
}

function getTeamNotesTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Notes"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Notes`
}

function getTeamStandardMovesTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Std. Moves"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Std. Moves`
}

function getTeamGearTitle(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): string {
  if (!navigation?.scope) {
    return "Team Gear"
  }

  const activeOrgId =
    searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY) ?? navigation.scope.activeOrgId
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []
  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId
  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === activeTeamId)?.name ??
    "No team selected"

  return `${activeTeamLabel} > Gear`
}

function getVenueDetailId(pathname: string): string | null {
  const match = pathname.match(/^\/venues\/([^/]+)$/)
  return match?.[1] ?? null
}

function getSessionDetailId(pathname: string): string | null {
  const match = pathname.match(/^\/team-sessions\/([^/]+)$/)
  return match?.[1] ?? null
}

function resolveActiveScope(
  navigation: ResolvedNavigationScope | null,
  searchParams: ReadonlyURLSearchParams,
): ActiveScope {
  const queryOrgId = searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)
  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)

  if (!navigation?.scope) {
    return {
      activeOrgId: queryOrgId,
      activeTeamId: queryTeamId,
    }
  }

  const activeOrgId =
    queryOrgId &&
    navigation.catalog.organizations.some((organization) => organization.id === queryOrgId)
      ? queryOrgId
      : navigation.scope.activeOrgId

  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[activeOrgId] ?? []

  const activeTeamId =
    queryTeamId && teamsForOrganization.some((team) => team.id === queryTeamId)
      ? queryTeamId
      : navigation.scope.activeTeamId

  return {
    activeOrgId,
    activeTeamId,
  }
}

function buildScopedHref(pathname: string, scope: ActiveScope): string {
  const params = new URLSearchParams()

  if (scope.activeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)
  }

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }

  const query = params.toString()
  return query.length > 0 ? `${pathname}?${query}` : pathname
}

function buildScopedHrefWithTab(
  pathname: string,
  scope: ActiveScope,
  tab: string,
): string {
  const baseHref = buildScopedHref(pathname, scope)
  return baseHref.includes("?") ? `${baseHref}&tab=${tab}` : `${baseHref}?tab=${tab}`
}

function shouldUsePhaseOneMobileHeader(pathname: string): boolean {
  if (pathname.startsWith("/team-venues")) {
    return true
  }

  if (pathname.startsWith("/team-camps")) {
    return true
  }

  if (pathname.startsWith("/team-sessions")) {
    return true
  }

  return false
}

function resolveMobileBackFallbackPath(pathname: string): string {
  if (/^\/team-camps\/[^/]+$/.test(pathname)) {
    return "/team-camps"
  }

  if (/^\/team-sessions\/[^/]+$/.test(pathname)) {
    return "/team-home"
  }

  if (pathname.startsWith("/team-venues")) {
    return "/team-home"
  }

  if (pathname.startsWith("/team-camps")) {
    return "/team-home"
  }

  if (pathname.startsWith("/team-sessions")) {
    return "/team-home"
  }

  return "/team-home"
}

export function SiteHeader({
  navigation,
}: {
  navigation: ResolvedNavigationScope | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPwaDebugEnabled =
    searchParams.get("pwaDebug") === "1" || searchParams.get("pwaDebug") === "true"
  const [venueNameById, setVenueNameById] = useState<
    Record<string, string | null>
  >({})
  const [sessionBreadcrumbById, setSessionBreadcrumbById] = useState<
    Record<string, SessionBreadcrumbResponse | null>
  >({})

  const sectionTitle = pathname.startsWith("/team-venues")
    ? getTeamVenuesTitle(navigation, searchParams)
    : pathname.startsWith("/team-camps")
      ? getTeamCampsTitle(navigation, searchParams)
      : pathname.startsWith("/team-sessions")
        ? getTeamSessionsTitle(navigation, searchParams)
        : pathname.startsWith("/team-gear")
          ? getTeamGearTitle(navigation, searchParams)
        : pathname.startsWith("/team-notes")
          ? getTeamNotesTitle(navigation, searchParams)
        : pathname.startsWith("/team-standard-moves")
          ? getTeamStandardMovesTitle(navigation, searchParams)
        : pathname.startsWith("/team-reports")
          ? "Team Reports"
        : getSectionTitle(pathname)
  const isTeamHomeHeader = pathname.startsWith("/team-home")
  const isTeamSessionsHeader = pathname.startsWith("/team-sessions")
  const teamScopeSectionLabel = pathname.startsWith("/team-venues")
    ? "Venues"
    : pathname.startsWith("/team-camps")
      ? "Camps"
      : pathname.startsWith("/team-sessions")
        ? "Sessions"
        : pathname.startsWith("/team-gear")
          ? "Gear"
        : pathname.startsWith("/team-notes")
          ? "Notes"
        : pathname.startsWith("/team-standard-moves")
          ? "Std. Moves"
        : pathname.startsWith("/team-reports")
          ? "Reports"
        : null
  const venueDetailId = getVenueDetailId(pathname)
  const sessionDetailId = getSessionDetailId(pathname)
  const activeScope = resolveActiveScope(navigation, searchParams)
  const teamsForActiveOrganization =
    activeScope.activeOrgId && navigation
      ? navigation.catalog.teamsByOrganizationId[activeScope.activeOrgId] ?? []
      : []
  const activeTeamLabel =
    teamsForActiveOrganization.find((team) => team.id === activeScope.activeTeamId)
      ?.name ?? "No team selected"
  const teamHomeHref = buildScopedHref("/team-home", activeScope)
  const venuesHref = buildScopedHref("/venues", activeScope)
  const phaseOneMobileHeaderEligible = shouldUsePhaseOneMobileHeader(pathname)
  const mobileBackFallbackHref = buildScopedHref(
    resolveMobileBackFallbackPath(pathname),
    activeScope,
  )

  useEffect(() => {
    if (!venueDetailId) {
      return
    }

    const params = new URLSearchParams()

    if (activeScope.activeOrgId) {
      params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, activeScope.activeOrgId)
    }

    if (activeScope.activeTeamId) {
      params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, activeScope.activeTeamId)
    }

    const query = params.toString()
    const requestPath =
      query.length > 0
        ? `/api/venues/${venueDetailId}/breadcrumb?${query}`
        : `/api/venues/${venueDetailId}/breadcrumb`

    const controller = new AbortController()

    const loadVenueName = async () => {
      try {
        const response = await fetch(requestPath, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          setVenueNameById((currentValue) => ({
            ...currentValue,
            [venueDetailId]: null,
          }))
          return
        }

        const payload = (await response.json()) as VenueBreadcrumbResponse
        const normalizedName =
          typeof payload.name === "string" && payload.name.trim().length > 0
            ? payload.name.trim()
            : null

        setVenueNameById((currentValue) => ({
          ...currentValue,
          [venueDetailId]: normalizedName,
        }))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setVenueNameById((currentValue) => ({
          ...currentValue,
          [venueDetailId]: null,
        }))
      }
    }

    void loadVenueName()

    return () => {
      controller.abort()
    }
  }, [activeScope.activeOrgId, activeScope.activeTeamId, venueDetailId])

  useEffect(() => {
    if (!sessionDetailId) {
      return
    }

    const params = new URLSearchParams()

    if (activeScope.activeOrgId) {
      params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, activeScope.activeOrgId)
    }

    if (activeScope.activeTeamId) {
      params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, activeScope.activeTeamId)
    }

    const query = params.toString()
    const requestPath =
      query.length > 0
        ? `/api/team-sessions/${sessionDetailId}/breadcrumb?${query}`
        : `/api/team-sessions/${sessionDetailId}/breadcrumb`

    const controller = new AbortController()

    const loadSessionBreadcrumb = async () => {
      try {
        const response = await fetch(requestPath, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          setSessionBreadcrumbById((currentValue) => ({
            ...currentValue,
            [sessionDetailId]: null,
          }))
          return
        }

        const payload = (await response.json()) as SessionBreadcrumbResponse
        setSessionBreadcrumbById((currentValue) => ({
          ...currentValue,
          [sessionDetailId]: payload,
        }))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setSessionBreadcrumbById((currentValue) => ({
          ...currentValue,
          [sessionDetailId]: null,
        }))
      }
    }

    void loadSessionBreadcrumb()

    return () => {
      controller.abort()
    }
  }, [activeScope.activeOrgId, activeScope.activeTeamId, sessionDetailId])

  const venueName = venueDetailId ? venueNameById[venueDetailId] ?? null : null
  const sessionBreadcrumb = sessionDetailId
    ? sessionBreadcrumbById[sessionDetailId] ?? null
    : null
  const sessionTeamLabel = sessionBreadcrumb?.team_name ?? activeTeamLabel
  const sessionVenueLabel = sessionBreadcrumb?.venue_name ?? "Venue"
  const sessionCampLabel = sessionBreadcrumb?.camp_name ?? "Camp"
  const sessionDetailTitle = getSessionDetailTitle(sessionBreadcrumb)
  const mobileHeaderTitle = sessionDetailId
    ? sessionDetailTitle
    : getSectionTitle(pathname)
  const sessionVenueHref =
    sessionBreadcrumb?.venue_id !== null && sessionBreadcrumb?.venue_id !== undefined
      ? buildScopedHrefWithTab(`/venues/${sessionBreadcrumb.venue_id}`, activeScope, "sessions")
      : venuesHref
  const sessionCampHref =
    sessionBreadcrumb?.camp_id !== null && sessionBreadcrumb?.camp_id !== undefined
      ? buildScopedHrefWithTab(
          `/team-camps/${sessionBreadcrumb.camp_id}`,
          activeScope,
          "sessions",
        )
      : buildScopedHref("/team-camps", activeScope)

  function handleMobileHeaderNavigation(): void {
    if (isTeamSessionsHeader) {
      router.push(teamHomeHref)
      return
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push(mobileBackFallbackHref)
  }

  const desktopHeaderClassName = phaseOneMobileHeaderEligible
    ? "mobile-safe-header z-30 hidden shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 md:flex md:bg-background"
    : "mobile-safe-header z-30 flex shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 md:bg-background"

  const desktopHeader = (
    <header className={desktopHeaderClassName}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-8"
        />
        {sessionDetailId ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={teamHomeHref} />}>
                  {sessionTeamLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={sessionVenueHref} />}>
                  {sessionVenueLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={sessionCampHref} />}>
                  {sessionCampLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{sessionDetailTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : venueDetailId ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={teamHomeHref} />}>
                  {activeTeamLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={venuesHref} />}>Venue</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{venueName ?? "Venue"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : teamScopeSectionLabel ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={teamHomeHref} />}>
                  {activeTeamLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{teamScopeSectionLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className={isTeamHomeHeader ? "text-sm font-medium" : "text-base font-medium"}>
            {sectionTitle}
          </h1>
        )}
        <div className="ml-auto flex items-center gap-2">
          <PwaDebugPanel enabled={isPwaDebugEnabled} />
          <InstallAppButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )

  if (phaseOneMobileHeaderEligible) {
    const showMobileSidebarTrigger =
      pathname.startsWith("/team-sessions") || pathname === "/team-venues"

    return (
      <>
        <header className="mobile-safe-header z-30 flex shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden md:bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMobileHeaderNavigation}
            aria-label={isTeamSessionsHeader ? "Go to Team Home" : "Go back"}
            className="-ml-1"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h1 className="ml-2 flex-1 truncate text-base font-medium">{mobileHeaderTitle}</h1>
          {showMobileSidebarTrigger ? <SidebarTrigger className="ml-1" /> : null}
        </header>
        {desktopHeader}
      </>
    )
  }

  return desktopHeader
}
