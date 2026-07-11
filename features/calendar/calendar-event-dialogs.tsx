"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "@/features/calendar/actions"
import type { TeamCalendarTimeFilter } from "@/features/calendar/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type CalendarEventFormSurface = "drawer" | "sheet"
type CalendarEventFormAction = (formData: FormData) => Promise<void>

export type EditableCalendarEvent = {
  id: string
  title: string
  eventType: "meeting" | "travel" | "logistics" | "other"
  startDate: string
  endDate: string
  notes: string | null
}

type CalendarEventScopeFields = {
  scope: NavigationScope
  selectedEventValue?: string | null
  selectedMemberId?: string | null
  selectedTimeFilter: TeamCalendarTimeFilter
  returnPath?: string
}

function CalendarEventFields({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={pending}
      className={cn(
        "space-y-4 disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      {children}
    </fieldset>
  )
}

function CalendarEventSubmitButton({
  canSubmit,
  className,
  pendingLabel,
  submitLabel,
}: {
  canSubmit: boolean
  className?: string
  pendingLabel: string
  submitLabel: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={!canSubmit || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        submitLabel
      )}
    </Button>
  )
}

function DeleteCalendarEventSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Deleting...
        </>
      ) : (
        "Delete"
      )}
    </Button>
  )
}

function DeleteCalendarEventDialogFooter({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onCancel}
      >
        Cancel
      </Button>
      <DeleteCalendarEventSubmitButton />
    </DialogFooter>
  )
}

function CalendarEventFooter({
  canSubmit,
  pendingLabel,
  submitLabel,
  surface,
}: {
  canSubmit: boolean
  pendingLabel: string
  submitLabel: string
  surface: CalendarEventFormSurface
}) {
  const button = (
    <CalendarEventSubmitButton
      canSubmit={canSubmit}
      pendingLabel={pendingLabel}
      submitLabel={submitLabel}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:justify-end">
      {button}
    </SheetFooter>
  )
}

function CalendarEventHiddenScopeFields({
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
}: CalendarEventScopeFields) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedMemberId ? (
        <input type="hidden" name="scopeMemberId" value={selectedMemberId} />
      ) : null}
      {selectedEventValue ? (
        <input type="hidden" name="scopeEvent" value={selectedEventValue} />
      ) : null}
      <input type="hidden" name="scopeTime" value={selectedTimeFilter} />
      {returnPath ? (
        <input type="hidden" name="scopeReturnPath" value={returnPath} />
      ) : null}
    </>
  )
}

function CalendarEventDialogForm({
  action,
  initialValues,
  idPrefix,
  pendingLabel,
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
  submitLabel,
  surface,
}: CalendarEventScopeFields & {
  action: CalendarEventFormAction
  idPrefix: string
  initialValues: EditableCalendarEvent | null
  pendingLabel: string
  submitLabel: string
  surface: CalendarEventFormSurface
}) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "")
  const [eventType, setEventType] = React.useState<
    EditableCalendarEvent["eventType"]
  >(initialValues?.eventType ?? "meeting")
  const [startDate, setStartDate] = React.useState(initialValues?.startDate ?? "")
  const [endDate, setEndDate] = React.useState(initialValues?.endDate ?? "")
  const [notes, setNotes] = React.useState(initialValues?.notes ?? "")
  const canSubmit =
    title.trim().length > 0 && startDate.length > 0 && endDate.length > 0
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {initialValues ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <CalendarEventHiddenScopeFields
        scope={scope}
        selectedMemberId={selectedMemberId}
        selectedEventValue={selectedEventValue}
        selectedTimeFilter={selectedTimeFilter}
        returnPath={returnPath}
      />

      <CalendarEventFields className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-title`}>Title</Label>
          <Input
            id={`${idPrefix}-title`}
            name="title"
            type="text"
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-event-type`}>Type</Label>
            <select
              id={`${idPrefix}-event-type`}
              name="eventType"
              required
              value={eventType}
              onChange={(event) =>
                setEventType(event.target.value as EditableCalendarEvent["eventType"])
              }
              className={selectClassName}
            >
              <option value="meeting">Meeting</option>
              <option value="travel">Travel</option>
              <option value="logistics">Logistics</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-start-date`}>Start date</Label>
            <Input
              id={`${idPrefix}-start-date`}
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-end-date`}>End date</Label>
            <Input
              id={`${idPrefix}-end-date`}
              name="endDate"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
          <textarea
            id={`${idPrefix}-notes`}
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={4000}
            rows={isDrawerSurface ? 5 : 4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </CalendarEventFields>

      <CalendarEventFooter
        canSubmit={canSubmit}
        pendingLabel={pendingLabel}
        submitLabel={submitLabel}
        surface={surface}
      />
    </form>
  )
}

export function CreateCalendarEventDialog({
  disabled,
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
  surface = "sheet",
  triggerVariant = "default",
}: CalendarEventScopeFields & {
  disabled: boolean
  surface?: CalendarEventFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [open, setOpen] = React.useState(false)
  const isFabTrigger = triggerVariant === "fab"

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New event" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3"
          }
          onClick={() => setOpen(true)}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New event</span> : "New"}
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create event</DrawerTitle>
            <DrawerDescription>Add a team calendar event.</DrawerDescription>
          </DrawerHeader>

          <CalendarEventDialogForm
            action={createCalendarEventAction}
            idPrefix="create-calendar-event-drawer"
            initialValues={null}
            pendingLabel="Creating..."
            submitLabel="Create event"
            surface="drawer"
            scope={scope}
            selectedMemberId={selectedMemberId}
            selectedEventValue={selectedEventValue}
            selectedTimeFilter={selectedTimeFilter}
            returnPath={returnPath}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
          />
        }
      >
        <PlusIcon className="size-4" />
        New
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create event</SheetTitle>
          <SheetDescription>Add a team calendar event.</SheetDescription>
        </SheetHeader>

        <CalendarEventDialogForm
          action={createCalendarEventAction}
          idPrefix="create-calendar-event-sheet"
          initialValues={null}
          pendingLabel="Creating..."
          submitLabel="Create event"
          surface="sheet"
          scope={scope}
          selectedMemberId={selectedMemberId}
          selectedEventValue={selectedEventValue}
          selectedTimeFilter={selectedTimeFilter}
          returnPath={returnPath}
        />
      </SheetContent>
    </Sheet>
  )
}

export function EditCalendarEventDialog({
  event,
  hideTrigger = false,
  onOpenChange,
  open,
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
  surface = "sheet",
}: CalendarEventScopeFields & {
  event: EditableCalendarEvent
  hideTrigger?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  surface?: CalendarEventFormSurface
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  if (surface === "drawer") {
    return (
      <Drawer open={isOpen} onOpenChange={setOpen}>
        {!hideTrigger ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className="h-11 px-3"
            onClick={() => setOpen(true)}
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
        ) : null}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit event</DrawerTitle>
            <DrawerDescription>{event.title}</DrawerDescription>
          </DrawerHeader>

          <CalendarEventDialogForm
            action={updateCalendarEventAction}
            idPrefix={`edit-calendar-event-${event.id}-drawer`}
            initialValues={event}
            pendingLabel="Saving..."
            submitLabel="Save"
            surface="drawer"
            scope={scope}
            selectedMemberId={selectedMemberId}
            selectedEventValue={selectedEventValue}
            selectedTimeFilter={selectedTimeFilter}
            returnPath={returnPath}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit event"
              className="h-9 w-9"
            />
          }
        >
          <PencilIcon className="size-4" />
        </SheetTrigger>
      ) : null}
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit event</SheetTitle>
          <SheetDescription>{event.title}</SheetDescription>
        </SheetHeader>

        <CalendarEventDialogForm
          action={updateCalendarEventAction}
          idPrefix={`edit-calendar-event-${event.id}-sheet`}
          initialValues={event}
          pendingLabel="Saving..."
          submitLabel="Save"
          surface="sheet"
          scope={scope}
          selectedMemberId={selectedMemberId}
          selectedEventValue={selectedEventValue}
          selectedTimeFilter={selectedTimeFilter}
          returnPath={returnPath}
        />
      </SheetContent>
    </Sheet>
  )
}

export function DeleteCalendarEventDialog({
  event,
  onOpenChange,
  open,
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
}: CalendarEventScopeFields & {
  event: EditableCalendarEvent
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Delete event</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{event.title}</strong> and all
            presence linked to it.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteCalendarEventAction} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />
          <CalendarEventHiddenScopeFields
            scope={scope}
            selectedMemberId={selectedMemberId}
            selectedEventValue={selectedEventValue}
            selectedTimeFilter={selectedTimeFilter}
            returnPath={returnPath}
          />
          <DeleteCalendarEventDialogFooter onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  )
}
