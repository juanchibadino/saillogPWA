"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpCircleIcon,
  BriefcaseBusinessIcon,
  FileTextIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
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
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin",
    email: "backoffice@marcos.local",
    avatar: "",
  },
  navGroups: [
    {
      label: "Gestion",
      items: [
        {
          title: "Dashboard",
          url: "/admin/dashboard",
          icon: LayoutDashboardIcon,
        },
      ],
    },
    {
      label: "Abastecimiento",
      items: [
        {
          title: "Catalogo",
          url: "/admin/catalog",
          icon: StoreIcon,
        },
        {
          title: "Compras",
          url: "/admin/purchases",
          icon: ShoppingCartIcon,
        },
        {
          title: "Stock",
          url: "/admin/stock",
          icon: PackageIcon,
        },
      ],
    },
    {
      label: "Operacion",
      items: [
        {
          title: "Jobs",
          url: "/admin/jobs",
          icon: BriefcaseBusinessIcon,
        },
      ],
    },
    {
      label: "Ventas",
      items: [
        {
          title: "Leads",
          url: "/admin/leads",
          icon: UsersIcon,
        },
        {
          title: "Quotes",
          url: "/admin/quotes",
          icon: FileTextIcon,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Configurador publico",
      url: "/configurador",
      icon: GlobeIcon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin/dashboard" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ArrowUpCircleIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Marcos</span>
                <span className="truncate text-xs text-muted-foreground">
                  Backoffice
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
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
        ))}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Accesos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
