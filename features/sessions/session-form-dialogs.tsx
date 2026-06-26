"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import {
  Loader2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"

import {
  createSessionAction,
  deleteSessionAction,
  updateSessionAction,
} from "@/features/sessions/list-actions"
import type {
  TeamSessionCampOption,
  TeamSessionHighlightFilter,
  TeamSessionListItem,
} from "@/features/sessions/data"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type SessionFormInitialValues = {
  id?: string
  campId: string
  sessionType: "training" | "regatta"
  sessionDate: string
  netTimeMinutes: string
  highlightedByCoach: boolean
}

type EditableSession = Pick<
  TeamSessionListItem,
  "id" | "campId" | "sessionType" | "sessionDate" | "netTimeMinutes" | "highlightedByCoach"
>

type SessionFormSurface = "drawer" | "sheet" | "dialog"
type SessionFormFooter = SessionFormSurface | "none"

const NET_TIME_STEP_MINUTES = 15
const MAX_NET_TIME_MINUTES = 24 * 60

function clampNetTimeMinutes(minutes: number): number {
  return Math.min(Math.max(minutes, 0), MAX_NET_TIME_MINUTES)
}

function formatMinutesAsDurationInput(minutesValue: string): string {
  const minutes = Number.parseInt(minutesValue, 10)

  if (!Number.isFinite(minutes)) {
    return ""
  }

  const clampedMinutes = clampNetTimeMinutes(minutes)
  const hours = Math.floor(clampedMinutes / 60)
  const remainingMinutes = clampedMinutes % 60

  if (hours <= 0) {
    return `${remainingMinutes}m`
  }

  return `${hours}h ${remainingMinutes}m`
}

function parseDurationInputToMinutes(durationValue: string): string {
  const normalized = durationValue.trim().toLowerCase().replace(",", ".")

  if (normalized.length === 0) {
    return ""
  }

  const compactHoursMinutesMatch = normalized.match(
    /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+(?:\.\d+)?)\s*m?)?$/,
  )

  if (compactHoursMinutesMatch) {
    const hours = Number.parseFloat(compactHoursMinutesMatch[1] ?? "0")
    const minutes = Number.parseFloat(compactHoursMinutesMatch[2] ?? "0")
    const roundedMinutes =
      Math.round((hours * 60 + minutes) / NET_TIME_STEP_MINUTES) * NET_TIME_STEP_MINUTES

    return String(clampNetTimeMinutes(roundedMinutes))
  }

  const unitsMatch = Array.from(
    normalized.matchAll(
      /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/g,
    ),
  )

  if (unitsMatch.length > 0) {
    const consumed = unitsMatch.reduce((value, match) => value.replace(match[0], ""), normalized)

    if (consumed.trim().length > 0) {
      return ""
    }

    const totalMinutes = unitsMatch.reduce((minutesTotal, match) => {
      const value = Number.parseFloat(match[1] ?? "0")
      const unit = match[2] ?? ""

      return unit.startsWith("h") ? minutesTotal + value * 60 : minutesTotal + value
    }, 0)

    const roundedMinutes =
      Math.round(totalMinutes / NET_TIME_STEP_MINUTES) * NET_TIME_STEP_MINUTES

    return String(clampNetTimeMinutes(roundedMinutes))
  }

  const clockMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/)

  if (clockMatch) {
    const hours = Number.parseFloat(clockMatch[1] ?? "0")
    const minutes = Number.parseFloat(clockMatch[2] ?? "0")
    const roundedMinutes =
      Math.round((hours * 60 + minutes) / NET_TIME_STEP_MINUTES) * NET_TIME_STEP_MINUTES

    return String(clampNetTimeMinutes(roundedMinutes))
  }

  const decimalHoursMatch = normalized.match(/^\d+(?:\.\d+)?$/)

  if (!decimalHoursMatch) {
    return ""
  }

  const hours = Number.parseFloat(decimalHoursMatch[0])
  const roundedMinutes =
    Math.round((hours * 60) / NET_TIME_STEP_MINUTES) * NET_TIME_STEP_MINUTES

  return String(clampNetTimeMinutes(roundedMinutes))
}

function formatSessionDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return formatter.format(new Date(`${value}T00:00:00.000Z`))
}

function SessionDialogFields({
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

function SessionDialogSubmitButton({
  submitLabel,
  pendingLabel,
  canSubmit,
  className,
}: {
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
  className?: string
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

function SessionDeleteSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="destructive" disabled={pending} aria-busy={pending}>
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

function SessionDialogSubmitFooter({
  footer,
  submitLabel,
  pendingLabel,
  canSubmit,
}: {
  footer: SessionFormFooter
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
}) {
  if (footer === "none") {
    return null
  }

  const button = (
    <SessionDialogSubmitButton
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      canSubmit={canSubmit}
      className={footer === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (footer === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  if (footer === "sheet") {
    return (
      <SheetFooter className="shrink-0 border-t sm:justify-end">
        {button}
      </SheetFooter>
    )
  }

  return <DialogFooter>{button}</DialogFooter>
}

function SessionDialogForm({
  campOptions,
  initialValues,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  action,
  formId,
  footer = "dialog",
  fieldsClassName,
  surface = "dialog",
}: {
  campOptions: TeamSessionCampOption[]
  initialValues: SessionFormInitialValues
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  action: (formData: FormData) => Promise<void>
  formId?: string
  footer?: SessionFormFooter
  fieldsClassName?: string
  surface?: SessionFormSurface
}) {
  const [campId, setCampId] = React.useState(initialValues.campId)
  const [sessionType, setSessionType] = React.useState(initialValues.sessionType)
  const [sessionDate, setSessionDate] = React.useState(initialValues.sessionDate)
  const [netTimeDuration, setNetTimeDuration] = React.useState(() =>
    formatMinutesAsDurationInput(initialValues.netTimeMinutes),
  )
  const [highlightedByCoach, setHighlightedByCoach] = React.useState(
    initialValues.highlightedByCoach,
  )

  const netTimeMinutes = parseDurationInputToMinutes(netTimeDuration)
  const currentNetTimeMinutes =
    netTimeMinutes.length > 0 ? Number.parseInt(netTimeMinutes, 10) : 0
  const canSubmit = campId.length > 0 && sessionDate.length > 0
  const isDrawerSurface = surface === "drawer"
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const stepButtonClassName = isDrawerSurface ? "h-11 w-11" : undefined
  const stepButtonSize = isDrawerSurface ? "icon" : "icon-sm"
  const hasFixedFooter = footer === "drawer" || footer === "sheet"

  function adjustNetTimeMinutes(deltaMinutes: number): void {
    const nextMinutes = clampNetTimeMinutes(currentNetTimeMinutes + deltaMinutes)
    setNetTimeDuration(formatMinutesAsDurationInput(String(nextMinutes)))
  }

  function normalizeNetTimeDuration(): void {
    if (netTimeDuration.trim().length === 0) {
      return
    }

    setNetTimeDuration(formatMinutesAsDurationInput(netTimeMinutes))
  }

  return (
    <form
      id={formId}
      action={action}
      className={cn(
        hasFixedFooter ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "space-y-4",
      )}
    >
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedVenueId ? (
        <input type="hidden" name="scopeVenueId" value={selectedVenueId} />
      ) : null}
      {selectedCampId ? (
        <input type="hidden" name="scopeCampId" value={selectedCampId} />
      ) : null}
      {selectedHighlight ? (
        <input type="hidden" name="scopeHighlight" value={selectedHighlight} />
      ) : null}
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      <input type="hidden" name="netTimeMinutes" value={netTimeMinutes} />

      <SessionDialogFields
        className={cn(
          hasFixedFooter && "min-h-0 flex-1 overflow-y-auto",
          fieldsClassName,
        )}
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-campId`}>Camp</Label>
          <select
            id={`${idPrefix}-campId`}
            name="campId"
            required
            value={campId}
            onChange={(event) => setCampId(event.target.value)}
            className={selectClassName}
          >
            <option value="">Select camp</option>
            {campOptions.map((option) => (
              <option key={option.campId} value={option.campId}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-sessionType`}>Session type</Label>
            <select
              id={`${idPrefix}-sessionType`}
              name="sessionType"
              required
              value={sessionType}
              onChange={(event) =>
                setSessionType(event.target.value as SessionFormInitialValues["sessionType"])
              }
              className={selectClassName}
            >
              <option value="training">Training</option>
              <option value="regatta">Regatta</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-sessionDate`}>Date</Label>
            <Input
              id={`${idPrefix}-sessionDate`}
              name="sessionDate"
              type="date"
              required
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-netTimeDuration`}>Net time</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size={stepButtonSize}
                aria-label="Decrease net time by 15 minutes"
                disabled={currentNetTimeMinutes <= 0}
                className={stepButtonClassName}
                onClick={() => adjustNetTimeMinutes(-NET_TIME_STEP_MINUTES)}
              >
                <MinusIcon className="size-4" />
              </Button>
              <Input
                id={`${idPrefix}-netTimeDuration`}
                type="text"
                value={netTimeDuration}
                onChange={(event) => setNetTimeDuration(event.target.value)}
                onBlur={normalizeNetTimeDuration}
                className={cn("text-center tabular-nums", inputClassName)}
              />
              <Button
                type="button"
                variant="outline"
                size={stepButtonSize}
                aria-label="Increase net time by 15 minutes"
                disabled={currentNetTimeMinutes >= MAX_NET_TIME_MINUTES}
                className={stepButtonClassName}
                onClick={() => adjustNetTimeMinutes(NET_TIME_STEP_MINUTES)}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <Label
          className={cn(
            "flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm font-medium",
            isDrawerSurface && "min-h-14 px-4",
          )}
        >
          <span>Highlighted by coach</span>
          <Switch
            name="highlightedByCoach"
            checked={highlightedByCoach}
            onCheckedChange={setHighlightedByCoach}
            aria-label="Highlighted by coach"
          />
        </Label>
      </SessionDialogFields>

      <SessionDialogSubmitFooter
        footer={footer}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        canSubmit={canSubmit}
      />
    </form>
  )
}

export function CreateSessionDialog({
  campOptions,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  disabled,
  surface,
  triggerVariant = "default",
}: {
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  disabled: boolean
  surface?: Extract<SessionFormSurface, "drawer" | "sheet">
  triggerVariant?: "default" | "fab"
}) {
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = React.useState(false)
  const defaultCampId =
    campOptions.find((option) => option.campId === selectedCampId)?.campId ??
    campOptions[0]?.campId ??
    ""
  const isMobile = useIsMobile()
  const resolvedSurface = surface ?? (isMobile ? "drawer" : "sheet")
  const createFormId = `create-session-form-${resolvedSurface}`

  if (resolvedSurface === "drawer") {
    const isFabTrigger = triggerVariant === "fab"

    return (
      <Drawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New session" : undefined}
          aria-haspopup="dialog"
          aria-expanded={isCreateDrawerOpen}
          className={
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3"
          }
          onClick={() => setIsCreateDrawerOpen(true)}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New session</span> : "New"}
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerTitle className="sr-only">Create session</DrawerTitle>
          <DrawerDescription className="sr-only">
            Add a session record to the selected camp.
          </DrawerDescription>
          <SessionDialogForm
            campOptions={campOptions}
            initialValues={{
              campId: defaultCampId,
              sessionType: "training",
              sessionDate: "",
              netTimeMinutes: "",
              highlightedByCoach: false,
            }}
            idPrefix="create-session"
            submitLabel="Create session"
            pendingLabel="Creating..."
            scope={scope}
            selectedVenueId={selectedVenueId}
            selectedCampId={selectedCampId}
            selectedHighlight={selectedHighlight}
            currentPage={currentPage}
            action={createSessionAction}
            formId={createFormId}
            footer="drawer"
            fieldsClassName="px-4 pb-6"
            surface="drawer"
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
      <SheetContent side="right" className="flex h-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Create session</SheetTitle>
          <SheetDescription>Add a session record to the selected camp.</SheetDescription>
        </SheetHeader>

        <SessionDialogForm
          campOptions={campOptions}
          initialValues={{
            campId: defaultCampId,
            sessionType: "training",
            sessionDate: "",
            netTimeMinutes: "",
            highlightedByCoach: false,
          }}
          idPrefix="create-session"
          submitLabel="Create session"
          pendingLabel="Creating..."
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampId={selectedCampId}
          selectedHighlight={selectedHighlight}
          currentPage={currentPage}
          formId={createFormId}
          action={createSessionAction}
          footer="sheet"
          fieldsClassName="px-4 pb-4"
          surface="sheet"
        />
      </SheetContent>
    </Sheet>
  )
}

export function EditSessionDialog({
  session,
  campOptions,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  iconOnly = false,
  surface,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  session: EditableSession
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  iconOnly?: boolean
  surface?: Extract<SessionFormSurface, "drawer" | "dialog">
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const isMobile = useIsMobile()
  const resolvedSurface = surface ?? (isMobile ? "drawer" : "dialog")
  const editFormId = `edit-session-${session.id}-${resolvedSurface}-form`

  if (resolvedSurface === "drawer") {
    return (
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        {!hideTrigger && iconOnly ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Edit session"
            aria-haspopup="dialog"
            aria-expanded={isEditOpen}
            className="h-11 w-11"
            onClick={() => setIsEditOpen(true)}
          >
            <PencilIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
        ) : null}
        {!hideTrigger && !iconOnly ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            aria-haspopup="dialog"
            aria-expanded={isEditOpen}
            className="h-11 px-3"
            onClick={() => setIsEditOpen(true)}
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
        ) : null}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerTitle className="sr-only">{session.sessionDate}</DrawerTitle>
          <DrawerDescription className="sr-only">Edit session details.</DrawerDescription>
          <SessionDialogForm
            campOptions={campOptions}
            initialValues={{
              id: session.id,
              campId: session.campId,
              sessionType: session.sessionType,
              sessionDate: session.sessionDate,
              netTimeMinutes:
                typeof session.netTimeMinutes === "number"
                  ? String(session.netTimeMinutes)
                  : "",
              highlightedByCoach: session.highlightedByCoach,
            }}
            idPrefix={`edit-session-${session.id}`}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            scope={scope}
            selectedVenueId={selectedVenueId}
            selectedCampId={selectedCampId}
            selectedHighlight={selectedHighlight}
            currentPage={currentPage}
            action={updateSessionAction}
            formId={editFormId}
            footer="drawer"
            fieldsClassName="px-4 pb-6"
            surface="drawer"
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpenControlled ? open : undefined} onOpenChange={setIsEditOpen}>
      {!hideTrigger ? (
        <DialogTrigger
          render={
            iconOnly ? (
              <Button variant="outline" size="icon-sm" aria-label="Edit session" />
            ) : (
              <Button variant="outline" size="sm" />
            )
          }
        >
          <PencilIcon className="size-4" />
          {iconOnly ? <span className="sr-only">Edit</span> : "Edit"}
        </DialogTrigger>
      ) : null}
      <DialogContent
        className="sm:max-w-xl"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>{session.sessionDate}</DialogTitle>
          <DialogDescription>Edit session details.</DialogDescription>
        </DialogHeader>

        <SessionDialogForm
          campOptions={campOptions}
          initialValues={{
            id: session.id,
            campId: session.campId,
            sessionType: session.sessionType,
            sessionDate: session.sessionDate,
            netTimeMinutes:
              typeof session.netTimeMinutes === "number"
                ? String(session.netTimeMinutes)
                : "",
            highlightedByCoach: session.highlightedByCoach,
          }}
          idPrefix={`edit-session-${session.id}`}
          submitLabel="Save changes"
          pendingLabel="Saving..."
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampId={selectedCampId}
          selectedHighlight={selectedHighlight}
          currentPage={currentPage}
          action={updateSessionAction}
          footer="dialog"
          surface="dialog"
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteSessionDialog({
  session,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  open,
  onOpenChange,
}: {
  session: EditableSession
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sessionLabel = formatSessionDateLabel(session.sessionDate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Delete session</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{sessionLabel}</strong> and its
            linked setup, results, goals, gear, wind patterns, moves, and assets.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteSessionAction} className="space-y-4">
          <input type="hidden" name="id" value={session.id} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedVenueId ? (
            <input type="hidden" name="scopeVenueId" value={selectedVenueId} />
          ) : null}
          {selectedCampId ? (
            <input type="hidden" name="scopeCampId" value={selectedCampId} />
          ) : null}
          {selectedHighlight ? (
            <input type="hidden" name="scopeHighlight" value={selectedHighlight} />
          ) : null}
          {currentPage > 1 ? (
            <input type="hidden" name="scopePage" value={String(currentPage)} />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SessionDeleteSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SessionActionsMenu({
  session,
  campOptions,
  scope,
  selectedVenueId,
  selectedCampId,
  selectedHighlight,
  currentPage,
  canEditSession,
  canDeleteSession,
  editSurface,
  triggerClassName,
}: {
  session: EditableSession
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  selectedHighlight?: TeamSessionHighlightFilter
  currentPage: number
  canEditSession: boolean
  canDeleteSession: boolean
  editSurface?: Extract<SessionFormSurface, "drawer" | "dialog">
  triggerClassName?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  if (!canEditSession && !canDeleteSession) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="More actions unavailable"
        className={triggerClassName}
      >
        <MoreHorizontalIcon className="size-4" />
      </Button>
    )
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
              className={triggerClassName}
            />
          }
          aria-label={`Open actions for ${formatSessionDateLabel(session.sessionDate)}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditSession ? (
            <DropdownMenuItem
              onClick={() => {
                setIsEditOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : null}
          {canDeleteSession ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setIsDeleteOpen(true)
              }}
            >
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEditSession ? (
        <EditSessionDialog
          session={session}
          campOptions={campOptions}
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampId={selectedCampId}
          selectedHighlight={selectedHighlight}
          currentPage={currentPage}
          surface={editSurface}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          hideTrigger
        />
      ) : null}

      {canDeleteSession ? (
        <DeleteSessionDialog
          session={session}
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampId={selectedCampId}
          selectedHighlight={selectedHighlight}
          currentPage={currentPage}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
        />
      ) : null}
    </>
  )
}
