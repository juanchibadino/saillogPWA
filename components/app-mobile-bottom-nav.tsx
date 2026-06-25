"use client"

import Link from "next/link"
import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  HomeIcon,
  MapPinIcon,
  SailboatIcon,
  TentTreeIcon,
  type LucideIcon,
} from "lucide-react"

import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { ResolvedNavigationScope } from "@/lib/navigation/types"

type ActiveScope = {
  activeOrgId: string | null
  activeTeamId: string | null
}

type MobileNavItem = {
  title: string
  url: string
  icon: LucideIcon
}

const mobileNavItems: MobileNavItem[] = [
  {
    title: "Home",
    url: "/team-home",
    icon: HomeIcon,
  },
  {
    title: "Venues",
    url: "/team-venues",
    icon: MapPinIcon,
  },
  {
    title: "Camps",
    url: "/team-camps",
    icon: TentTreeIcon,
  },
  {
    title: "Sessions",
    url: "/team-sessions",
    icon: SailboatIcon,
  },
]

function resolveActiveScope(
  navigation: ResolvedNavigationScope | null,
  searchParams: URLSearchParams,
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

function buildScopedHref(path: string, scope: ActiveScope): string {
  const params = new URLSearchParams()

  if (scope.activeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId)
  }

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId)
  }

  const query = params.toString()
  return query.length > 0 ? `${path}?${query}` : path
}

function isVenueDetailPath(pathname: string): boolean {
  return /^\/venues\/[^/]+$/.test(pathname)
}

function isItemActive(pathname: string, itemUrl: string): boolean {
  if (isVenueDetailPath(pathname)) {
    return itemUrl === "/team-venues"
  }

  return pathname === itemUrl || pathname.startsWith(`${itemUrl}/`)
}

export function AppMobileBottomNav({
  canAccessApp,
  navigation,
}: {
  canAccessApp: boolean
  navigation: ResolvedNavigationScope | null
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!canAccessApp) {
    return null
  }

  const scope = resolveActiveScope(
    navigation,
    new URLSearchParams(searchParams.toString()),
  )

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <div className="mobile-bottom-nav-grid mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const active = isItemActive(pathname, item.url)
          const linkClassName = [
            "inline-flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl transition-[width,padding,gap,background-color,color] duration-300 ease-out motion-reduce:transition-none",
            "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            active
              ? "w-[7rem] gap-2 bg-foreground/10 px-3 text-foreground"
              : "w-11 gap-0 px-0 text-muted-foreground",
          ].join(" ")

          return (
            <Link
              key={item.url}
              href={buildScopedHref(item.url, scope)}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
              className={linkClassName}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span
                aria-hidden={!active}
                className={[
                  "overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width,opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  active
                    ? "max-w-[4.75rem] translate-x-0 opacity-100"
                    : "max-w-0 -translate-x-1 opacity-0",
                ].join(" ")}
              >
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
