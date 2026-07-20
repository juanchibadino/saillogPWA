"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  BellIcon,
  MailIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "@/features/notifications/actions"
import {
  applyNotificationDelete,
  applyNotificationMarkAllRead,
  applyNotificationReadState,
} from "@/features/notifications/core.mjs"
import type {
  NotificationCenterData,
  NotificationListItem,
} from "@/features/notifications/data"

type NotificationFilter = "all" | "unread"

type NotificationCenterClientProps = {
  initialData: NotificationCenterData
  mode: "popover" | "page"
  onDataChange?: (data: NotificationCenterData) => void
  onNavigate?: () => void
}

function getNotificationTitle(eventType: NotificationListItem["eventType"]): string {
  switch (eventType) {
    case "camp_goals_added":
      return "Camp goals"
    case "session_review_added":
      return "Session update"
    case "session_goals_added":
      return "Session goals"
    case "assessment_run_created":
      return "Assessment request"
    case "gear_warning":
      return "Gear warning"
    case "gear_critical":
      return "Gear critical"
    default:
      return "Notification"
  }
}

function canMutateNotification(notification: NotificationListItem): boolean {
  return notification.source === "persisted"
}

function formatNotificationDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Recently"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function NotificationCenterClient({
  initialData,
  mode,
  onDataChange,
  onNavigate,
}: NotificationCenterClientProps) {
  const router = useRouter()
  const [data, setData] = useState<NotificationCenterData>(initialData)
  const [filter, setFilter] = useState<NotificationFilter>("all")
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [isMarkAllPending, startMarkAllTransition] = useTransition()
  const [, startActionTransition] = useTransition()

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const visibleNotifications = useMemo(() => {
    if (filter === "unread") {
      return data.notifications.filter((notification) => !notification.readAt)
    }

    return data.notifications
  }, [data.notifications, filter])

  function applyDataUpdate(
    updater: (currentData: NotificationCenterData) => NotificationCenterData,
  ): void {
    setData((currentData) => {
      const nextData = updater(currentData)
      onDataChange?.(nextData)
      return nextData
    })
  }

  function setPending(id: string, pending: boolean): void {
    setPendingIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (pending) {
        nextIds.add(id)
      } else {
        nextIds.delete(id)
      }

      return nextIds
    })
  }

  function updateNotificationReadState(id: string, readAt: string | null): void {
    applyDataUpdate((currentData) => {
      return applyNotificationReadState(currentData, id, readAt)
    })
  }

  function removeNotification(id: string): void {
    applyDataUpdate((currentData) => {
      return applyNotificationDelete(currentData, id)
    })
  }

  function handleMarkRead(notification: NotificationListItem): void {
    if (
      !canMutateNotification(notification) ||
      notification.readAt ||
      pendingIds.has(notification.id)
    ) {
      return
    }

    setPending(notification.id, true)
    const readAt = new Date().toISOString()
    updateNotificationReadState(notification.id, readAt)
    startActionTransition(() => {
      void markNotificationReadAction(notification.id).then((result) => {
        setPending(notification.id, false)

        if (!result.ok) {
          router.refresh()
        }
      })
    })
  }

  function handleMarkUnread(notification: NotificationListItem): void {
    if (
      !canMutateNotification(notification) ||
      !notification.readAt ||
      pendingIds.has(notification.id)
    ) {
      return
    }

    setPending(notification.id, true)
    updateNotificationReadState(notification.id, null)
    startActionTransition(() => {
      void markNotificationUnreadAction(notification.id).then((result) => {
        setPending(notification.id, false)

        if (!result.ok) {
          router.refresh()
        }
      })
    })
  }

  function handleDelete(notification: NotificationListItem): void {
    if (!canMutateNotification(notification) || pendingIds.has(notification.id)) {
      return
    }

    setPending(notification.id, true)
    removeNotification(notification.id)
    startActionTransition(() => {
      void deleteNotificationAction(notification.id).then((result) => {
        setPending(notification.id, false)

        if (!result.ok) {
          router.refresh()
        }
      })
    })
  }

  function handleMarkAllRead(): void {
    if (data.unreadCount === 0 || isMarkAllPending) {
      return
    }

    const readAt = new Date().toISOString()
    applyDataUpdate((currentData) => applyNotificationMarkAllRead(currentData, readAt))
    startMarkAllTransition(() => {
      void markAllNotificationsReadAction().then((result) => {
        if (!result.ok) {
          router.refresh()
        }
      })
    })
  }

  function handleRowNavigate(notification: NotificationListItem): void {
    if (canMutateNotification(notification) && !notification.readAt) {
      handleMarkRead(notification)
    }

    onNavigate?.()
    router.push(notification.targetHref)
  }

  const containerClassName =
    mode === "popover"
      ? "flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl"
      : "flex min-h-full flex-col bg-background md:rounded-lg md:border md:bg-card"
  const listClassName =
    mode === "popover"
      ? "max-h-[24rem] overflow-y-auto"
      : "min-h-0 flex-1 overflow-y-auto md:max-h-[calc(100dvh-14rem)]"

  return (
    <section className={containerClassName} aria-label="Notifications">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Notifications</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={data.unreadCount === 0 || isMarkAllPending}
          onClick={handleMarkAllRead}
          className="h-8 shrink-0"
        >
          <MailOpenIcon className="size-3.5" />
          Mark all as read
        </Button>
      </div>
      <div className="border-b p-3">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value === "unread" ? "unread" : "all")
          }}
          className="w-full"
        >
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {visibleNotifications.length > 0 ? (
        <div className={listClassName}>
          {visibleNotifications.map((notification) => {
            const isUnread = !notification.readAt
            const isPending = pendingIds.has(notification.id)
            const canMutate = canMutateNotification(notification)

            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleRowNavigate(notification)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleRowNavigate(notification)
                  }
                }}
                className={cn(
                  "group flex cursor-pointer items-start gap-3 border-b p-4 text-left outline-none transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60",
                  isUnread ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-transparent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isUnread ? (
                      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                    ) : null}
                    <p className="truncate text-sm font-medium">
                      {getNotificationTitle(notification.eventType)}
                    </p>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatNotificationDate(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {notification.message}
                  </p>
                </div>
                {canMutate ? (
                  <div
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                          />
                        }
                        aria-label="Notification actions"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem
                          disabled={isPending || !isUnread}
                          onClick={() => {
                            handleMarkRead(notification)
                          }}
                        >
                          <MailOpenIcon className="size-4" />
                          Read
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isPending || isUnread}
                          onClick={() => {
                            handleMarkUnread(notification)
                          }}
                        >
                          <MailIcon className="size-4" />
                          Unread
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => {
                            handleDelete(notification)
                          }}
                        >
                          <Trash2Icon className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BellIcon className="size-5" />
          </span>
          <p className="text-sm font-medium">
            {filter === "unread" ? "No unread notifications" : "No notifications"}
          </p>
          <p className="max-w-64 text-sm text-muted-foreground">
            Updates from camps, sessions, and assessments will appear here.
          </p>
        </div>
      )}
    </section>
  )
}
