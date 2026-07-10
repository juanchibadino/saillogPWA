"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3Icon,
  Building2Icon,
  CheckIcon,
  ClipboardCheckIcon,
  CircleIcon,
  CreditCardIcon,
  ChevronsUpDownIcon,
  ImagesIcon,
  NotebookTextIcon,
  HomeIcon,
  KeyIcon,
  LogOutIcon,
  MapPinIcon,
  SailboatIcon,
  WindIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  NAVIGATION_SCOPE_ORG_COOKIE,
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_COOKIE,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type {
  NavigationScopeUiCapabilities,
  NavigationTeamId,
  ResolvedNavigationScope,
  ScopeOrganizationOption,
  ScopeTeamOption,
  ScopeTeamPickerOption,
} from "@/lib/navigation/types"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAppNavigationState } from "@/components/app-navigation-state"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  canAccessApp: boolean
  navigation: ResolvedNavigationScope | null
  user: {
    name: string
    email: string
    role: string
    avatarUrl: string | null
  }
}

type PendingScopeSwitch = {
  title: string
  fromLabel: string
  toLabel: string
}

type BillingPlanTier = "free" | "pro" | "olympic"

type BillingPlanResponse = {
  planTier: BillingPlanTier | null
}

type SidebarNavItem = {
  title: string
  url?: string
  icon: LucideIcon
}

type SidebarNavSection = {
  title: string
  items: SidebarNavItem[]
}

const NAVIGATION_SCOPE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const homeNavItem = {
  title: "Home",
  url: "/dashboard",
  icon: HomeIcon,
}

const organizationsNavItem = {
  title: "Organizations",
  url: "/organizations",
  icon: Building2Icon,
}

const organizationNavItems = [
  {
    title: "Teams",
    url: "/teams",
    icon: UsersIcon,
  },
  {
    title: "Members",
    url: "/users",
    icon: UserIcon,
    comingSoon: false,
  },
  {
    title: "Venues",
    url: "/venues",
    icon: MapPinIcon,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3Icon,
    comingSoon: false,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCardIcon,
  },
]

const teamNavSections: SidebarNavSection[] = [
  {
    title: "Team",
    items: [
      {
        title: "Home",
        url: "/team-home",
        icon: HomeIcon,
      },
      {
        title: "Venue",
        url: "/team-venues",
        icon: MapPinIcon,
      },
      {
        title: "Camps",
        url: "/team-camps",
        icon: CircleIcon,
      },
      {
        title: "Session",
        url: "/team-sessions",
        icon: SailboatIcon,
      },
    ],
  },
  {
    title: "Strategy",
    items: [
      {
        title: "Std. Moves",
        url: "/team-standard-moves",
        icon: CheckIcon,
      },
      {
        title: "Wind Patterns",
        url: "/team-wind-patterns",
        icon: WindIcon,
      },
      {
        title: "Notes",
        url: "/team-notes",
        icon: NotebookTextIcon,
      },
    ],
  },
  {
    title: "Others",
    items: [
      {
        title: "Reports",
        url: "/team-reports",
        icon: BarChart3Icon,
      },
      {
        title: "Assets",
        url: "/team-assets",
        icon: ImagesIcon,
      },
      {
        title: "Assessments",
        url: "/team-assessments",
        icon: ClipboardCheckIcon,
      },
      {
        title: "Gear",
        url: "/team-gear",
        icon: WrenchIcon,
      },
    ],
  },
]

const DEFAULT_UI_CAPABILITIES: NavigationScopeUiCapabilities = {
  showOrganizationPicker: true,
  showTeamPicker: true,
  pickerMode: "super_admin",
}

function isVenueDetailPath(pathname: string): boolean {
  return /^\/venues\/[^/]+$/.test(pathname)
}

function isItemActive(pathname: string, itemUrl: string): boolean {
  if (isVenueDetailPath(pathname)) {
    if (itemUrl === "/team-venues") {
      return true
    }

    if (itemUrl === "/venues") {
      return false
    }
  }

  return pathname === itemUrl || pathname.startsWith(`${itemUrl}/`)
}

function buildScopedHref(
  path: string,
  activeOrgId: string | null,
  activeTeamId: NavigationTeamId,
): string {
  if (!activeOrgId) {
    return path
  }

  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, activeOrgId)

  if (activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, activeTeamId)
  }

  return `${path}?${params.toString()}`
}

function persistScopeSelection(orgId: string, teamId: NavigationTeamId): void {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${NAVIGATION_SCOPE_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=${NAVIGATION_SCOPE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`

  if (teamId) {
    document.cookie = `${NAVIGATION_SCOPE_TEAM_COOKIE}=${encodeURIComponent(teamId)}; path=/; max-age=${NAVIGATION_SCOPE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
    return
  }

  document.cookie = `${NAVIGATION_SCOPE_TEAM_COOKIE}=; path=/; max-age=0; samesite=lax`
}

function findActiveOrganization(
  organizations: ScopeOrganizationOption[],
  preferredOrgId: string | null,
): ScopeOrganizationOption | null {
  if (!preferredOrgId) {
    return organizations[0] ?? null
  }

  return (
    organizations.find((organization) => organization.id === preferredOrgId) ??
    organizations[0] ??
    null
  )
}

function findDefaultTeamIdForOrganization(
  organizationId: string,
  defaultTeamIdByOrganizationId: Record<string, NavigationTeamId>,
): NavigationTeamId {
  return defaultTeamIdByOrganizationId[organizationId] ?? null
}

function resolveActiveTeamId(input: {
  preferredTeamId: string | null
  fallbackTeamId: NavigationTeamId
  teamsForOrganization: ScopeTeamOption[]
}): NavigationTeamId {
  const teamIds = new Set(input.teamsForOrganization.map((team) => team.id))

  if (input.preferredTeamId && teamIds.has(input.preferredTeamId)) {
    return input.preferredTeamId
  }

  if (input.fallbackTeamId && teamIds.has(input.fallbackTeamId)) {
    return input.fallbackTeamId
  }

  return input.teamsForOrganization[0]?.id ?? null
}

function findTeamOptionById(
  teamsForOrganization: ScopeTeamOption[],
  teamPickerOptions: ScopeTeamPickerOption[],
  teamId: NavigationTeamId,
): ScopeTeamOption | ScopeTeamPickerOption | null {
  if (!teamId) {
    return null
  }

  return (
    teamsForOrganization.find((team) => team.id === teamId) ??
    teamPickerOptions.find((team) => team.id === teamId) ??
    null
  )
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

export function AppSidebar({
  canAccessApp,
  navigation,
  user,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { displayPathname, markNavigationIntent } = useAppNavigationState()
  const { isMobile, setOpenMobile } = useSidebar()
  const [pendingScopeSwitch, setPendingScopeSwitch] =
    React.useState<PendingScopeSwitch | null>(null)
  const [isScopeSwitchPending, startScopeSwitchTransition] = React.useTransition()
  const [planTierByOrganizationId, setPlanTierByOrganizationId] = React.useState<
    Record<string, BillingPlanTier | null>
  >({})
  const [isScopeMenuOpen, setIsScopeMenuOpen] = React.useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)

  const organizations = navigation?.catalog.organizations ?? []
  const teamsByOrganizationId = navigation?.catalog.teamsByOrganizationId
  const teamPickerOptions = navigation?.catalog.teamPickerOptions ?? []
  const uiCapabilities =
    navigation?.catalog.uiCapabilities ?? DEFAULT_UI_CAPABILITIES
  const defaultTeamIdByOrganizationId =
    navigation?.catalog.defaultTeamIdByOrganizationId ?? {}
  const showOrganizationPicker = uiCapabilities.showOrganizationPicker
  const showTeamPicker = uiCapabilities.showTeamPicker

  const queryOrgId = searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)
  const fallbackOrgId = navigation?.scope?.activeOrgId ?? null
  const activeOrganization = findActiveOrganization(
    organizations,
    queryOrgId ?? fallbackOrgId,
  )
  const activeOrgId = activeOrganization?.id ?? null

  const teamsForActiveOrganization =
    activeOrgId && teamsByOrganizationId
      ? teamsByOrganizationId[activeOrgId] ?? []
      : []

  const fallbackTeamId = activeOrgId
    ? findDefaultTeamIdForOrganization(activeOrgId, defaultTeamIdByOrganizationId)
    : null

  const queryTeamId = searchParams.get(NAVIGATION_SCOPE_TEAM_QUERY_KEY)
  const serverResolvedTeamId = navigation?.scope?.activeTeamId ?? null

  const activeTeamId = resolveActiveTeamId({
    preferredTeamId: queryTeamId,
    fallbackTeamId: fallbackTeamId ?? serverResolvedTeamId,
    teamsForOrganization: teamsForActiveOrganization,
  })
  const activeTeam = findTeamOptionById(
    teamsForActiveOrganization,
    teamPickerOptions,
    activeTeamId,
  )
  const activeTeamOrgName =
    activeTeam && "organizationName" in activeTeam
      ? activeTeam.organizationName
      : activeOrganization?.name ?? null

  const activeTeamName = activeTeam?.name ?? "No team selected"

  const organizationName = activeOrganization?.name ?? activeTeamOrgName ?? "Sailog"
  const organizationAvatarUrl = activeOrganization?.avatarUrl ?? null
  const hasMultipleTeamPickerOrganizations =
    new Set(teamPickerOptions.map((team) => team.organizationId)).size > 1
  const canShowScopePicker =
    Boolean(canAccessApp && activeOrgId) &&
    (showOrganizationPicker || showTeamPicker)
  const canAccessOrganizationModules =
    uiCapabilities.pickerMode === "super_admin" ||
    uiCapabilities.pickerMode === "organization_admin"
  const canAccessOrganizationsPage = uiCapabilities.pickerMode === "super_admin"
  const noTeamSelected = activeTeamId === null

  React.useEffect(() => {
    if (!isScopeSwitchPending) {
      setPendingScopeSwitch(null)
    }
  }, [isScopeSwitchPending])

  React.useEffect(() => {
    if (!canAccessOrganizationModules || !activeOrgId) {
      return
    }

    if (activeOrgId in planTierByOrganizationId) {
      return
    }

    const controller = new AbortController()

    const loadPlanTier = async () => {
      try {
        const response = await fetch(
          `/api/billing/plan?org=${encodeURIComponent(activeOrgId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          setPlanTierByOrganizationId((currentValue) => ({
            ...currentValue,
            [activeOrgId]: "free",
          }))
          return
        }

        const payload = (await response.json()) as BillingPlanResponse
        setPlanTierByOrganizationId((currentValue) => ({
          ...currentValue,
          [activeOrgId]: payload.planTier,
        }))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setPlanTierByOrganizationId((currentValue) => ({
          ...currentValue,
          [activeOrgId]: "free",
        }))
      }
    }

    void loadPlanTier()

    return () => {
      controller.abort()
    }
  }, [activeOrgId, canAccessOrganizationModules, planTierByOrganizationId])

  const activePlanTier =
    canAccessOrganizationModules && activeOrgId
      ? planTierByOrganizationId[activeOrgId]
      : null
  const planBadgeLabel =
    activePlanTier === "pro"
      ? "Pro Plan"
      : activePlanTier === "olympic"
        ? "Olympic Plan"
        : "Free Plan"

  const handleSidebarNavigationClick = React.useCallback(
    (href: string, event: React.MouseEvent<HTMLElement>) => {
      markNavigationIntent(href, event)
      setIsScopeMenuOpen(false)
      setIsUserMenuOpen(false)

      if (isMobile) {
        setOpenMobile(false)
      }
    },
    [isMobile, markNavigationIntent, setOpenMobile],
  )

  function handleMobileMenuPointerDown(
    event: React.PointerEvent<HTMLElement>,
    action: () => void,
  ): void {
    if (!isMobile) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    action()
  }

  function updateScope(nextOrgId: string, nextTeamId: NavigationTeamId): void {
    if (!pathname) {
      return
    }

    if (nextOrgId === activeOrgId && nextTeamId === activeTeamId) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, nextOrgId)

    if (nextTeamId) {
      params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, nextTeamId)
    } else {
      params.delete(NAVIGATION_SCOPE_TEAM_QUERY_KEY)
    }

    const href =
      params.toString().length > 0 ? `${pathname}?${params.toString()}` : pathname

    const nextOrganizationName =
      organizations.find((organization) => organization.id === nextOrgId)?.name ??
      organizationName
    const nextTeamsForOrganization = teamsByOrganizationId?.[nextOrgId] ?? []
    const nextTeam = findTeamOptionById(
      nextTeamsForOrganization,
      teamPickerOptions,
      nextTeamId,
    )
    const nextTeamName = nextTeam?.name ?? "No team selected"

    const pendingSwitch: PendingScopeSwitch =
      nextOrgId !== activeOrgId
        ? {
            title: "Changing Organization",
            fromLabel: organizationName,
            toLabel: nextOrganizationName,
          }
        : {
            title: "Changing Teams",
            fromLabel: activeTeamName,
            toLabel: nextTeamName,
          }

    setPendingScopeSwitch(pendingSwitch)
    setIsScopeMenuOpen(false)
    setIsUserMenuOpen(false)

    startScopeSwitchTransition(() => {
      persistScopeSelection(nextOrgId, nextTeamId)
      if (isMobile) {
        setOpenMobile(false)
      }
      router.push(href)
    })
  }

  function handleOrganizationSelect(nextOrgId: string): void {
    const nextTeamId = findDefaultTeamIdForOrganization(
      nextOrgId,
      defaultTeamIdByOrganizationId,
    )

    updateScope(nextOrgId, nextTeamId)
  }

  function handleTeamSelect(nextTeamId: string, nextOrgId?: string): void {
    const organizationId = nextOrgId ?? activeOrgId

    if (!organizationId) {
      return
    }

    updateScope(organizationId, nextTeamId)
  }

  const canAccessOrganizationArea = canAccessOrganizationModules
  const scopedDefaultHomeHref = buildScopedHref(
    canAccessOrganizationArea ? "/dashboard" : "/team-home",
    activeOrgId,
    activeTeamId,
  )

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {canShowScopePicker ? (
              <DropdownMenu
                modal={false}
                open={isScopeMenuOpen}
                onOpenChange={setIsScopeMenuOpen}
              >
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <Avatar className="size-8 rounded-lg">
                    {organizationAvatarUrl ? (
                      <AvatarImage src={organizationAvatarUrl} alt={organizationName} />
                    ) : null}
                    <AvatarFallback className="rounded-lg bg-blue-600 font-medium text-[11px] text-white">
                      {getInitials(organizationName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{organizationName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {activeTeamName}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--anchor-width) min-w-56 rounded-lg"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={4}
                >
                  {showOrganizationPicker ? (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Organizations
                      </DropdownMenuLabel>
                      {organizations.map((organization) => (
                        <DropdownMenuItem
                          key={organization.id}
                          nativeButton
                          render={<button type="button" />}
                          onClick={() => handleOrganizationSelect(organization.id)}
                          onPointerDownCapture={(event) =>
                            handleMobileMenuPointerDown(event, () =>
                              handleOrganizationSelect(organization.id),
                            )
                          }
                          className="w-full gap-2 p-2 text-left"
                        >
                          <Avatar className="size-6 rounded-md">
                            {organization.avatarUrl ? (
                              <AvatarImage
                                src={organization.avatarUrl}
                                alt={organization.name}
                              />
                            ) : null}
                            <AvatarFallback className="rounded-md bg-blue-600 text-[10px] font-medium text-white">
                              {getInitials(organization.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{organization.name}</span>
                          {organization.id === activeOrgId ? (
                            <CheckIcon className="ml-auto size-4" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ) : null}

                  {showOrganizationPicker && showTeamPicker ? (
                    <DropdownMenuSeparator />
                  ) : null}

                  {showTeamPicker ? (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Teams
                      </DropdownMenuLabel>
                      {showOrganizationPicker
                        ? teamsForActiveOrganization.map((team) => (
                            <DropdownMenuItem
                              key={team.id}
                              nativeButton
                              render={<button type="button" />}
                              onClick={() => handleTeamSelect(team.id)}
                              onPointerDownCapture={(event) =>
                                handleMobileMenuPointerDown(event, () =>
                                  handleTeamSelect(team.id),
                                )
                              }
                              className="w-full gap-2 p-2 text-left"
                            >
                              <div className="flex size-6 items-center justify-center rounded-md border">
                                <UsersIcon className="size-3.5" />
                              </div>
                              <span className="truncate">{team.name}</span>
                              {team.id === activeTeamId ? (
                                <CheckIcon className="ml-auto size-4" />
                              ) : null}
                            </DropdownMenuItem>
                          ))
                        : teamPickerOptions.map((team) => (
                            <DropdownMenuItem
                              key={team.id}
                              nativeButton
                              render={<button type="button" />}
                              onClick={() => handleTeamSelect(team.id, team.organizationId)}
                              onPointerDownCapture={(event) =>
                                handleMobileMenuPointerDown(event, () =>
                                  handleTeamSelect(team.id, team.organizationId),
                                )
                              }
                              className="w-full gap-2 p-2 text-left"
                            >
                              <div className="flex size-6 items-center justify-center rounded-md border">
                                <UsersIcon className="size-3.5" />
                              </div>
                              <div className="grid min-w-0">
                                <span className="truncate">{team.name}</span>
                                {hasMultipleTeamPickerOrganizations ? (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {team.organizationName}
                                  </span>
                                ) : null}
                              </div>
                              {team.id === activeTeamId &&
                              team.organizationId === activeOrgId ? (
                                <CheckIcon className="ml-auto size-4" />
                              ) : null}
                            </DropdownMenuItem>
                          ))}
                      {(showOrganizationPicker
                        ? teamsForActiveOrganization.length === 0
                        : teamPickerOptions.length === 0) ? (
                        <DropdownMenuItem disabled className="gap-2">
                          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                            <UsersIcon className="size-3.5" />
                          </div>
                          <span>No teams available</span>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuGroup>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton
                size="lg"
                render={
                  <Link
                    href={scopedDefaultHomeHref}
                    onClick={(event) =>
                      handleSidebarNavigationClick(scopedDefaultHomeHref, event)
                    }
                  />
                }
              >
                <Avatar className="size-8 rounded-lg">
                  {organizationAvatarUrl ? (
                    <AvatarImage src={organizationAvatarUrl} alt={organizationName} />
                  ) : null}
                  <AvatarFallback className="rounded-lg bg-blue-600 font-medium text-[11px] text-white">
                    {getInitials(organizationName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{organizationName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeTeamName}
                  </span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {canAccessApp ? (
          <>
            {canAccessOrganizationArea ? (
              <SidebarGroup>
                <SidebarGroupLabel>Organization</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem key={homeNavItem.title}>
                      <SidebarMenuButton
                        isActive={isItemActive(displayPathname, homeNavItem.url)}
                        tooltip={homeNavItem.title}
                        render={
                          (() => {
                            const href = buildScopedHref(
                              homeNavItem.url,
                              activeOrgId,
                              activeTeamId,
                            )

                            return (
                              <Link
                                href={href}
                                onClick={(event) =>
                                  handleSidebarNavigationClick(href, event)
                                }
                              />
                            )
                          })()
                        }
                      >
                        <homeNavItem.icon />
                        <span>{homeNavItem.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {canAccessOrganizationsPage ? (
                      <SidebarMenuItem key={organizationsNavItem.title}>
                        <SidebarMenuButton
                          isActive={isItemActive(
                            displayPathname,
                            organizationsNavItem.url,
                          )}
                          tooltip={organizationsNavItem.title}
                          render={
                            (() => {
                              const href = buildScopedHref(
                                organizationsNavItem.url,
                                activeOrgId,
                                activeTeamId,
                              )

                              return (
                                <Link
                                  href={href}
                                  onClick={(event) =>
                                    handleSidebarNavigationClick(href, event)
                                  }
                                />
                              )
                            })()
                          }
                        >
                          <organizationsNavItem.icon />
                          <span>{organizationsNavItem.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : null}
                    {organizationNavItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={
                            item.url ? isItemActive(displayPathname, item.url) : false
                          }
                          tooltip={
                            item.comingSoon ? `${item.title} (NIY)` : item.title
                          }
                          disabled={item.comingSoon}
                          render={
                            item.url
                              ? (() => {
                                  const href = buildScopedHref(
                                    item.url,
                                    activeOrgId,
                                    activeTeamId,
                                  )

                                  return (
                                    <Link
                                      href={href}
                                      onClick={(event) =>
                                        handleSidebarNavigationClick(href, event)
                                      }
                                    />
                                  )
                                })()
                              : undefined
                          }
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          {item.comingSoon ? (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              NIY
                            </span>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}

            {teamNavSections.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const disabled = !item.url || noTeamSelected
                      const tooltip = noTeamSelected
                        ? `${item.title} (Select a team first)`
                        : item.title

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            isActive={
                              item.url ? isItemActive(displayPathname, item.url) : false
                            }
                            tooltip={tooltip}
                            disabled={disabled}
                            render={
                              item.url && !disabled
                                ? (() => {
                                    const href = buildScopedHref(
                                      item.url,
                                      activeOrgId,
                                      activeTeamId,
                                    )

                                    return (
                                      <Link
                                        href={href}
                                        onClick={(event) =>
                                          handleSidebarNavigationClick(href, event)
                                        }
                                      />
                                    )
                                  })()
                                : undefined
                            }
                          >
                            <item.icon />
                            <span>{item.title}</span>
                            {noTeamSelected ? (
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                TEAM
                              </span>
                            ) : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Access</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 text-sm text-sidebar-foreground/80">
                You can sign in, but no org or team membership is active yet.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu
              modal={false}
              open={isUserMenuOpen}
              onOpenChange={setIsUserMenuOpen}
            >
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                  <AvatarFallback className="rounded-lg font-medium text-[11px]">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground/80">
                    {user.role}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                align="end"
                side={isMobile ? "bottom" : "right"}
                sideOffset={6}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        ) : null}
                        <AvatarFallback className="rounded-lg font-medium text-[11px]">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground/80">
                          {user.role}
                        </span>
                        {canAccessOrganizationModules ? (
                          <Badge
                            variant="secondary"
                            className="mt-1 inline-flex w-fit text-[10px] font-medium"
                          >
                            {planBadgeLabel}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  nativeButton
                  render={<button type="button" />}
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    router.push("/set-password")
                  }}
                  onPointerDownCapture={(event) =>
                    handleMobileMenuPointerDown(event, () => {
                      setIsUserMenuOpen(false)
                      setOpenMobile(false)
                      router.push("/set-password")
                    })
                  }
                  className="w-full text-left"
                >
                  <KeyIcon className="size-4" />
                  <span>Set password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  nativeButton
                  render={<button type="button" />}
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    window.location.assign("/sign-out")
                  }}
                  onPointerDownCapture={(event) =>
                    handleMobileMenuPointerDown(event, () => {
                      setIsUserMenuOpen(false)
                      window.location.assign("/sign-out")
                    })
                  }
                  className="w-full text-left"
                >
                  <LogOutIcon className="size-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <Dialog open={pendingScopeSwitch !== null}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{pendingScopeSwitch?.title ?? "Changing Scope"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {pendingScopeSwitch
                ? `${pendingScopeSwitch.fromLabel} to ${pendingScopeSwitch.toLabel}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            Loading...
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
