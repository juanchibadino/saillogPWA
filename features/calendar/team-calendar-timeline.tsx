"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import {
  CalendarDaysIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react"

import {
  setCalendarPresenceAction,
  setCalendarPresenceRangeAction,
} from "@/features/calendar/actions"
import {
  DeleteCalendarEventDialog,
  EditCalendarEventDialog,
  type EditableCalendarEvent,
} from "@/features/calendar/calendar-event-dialogs"
import type {
  TeamCalendarChromeData,
  TeamCalendarMemberOption,
  TeamCalendarTimelineDayItem,
  TeamCalendarTimelineItem,
  TeamCalendarTimelineMember,
} from "@/features/calendar/data"
import { GradientCard } from "@/components/shared/gradient-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

function formatDateParts(dateKey: string): { day: string; month: string } {
  const date = new Date(`${dateKey}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return {
      day: dateKey.slice(-2),
      month: dateKey.slice(5, 7),
    }
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(date)
  const day = parts.find((part) => part.type === "day")?.value ?? dateKey.slice(-2)
  const month =
    parts.find((part) => part.type === "month")?.value.toUpperCase() ??
    dateKey.slice(5, 7)

  return {
    day,
    month,
  }
}

function formatGapLabel(startDate: string, endDate: string): string {
  const start = formatDateParts(startDate)
  const end = formatDateParts(endDate)

  if (startDate === endDate) {
    return `(${start.day} ${start.month})`
  }

  return `(${start.day} ${start.month} ... ${end.day} ${end.month})`
}

function getEventBadgeLabel(item: TeamCalendarTimelineDayItem): string {
  if (item.eventType === "camp") {
    return "Camp"
  }

  if (item.eventType === "meeting") {
    return "Meeting"
  }

  if (item.eventType === "travel") {
    return "Travel"
  }

  if (item.eventType === "logistics") {
    return "Logistics"
  }

  return "Other"
}

function getEventBadgeClassName(item: TeamCalendarTimelineDayItem): string {
  if (item.eventType === "camp") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200"
  }

  if (item.eventType === "travel") {
    return "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/60 dark:bg-pink-950/40 dark:text-pink-200"
  }

  if (item.eventType === "meeting") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
}

function CalendarDateBadge({ date }: { date: string }) {
  const parts = formatDateParts(date)

  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-background text-center">
      <span className="text-[0.65rem] font-semibold uppercase leading-none text-muted-foreground">
        {parts.month}
      </span>
      <span className="mt-1 text-lg font-semibold leading-none">{parts.day}</span>
    </div>
  )
}

function CurrentDayBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <span className="size-2 rounded-full bg-emerald-500" />
      Current Day
    </span>
  )
}

function PresenceAvatarStack({
  addButton,
  members,
}: {
  addButton?: React.ReactNode
  members: TeamCalendarTimelineMember[]
}) {
  const visibleMembers = members.slice(0, 5)
  const remainingCount = Math.max(0, members.length - visibleMembers.length)

  return (
    <div className="flex min-w-0 -space-x-2">
      {visibleMembers.map((member) => (
        <Avatar
          key={member.id}
          className="size-10 border-2 border-emerald-500 ring-2 ring-background"
          title={`${member.name} - ${member.roleLabel}`}
        >
          {member.avatarUrl ? (
            <AvatarImage src={member.avatarUrl} alt={member.name} />
          ) : null}
          <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 ? (
        <span className="flex size-10 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
          +{remainingCount}
        </span>
      ) : null}
      {addButton}
    </div>
  )
}

function toTimelineMember(
  member: TeamCalendarMemberOption,
): TeamCalendarTimelineMember {
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    roleLabel: member.roleLabel,
    avatarUrl: member.avatarUrl,
  }
}

function PresencePlusSubmitButton({
  disabled,
}: {
  disabled: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="secondary"
      size="icon"
      disabled={disabled || pending}
      aria-busy={pending}
      aria-label="Add my presence"
      className="size-10 rounded-full border-2 border-background bg-muted text-muted-foreground shadow-none hover:bg-muted/80"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <PlusIcon className="size-5" />
      )}
    </Button>
  )
}

function CalendarHiddenScopeFields({
  chromeData,
  returnPath,
  scope,
}: {
  chromeData: TeamCalendarChromeData
  returnPath: string
  scope: NavigationScope
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {chromeData.selectedMemberId ? (
        <input type="hidden" name="scopeMemberId" value={chromeData.selectedMemberId} />
      ) : null}
      {chromeData.selectedEventFilter ? (
        <input type="hidden" name="scopeEvent" value={chromeData.selectedEventFilter.value} />
      ) : null}
      <input type="hidden" name="scopeTime" value={chromeData.selectedTimeFilter} />
      <input type="hidden" name="scopeReturnPath" value={returnPath} />
    </>
  )
}

function TeamPresenceControl({
  canEditTargetPresence,
  chromeData,
  isTargetPresent,
  item,
  onOptimisticPresenceChange,
  presentMembers,
  returnPath,
  scope,
}: {
  canEditTargetPresence: boolean
  chromeData: TeamCalendarChromeData
  isTargetPresent: boolean
  item: TeamCalendarTimelineDayItem
  onOptimisticPresenceChange: (isPresent: boolean) => void
  presentMembers: TeamCalendarTimelineMember[]
  returnPath: string
  scope: NavigationScope
}) {
  const targetMember = chromeData.targetMember
  const targetTimelineMember = targetMember ? toTimelineMember(targetMember) : null
  const disabled = !targetTimelineMember || !canEditTargetPresence

  async function addPresenceAction(formData: FormData): Promise<void> {
    if (targetTimelineMember && !isTargetPresent) {
      onOptimisticPresenceChange(true)
    }

    await setCalendarPresenceAction(formData)
  }

  return (
    <PresenceAvatarStack
      members={presentMembers}
      addButton={
        !isTargetPresent ? (
          <form action={addPresenceAction}>
            <CalendarHiddenScopeFields
              chromeData={chromeData}
              returnPath={returnPath}
              scope={scope}
            />
            <input type="hidden" name="sourceType" value={item.sourceType} />
            <input type="hidden" name="sourceId" value={item.sourceId} />
            <input type="hidden" name="presenceDate" value={item.date} />
            <input type="hidden" name="profileId" value={targetMember?.id ?? ""} />
            <input type="hidden" name="isPresent" value="true" />
            <PresencePlusSubmitButton disabled={disabled} />
          </form>
        ) : null
      }
    />
  )
}

function getEditableEvent(item: TeamCalendarTimelineDayItem): EditableCalendarEvent | null {
  if (
    item.sourceType !== "event" ||
    item.eventType === "camp" ||
    item.eventType === null
  ) {
    return null
  }

  return {
    id: item.sourceId,
    title: item.title,
    eventType: item.eventType,
    startDate: item.startDate,
    endDate: item.endDate,
    notes: item.notes,
  }
}

function EventTitle({
  isCurrentDay,
  item,
}: {
  isCurrentDay: boolean
  item: TeamCalendarTimelineDayItem
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge
        variant="outline"
        className={cn("shrink-0 rounded-md", getEventBadgeClassName(item))}
      >
        {getEventBadgeLabel(item)}
      </Badge>
      <span className="min-w-0 truncate text-base font-semibold">
        {item.title}
        {item.venueName ? (
          <span className="font-normal text-muted-foreground">, {item.venueName}</span>
        ) : null}
      </span>
      {isCurrentDay ? <CurrentDayBadge /> : null}
    </div>
  )
}

function CalendarRowActionsMenu({
  canEditTargetPresence,
  canManageCustomEvents,
  chromeData,
  item,
  onOptimisticPresenceChange,
  returnPath,
  scope,
  surface,
}: {
  canEditTargetPresence: boolean
  canManageCustomEvents: boolean
  chromeData: TeamCalendarChromeData
  item: TeamCalendarTimelineDayItem
  onOptimisticPresenceChange: (isPresent: boolean) => void
  returnPath: string
  scope: NavigationScope
  surface: "drawer" | "sheet"
}) {
  const targetMember = chromeData.targetMember
  const markAllFormRef = React.useRef<HTMLFormElement | null>(null)
  const clearAllFormRef = React.useRef<HTMLFormElement | null>(null)
  const [pendingAction, setPendingAction] = React.useState<"present" | "clear" | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const editableEvent = getEditableEvent(item)
  const hasRangeActions = item.startDate !== item.endDate
  const hasCustomEventActions = canManageCustomEvents && editableEvent !== null
  const rangeActionsDisabled =
    !targetMember ||
    !canEditTargetPresence ||
    pendingAction !== null

  if (!hasRangeActions && !hasCustomEventActions) {
    return null
  }

  async function markAllPresenceAction(formData: FormData): Promise<void> {
    setPendingAction("present")
    onOptimisticPresenceChange(true)

    try {
      await setCalendarPresenceRangeAction(formData)
    } finally {
      setPendingAction(null)
    }
  }

  async function clearAllPresenceAction(formData: FormData): Promise<void> {
    setPendingAction("clear")
    onOptimisticPresenceChange(false)

    try {
      await setCalendarPresenceRangeAction(formData)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pendingAction !== null}
              aria-busy={pendingAction !== null}
              className="h-9 w-9"
            />
          }
          aria-label={`Open actions for ${item.title}`}
        >
          {pendingAction !== null ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {hasRangeActions ? (
            <>
              <DropdownMenuItem
                disabled={rangeActionsDisabled}
                onClick={() => markAllFormRef.current?.requestSubmit()}
                className="gap-2"
              >
                {pendingAction === "present" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {pendingAction === "present" ? "Saving..." : "All Events"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={rangeActionsDisabled}
                onClick={() => clearAllFormRef.current?.requestSubmit()}
                className="gap-2"
              >
                {pendingAction === "clear" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {pendingAction === "clear" ? "Saving..." : "Clear All"}
              </DropdownMenuItem>
            </>
          ) : null}
          {hasRangeActions && hasCustomEventActions ? <DropdownMenuSeparator /> : null}
          {hasCustomEventActions ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setIsEditOpen(true)
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setIsDeleteOpen(true)
                }}
              >
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasRangeActions ? (
        <>
          <form action={markAllPresenceAction} ref={markAllFormRef} className="hidden">
            <CalendarHiddenScopeFields
              chromeData={chromeData}
              returnPath={returnPath}
              scope={scope}
            />
            <input type="hidden" name="sourceType" value={item.sourceType} />
            <input type="hidden" name="sourceId" value={item.sourceId} />
            <input type="hidden" name="profileId" value={targetMember?.id ?? ""} />
            <input type="hidden" name="isPresent" value="true" />
          </form>
          <form action={clearAllPresenceAction} ref={clearAllFormRef} className="hidden">
            <CalendarHiddenScopeFields
              chromeData={chromeData}
              returnPath={returnPath}
              scope={scope}
            />
            <input type="hidden" name="sourceType" value={item.sourceType} />
            <input type="hidden" name="sourceId" value={item.sourceId} />
            <input type="hidden" name="profileId" value={targetMember?.id ?? ""} />
            <input type="hidden" name="isPresent" value="false" />
          </form>
        </>
      ) : null}

      {editableEvent && hasCustomEventActions ? (
        <>
          <EditCalendarEventDialog
            event={editableEvent}
            scope={scope}
            selectedMemberId={chromeData.selectedMemberId}
            selectedEventValue={chromeData.selectedEventFilter?.value ?? ""}
            selectedTimeFilter={chromeData.selectedTimeFilter}
            returnPath={returnPath}
            surface={surface}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            hideTrigger
          />
          <DeleteCalendarEventDialog
            event={editableEvent}
            scope={scope}
            selectedMemberId={chromeData.selectedMemberId}
            selectedEventValue={chromeData.selectedEventFilter?.value ?? ""}
            selectedTimeFilter={chromeData.selectedTimeFilter}
            returnPath={returnPath}
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
          />
        </>
      ) : null}
    </>
  )
}

function CalendarDayCard({
  canEditTargetPresence,
  canManageCustomEvents,
  chromeData,
  item,
  returnPath,
  scope,
  today,
}: {
  canEditTargetPresence: boolean
  canManageCustomEvents: boolean
  chromeData: TeamCalendarChromeData
  item: TeamCalendarTimelineDayItem
  returnPath: string
  scope: NavigationScope
  today: string
}) {
  const isMobile = useIsMobile()
  const targetMember = chromeData.targetMember
  const targetMemberId = targetMember?.id ?? null
  const targetTimelineMember = React.useMemo(
    () => (targetMember ? toTimelineMember(targetMember) : null),
    [targetMember],
  )
  const baseTargetIsPresent = targetMember
    ? item.presentMembers.some((member) => member.id === targetMember.id)
    : false
  const [presenceOverride, setPresenceOverride] = React.useState<
    "present" | "absent" | null
  >(null)
  const presentMembers = React.useMemo(() => {
    if (!targetTimelineMember || presenceOverride === null) {
      return item.presentMembers
    }

    if (presenceOverride === "absent") {
      return item.presentMembers.filter((member) => member.id !== targetTimelineMember.id)
    }

    if (item.presentMembers.some((member) => member.id === targetTimelineMember.id)) {
      return item.presentMembers
    }

    return [...item.presentMembers, targetTimelineMember]
  }, [item.presentMembers, presenceOverride, targetTimelineMember])
  const isTargetPresent = targetMember
    ? presentMembers.some((member) => member.id === targetMember.id)
    : false
  const isCurrentDay = item.date === today

  React.useEffect(() => {
    if (!targetMemberId) {
      if (presenceOverride !== null) {
        setPresenceOverride(null)
      }
      return
    }

    if (presenceOverride === null) {
      return
    }

    if (presenceOverride === "present" && baseTargetIsPresent) {
      setPresenceOverride(null)
      return
    }

    if (presenceOverride === "absent" && !baseTargetIsPresent) {
      setPresenceOverride(null)
    }
  }, [baseTargetIsPresent, presenceOverride, targetMemberId])

  return (
    <GradientCard
      className={cn(
        "overflow-hidden p-3 md:p-4",
        isCurrentDay &&
          "border-emerald-500/70 ring-2 ring-emerald-500/20 dark:border-emerald-400/70 dark:ring-emerald-400/20",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CalendarDateBadge date={item.date} />
        <div className="min-w-0 flex-1">
          <EventTitle isCurrentDay={isCurrentDay} item={item} />
        </div>

        <div className="shrink-0">
          <TeamPresenceControl
            canEditTargetPresence={canEditTargetPresence}
            chromeData={chromeData}
            isTargetPresent={isTargetPresent}
            item={item}
            onOptimisticPresenceChange={(isPresent) =>
              setPresenceOverride(isPresent ? "present" : "absent")
            }
            presentMembers={presentMembers}
            returnPath={returnPath}
            scope={scope}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <CalendarRowActionsMenu
            canEditTargetPresence={canEditTargetPresence}
            canManageCustomEvents={canManageCustomEvents}
            chromeData={chromeData}
            item={item}
            onOptimisticPresenceChange={(isPresent) =>
              setPresenceOverride(isPresent ? "present" : "absent")
            }
            returnPath={returnPath}
            scope={scope}
            surface={isMobile ? "drawer" : "sheet"}
          />
        </div>
      </div>
    </GradientCard>
  )
}

function CalendarGapRow({
  endDate,
  startDate,
}: {
  endDate: string
  startDate: string
}) {
  return (
    <div className="flex items-center justify-center px-4 py-2 text-xs font-medium text-muted-foreground">
      <span className="rounded-full border bg-muted/40 px-3 py-1">
        {formatGapLabel(startDate, endDate)}
      </span>
    </div>
  )
}

export function TeamCalendarTimeline({
  canEditTargetPresence,
  canManageCustomEvents,
  chromeData,
  items,
  noTeamSelected,
  returnPath,
  scope,
  today,
}: {
  canEditTargetPresence: boolean
  canManageCustomEvents: boolean
  chromeData: TeamCalendarChromeData
  items: TeamCalendarTimelineItem[]
  noTeamSelected: boolean
  returnPath: string
  scope: NavigationScope
  today: string
}) {
  if (noTeamSelected) {
    return (
      <section className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Select a team to load calendar events.
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-dashed p-6 text-center">
        <CalendarDaysIcon className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No calendar days found.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust filters or add a custom event.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      {items.map((item) =>
        item.type === "gap" ? (
          <CalendarGapRow
            key={item.timelineId}
            startDate={item.startDate}
            endDate={item.endDate}
          />
        ) : (
          <CalendarDayCard
            key={item.timelineId}
            canEditTargetPresence={canEditTargetPresence}
            canManageCustomEvents={canManageCustomEvents}
            chromeData={chromeData}
            item={item}
            returnPath={returnPath}
            scope={scope}
            today={today}
          />
        ),
      )}
    </section>
  )
}
