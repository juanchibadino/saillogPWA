"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Building2Icon,
  CheckIcon,
  CircleIcon,
  CreditCardIcon,
  ChevronsUpDownIcon,
  HomeIcon,
  KeyIcon,
  LogOutIcon,
  MapPinIcon,
  SailboatIcon,
  UsersIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

const NAVIGATION_SCOPE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const homeNavItem = {
  title: "Dashboard",
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
    title: "Venues",
    url: "/venues",
    icon: MapPinIcon,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCardIcon,
  },
  {
    title: "Teams",
    url: "/teams",
    icon: UsersIcon,
  },
  {
    title: "Users",
    url: "/users",
    icon: UsersIcon,
    comingSoon: false,
  },
]

const teamNavItems = [
  {
    title: "Home",
    url: "/team-home",
    icon: HomeIcon,
    comingSoon: false,
  },
  {
    title: "Venues",
    url: "/team-venues",
    icon: MapPinIcon,
    comingSoon: false,
  },
  {
    title: "Camps",
    url: "/team-camps",
    icon: CircleIcon,
    comingSoon: false,
  },
  {
    title: "Sessions",
    url: "/team-sessions",
    icon: SailboatIcon,
    comingSoon: false,
  },
]

const DEFAULT_UI_CAPABILITIES: NavigationScopeUiCapabilities = {
  showOrganizationPicker: true,
  showTeamPicker: true,
  pickerMode: "super_admin",
}

function isItemActive(pathname: string, itemUrl: string): boolean {
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
  const { isMobile } = useSidebar()
  const [pendingScopeSwitch, setPendingScopeSwitch] =
    React.useState<PendingScopeSwitch | null>(null)
  const [isScopeSwitchPending, startScopeSwitchTransition] = React.useTransition()

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

    startScopeSwitchTransition(() => {
      persistScopeSelection(nextOrgId, nextTeamId)
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

  const scopedDashboardHref = buildScopedHref("/dashboard", activeOrgId, activeTeamId)

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {canShowScopePicker ? (
              <DropdownMenu>
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
                          onClick={() => handleOrganizationSelect(organization.id)}
                          className="gap-2 p-2"
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
                              onClick={() => handleTeamSelect(team.id)}
                              className="gap-2 p-2"
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
                              onClick={() => handleTeamSelect(team.id, team.organizationId)}
                              className="gap-2 p-2"
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
              <SidebarMenuButton size="lg" render={<Link href={scopedDashboardHref} />}>
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
            <SidebarGroup>
              <SidebarGroupLabel>Organization</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem key={homeNavItem.title}>
                    <SidebarMenuButton
                      isActive={isItemActive(pathname, homeNavItem.url)}
                      tooltip={homeNavItem.title}
                      render={
                        <Link
                          href={buildScopedHref(
                            homeNavItem.url,
                            activeOrgId,
                            activeTeamId,
                          )}
                        />
                      }
                    >
                      <homeNavItem.icon />
                      <span>{homeNavItem.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {canAccessOrganizationsPage ? (
                    <SidebarMenuItem key={organizationsNavItem.title}>
                      <SidebarMenuButton
                        isActive={isItemActive(pathname, organizationsNavItem.url)}
                        tooltip={organizationsNavItem.title}
                        render={
                          <Link
                            href={buildScopedHref(
                              organizationsNavItem.url,
                              activeOrgId,
                              activeTeamId,
                            )}
                          />
                        }
                      >
                        <organizationsNavItem.icon />
                        <span>{organizationsNavItem.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : null}
                  {canAccessOrganizationModules
                    ? organizationNavItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            isActive={item.url ? isItemActive(pathname, item.url) : false}
                            tooltip={
                              item.comingSoon ? `${item.title} (NIY)` : item.title
                            }
                            disabled={item.comingSoon}
                            render={
                              item.url
                                ? (
                                    <Link
                                      href={buildScopedHref(
                                        item.url,
                                        activeOrgId,
                                        activeTeamId,
                                      )}
                                    />
                                  )
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
                      ))
                    : null}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Team</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teamNavItems.map((item) => {
                    const disabled = item.comingSoon || noTeamSelected
                    const tooltip = item.comingSoon
                      ? `${item.title} (NIY)`
                      : noTeamSelected
                        ? `${item.title} (Select a team first)`
                        : item.title

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={item.url ? isItemActive(pathname, item.url) : false}
                          tooltip={tooltip}
                          disabled={disabled}
                          render={
                            item.url && !disabled
                              ? (
                                  <Link
                                    href={buildScopedHref(
                                      item.url,
                                      activeOrgId,
                                      activeTeamId,
                                    )}
                                  />
                                )
                              : undefined
                          }
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          {item.comingSoon ? (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              NIY
                            </span>
                          ) : noTeamSelected ? (
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
            <DropdownMenu>
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
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    router.push("/set-password")
                  }}
                >
                  <KeyIcon className="size-4" />
                  <span>Set password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const form = document.getElementById(
                      "sidebar-sign-out-form",
                    ) as HTMLFormElement | null
                    form?.requestSubmit()
                  }}
                >
                  <LogOutIcon className="size-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <form id="sidebar-sign-out-form" action="/sign-out" method="post" className="hidden" />
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
