"use client"

import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

function getSectionTitle(pathname: string): string {
  if (pathname.startsWith("/venues")) {
    return "Venues"
  }

  if (pathname.startsWith("/dashboard")) {
    return "Home"
  }

  return "Sailog"
}

export function SiteHeader() {
  const pathname = usePathname()
  const sectionTitle = getSectionTitle(pathname)

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-8"
        />
        <h1 className="text-base font-medium">{sectionTitle}</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
