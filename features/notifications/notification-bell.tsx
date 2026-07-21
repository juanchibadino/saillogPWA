"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { BellIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NotificationCenterClient } from "@/features/notifications/notification-center-client"
import type { NotificationCenterData } from "@/features/notifications/data"

type NotificationBellProps = {
  initialData: NotificationCenterData
  notificationsHref: string
  className?: string
}

const NOTIFICATION_ACTIONS_MENU_SELECTOR = "[data-notification-actions-menu]"

export function NotificationBell({
  initialData,
  notificationsHref,
  className,
}: NotificationBellProps) {
  const [data, setData] = useState<NotificationCenterData>(initialData)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const hasUnreadNotifications = data.unreadCount > 0

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target

      if (
        target instanceof Element &&
        target.closest(NOTIFICATION_ACTIONS_MENU_SELECTOR)
      ) {
        return
      }

      if (
        wrapperRef.current &&
        target instanceof Node &&
        !wrapperRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <Link
        href={notificationsHref}
        type="button"
        tabIndex={0}
        data-slot="button"
        aria-label={
          hasUnreadNotifications
            ? `${data.unreadCount} unread notifications`
            : "Notifications"
        }
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative md:hidden",
          className,
        )}
      >
        <BellIcon className="size-4" />
        {hasUnreadNotifications ? (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        ) : null}
      </Link>
      <div ref={wrapperRef} className={cn("relative hidden md:block", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            hasUnreadNotifications
              ? `${data.unreadCount} unread notifications`
              : "Notifications"
          }
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((currentValue) => !currentValue)
          }}
          className="relative"
        >
          <BellIcon className="size-4" />
          {hasUnreadNotifications ? (
            <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          ) : null}
        </Button>
        {isOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-[min(26rem,calc(100vw-2rem))]">
            <NotificationCenterClient
              initialData={data}
              mode="popover"
              onDataChange={setData}
              onNavigate={() => {
                setIsOpen(false)
              }}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}
