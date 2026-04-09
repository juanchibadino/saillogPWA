"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  HomeIcon,
  LogOutIcon,
  MapPinIcon,
} from "lucide-react"

import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  canAccessApp: boolean
  brand: {
    organizationName: string | null
    teamName: string | null
    avatarUrl: string | null
  }
  user: {
    name: string
    email: string
  }
}

const navItems = [
  {
    title: "Home",
    url: "/dashboard",
    icon: HomeIcon,
  },
  {
    title: "Venue",
    url: "/venues",
    icon: MapPinIcon,
  },
]

function isItemActive(pathname: string, itemUrl: string): boolean {
  return pathname === itemUrl || pathname.startsWith(`${itemUrl}/`)
}

export function AppSidebar({
  canAccessApp,
  brand,
  user,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const organizationName =
    brand.organizationName && brand.organizationName.trim().length > 0
      ? brand.organizationName
      : "Sailog"
  const teamName =
    brand.teamName && brand.teamName.trim().length > 0
      ? brand.teamName
      : "Operations"
  const brandAvatarUrl =
    brand.avatarUrl && brand.avatarUrl.trim().length > 0
      ? brand.avatarUrl
      : "/vercel.svg"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <Avatar className="rounded-lg">
                <AvatarImage src={brandAvatarUrl} alt={organizationName} />
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{organizationName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {teamName}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {canAccessApp ? (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isItemActive(pathname, item.url)}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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

      <SidebarFooter className="gap-3">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>

        <form action="/sign-out" method="post">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <LogOutIcon className="size-4" />
            <span>Sign out</span>
          </Button>
        </form>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
