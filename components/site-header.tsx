"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useSearchParams,
} from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
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
}

function getSectionTitle(pathname: string): string {
  if (pathname.startsWith("/organizations")) {
    return "Organizations"
  }

  if (pathname.startsWith("/teams")) {
    return "Teams"
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

  if (pathname.startsWith("/team-venues")) {
    return "Team Venues"
  }

  if (pathname.startsWith("/venues")) {
    return "Venues"
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

export function SiteHeader({
  navigation,
}: {
  navigation: ResolvedNavigationScope | null
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [venueNameById, setVenueNameById] = useState<
    Record<string, string | null>
  >({})
  const [sessionBreadcrumbById, setSessionBreadcrumbById] = useState<
    Record<string, SessionBreadcrumbResponse | null>
  >({})

  const sectionTitle = pathname.startsWith("/team-venues")
    ? getTeamVenuesTitle(navigation, searchParams)
    : getSectionTitle(pathname)
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

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
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
                <BreadcrumbPage>Session</BreadcrumbPage>
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
        ) : (
          <h1 className="text-base font-medium">{sectionTitle}</h1>
        )}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
