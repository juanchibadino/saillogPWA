"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  onFocusOutside,
  onPointerDownOutside,
  onSubmitCapture,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  function isPortaledInteractiveEventTarget(event: Event): boolean {
    const target = event.target

    return (
      target instanceof HTMLElement &&
      Boolean(
        target.closest(
          [
            '[data-slot="dialog-content"]',
            '[data-slot="dialog-overlay"]',
            '[data-slot="dropdown-menu-content"]',
            '[data-slot="select-content"]',
          ].join(", "),
        ),
      )
    )
  }

  function isKeyboardInputElement(element: HTMLElement): boolean {
    return element.matches(
      [
        'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="reset"])',
        "textarea",
        "select",
        '[contenteditable="true"]',
      ].join(", "),
    )
  }

  function releaseMobileKeyboardOffset(content: HTMLElement) {
    if (
      typeof window === "undefined" ||
      content.getAttribute("data-vaul-drawer-direction") !== "bottom"
    ) {
      return
    }

    const activeElement = document.activeElement

    if (
      !(activeElement instanceof HTMLElement) ||
      !content.contains(activeElement) ||
      !isKeyboardInputElement(activeElement)
    ) {
      return
    }

    activeElement.blur()

    const visualViewport = window.visualViewport
    let timeoutId = 0
    let hasReset = false

    function clearKeyboardStyles() {
      content.style.removeProperty("bottom")
      content.style.removeProperty("height")
    }

    function cleanup() {
      if (timeoutId !== 0) {
        window.clearTimeout(timeoutId)
      }

      visualViewport?.removeEventListener("resize", resetAfterViewportSettles)
    }

    function resetAfterViewportSettles() {
      if (hasReset) {
        return
      }

      hasReset = true
      cleanup()

      window.requestAnimationFrame(() => {
        clearKeyboardStyles()
        window.setTimeout(clearKeyboardStyles, 80)
      })
    }

    if (visualViewport && visualViewport.height < window.innerHeight - 60) {
      visualViewport.addEventListener("resize", resetAfterViewportSettles, {
        once: true,
      })
      timeoutId = window.setTimeout(resetAfterViewportSettles, 320)
      return
    }

    resetAfterViewportSettles()
  }

  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-popover text-sm text-popover-foreground data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[var(--mobile-drawer-max-height)] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[var(--mobile-drawer-max-height)] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          className
        )}
        onFocusOutside={(event) => {
          onFocusOutside?.(event)

          if (isPortaledInteractiveEventTarget(event.detail.originalEvent)) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event)

          if (isPortaledInteractiveEventTarget(event.detail.originalEvent)) {
            event.preventDefault()
          }
        }}
        onSubmitCapture={(event) => {
          onSubmitCapture?.(event)

          if (!event.defaultPrevented) {
            releaseMobileKeyboardOffset(event.currentTarget)
          }
        }}
        {...props}
      >
        <div className="mx-auto my-5 hidden h-1 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 pt-1 pb-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-0.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 p-4 pb-[calc(1rem+var(--safe-area-bottom))]",
        className,
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
