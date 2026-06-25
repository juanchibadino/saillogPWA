"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

export type ResponsiveEditSurfaceKind = "drawer" | "sheet"

export type ResponsiveEditSurfaceProps = {
  children: (input: {
    isMobile: boolean
    surface: ResponsiveEditSurfaceKind
  }) => React.ReactNode
  description?: React.ReactNode
  drawerContentClassName?: string
  hideDrawerTitle?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  sheetContentClassName?: string
  title: string
  triggerClassName?: string
  triggerLabel?: string
}

export function ResponsiveEditSurface({
  children,
  description,
  drawerContentClassName = "max-h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]",
  hideDrawerTitle = false,
  onOpenChange,
  open,
  sheetContentClassName = "h-full overflow-hidden sm:max-w-2xl",
  title,
  triggerClassName = "h-9 px-3",
  triggerLabel = "Edit",
}: ResponsiveEditSurfaceProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" size="default" className={triggerClassName}>
            {triggerLabel}
          </Button>
        </DrawerTrigger>
        <DrawerContent className={drawerContentClassName}>
          {hideDrawerTitle ? (
            <DrawerHeader className="sr-only">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? <DrawerDescription>{description}</DrawerDescription> : null}
            </DrawerHeader>
          ) : (
            <DrawerHeader className="shrink-0">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? <DrawerDescription>{description}</DrawerDescription> : null}
            </DrawerHeader>
          )}
          {children({ isMobile, surface: "drawer" })}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {triggerLabel}
      </SheetTrigger>
      <SheetContent side="right" className={sheetContentClassName}>
        <SheetHeader className="shrink-0">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        {children({ isMobile, surface: "sheet" })}
      </SheetContent>
    </Sheet>
  )
}
