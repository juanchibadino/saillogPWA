"use client"

import * as React from "react"
import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createSessionAction,
  updateSessionAction,
} from "@/features/sessions/actions"
import type {
  TeamSessionCampOption,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

const NET_TIME_STEP_MINUTES = 15
const MAX_NET_TIME_MINUTES = 24 * 60

function clampNetTimeMinutes(minutes: number): number {
  return Math.min(Math.max(minutes, 0), MAX_NET_TIME_MINUTES)
}

function formatMinutesAsHoursInput(minutesValue: string): string {
  const minutes = Number.parseInt(minutesValue, 10)

  if (!Number.isFinite(minutes)) {
    return ""
  }

  return String(Number.parseFloat((minutes / 60).toFixed(2)))
}

function parseHoursInputToMinutes(hoursValue: string): string {
  const normalized = hoursValue.trim().replace(",", ".")

  if (normalized.length === 0) {
    return ""
  }

  const hours = Number.parseFloat(normalized)

  if (!Number.isFinite(hours)) {
    return ""
  }

  const roundedMinutes =
    Math.round((hours * 60) / NET_TIME_STEP_MINUTES) * NET_TIME_STEP_MINUTES

  return String(clampNetTimeMinutes(roundedMinutes))
}

function SessionDialogForm({
  campOptions,
  initialValues,
  idPrefix,
  submitLabel,
  scope,
  selectedVenueId,
  selectedCampId,
  currentPage,
  action,
  formId,
  onCanSubmitChange,
  showSubmitFooter = true,
}: {
  campOptions: TeamSessionCampOption[]
  initialValues: SessionFormInitialValues
  idPrefix: string
  submitLabel: string
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
  action: (formData: FormData) => Promise<void>
  formId?: string
  onCanSubmitChange?: (canSubmit: boolean) => void
  showSubmitFooter?: boolean
}) {
  const [campId, setCampId] = React.useState(initialValues.campId)
  const [sessionType, setSessionType] = React.useState(initialValues.sessionType)
  const [sessionDate, setSessionDate] = React.useState(initialValues.sessionDate)
  const [netTimeHours, setNetTimeHours] = React.useState(() =>
    formatMinutesAsHoursInput(initialValues.netTimeMinutes),
  )
  const [highlightedByCoach, setHighlightedByCoach] = React.useState(
    initialValues.highlightedByCoach,
  )

  const netTimeMinutes = parseHoursInputToMinutes(netTimeHours)
  const currentNetTimeMinutes =
    netTimeMinutes.length > 0 ? Number.parseInt(netTimeMinutes, 10) : 0
  const canSubmit = campId.length > 0 && sessionDate.length > 0
  React.useEffect(() => {
    onCanSubmitChange?.(canSubmit)
  }, [canSubmit, onCanSubmitChange])

  function adjustNetTimeMinutes(deltaMinutes: number): void {
    const nextMinutes = clampNetTimeMinutes(currentNetTimeMinutes + deltaMinutes)
    setNetTimeHours(formatMinutesAsHoursInput(String(nextMinutes)))
  }

  function normalizeNetTimeHours(): void {
    if (netTimeHours.trim().length === 0) {
      return
    }

    setNetTimeHours(formatMinutesAsHoursInput(netTimeMinutes))
  }

  return (
    <form id={formId} action={action} className="space-y-4">
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
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-campId`}>Camp</Label>
        <select
          id={`${idPrefix}-campId`}
          name="campId"
          required
          value={campId}
          onChange={(event) => setCampId(event.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
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
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-netTimeHours`}>Net time (hours)</Label>
          <input type="hidden" name="netTimeMinutes" value={netTimeMinutes} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Decrease net time by 15 minutes"
              disabled={currentNetTimeMinutes <= 0}
              onClick={() => adjustNetTimeMinutes(-NET_TIME_STEP_MINUTES)}
            >
              <MinusIcon className="size-4" />
            </Button>
            <Input
              id={`${idPrefix}-netTimeHours`}
              type="number"
              min={0}
              max={24}
              step={0.25}
              inputMode="decimal"
              value={netTimeHours}
              onChange={(event) => setNetTimeHours(event.target.value)}
              onBlur={normalizeNetTimeHours}
              className="text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Increase net time by 15 minutes"
              disabled={currentNetTimeMinutes >= MAX_NET_TIME_MINUTES}
              onClick={() => adjustNetTimeMinutes(NET_TIME_STEP_MINUTES)}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="highlightedByCoach"
          checked={highlightedByCoach}
          onChange={(event) => setHighlightedByCoach(event.target.checked)}
          className="size-4 rounded border-input"
        />
        Highlighted by coach
      </label>

      {showSubmitFooter ? (
        <DialogFooter>
          <Button type="submit" disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      ) : null}
    </form>
  )
}

export function CreateSessionDialog({
  campOptions,
  scope,
  selectedVenueId,
  selectedCampId,
  currentPage,
  disabled,
}: {
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
  disabled: boolean
}) {
  const [canSubmitCreate, setCanSubmitCreate] = React.useState(false)
  const defaultCampId =
    campOptions.find((option) => option.campId === selectedCampId)?.campId ??
    campOptions[0]?.campId ??
    ""
  const isMobile = useIsMobile()
  const createFormId = "create-session-form"

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={disabled}
            className="h-9 px-3"
          >
            <PlusIcon className="size-4" />
            New
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create session</DrawerTitle>
            <DrawerDescription>Add a session record to the selected camp.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
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
              scope={scope}
              selectedVenueId={selectedVenueId}
              selectedCampId={selectedCampId}
              currentPage={currentPage}
              action={createSessionAction}
            />
          </div>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
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
            scope={scope}
            selectedVenueId={selectedVenueId}
            selectedCampId={selectedCampId}
            currentPage={currentPage}
            formId={createFormId}
            action={createSessionAction}
            onCanSubmitChange={setCanSubmitCreate}
            showSubmitFooter={false}
          />
        </div>
        <div className="border-t border-border/60 bg-background px-4 pb-4">
          <DialogFooter>
            <Button type="submit" form={createFormId} disabled={!canSubmitCreate}>
              Create session
            </Button>
          </DialogFooter>
        </div>
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
  currentPage,
  iconOnly = false,
}: {
  session: EditableSession
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
  iconOnly?: boolean
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          {iconOnly ? (
            <Button variant="outline" size="icon-sm" aria-label="Edit session">
              <PencilIcon className="size-4" />
              <span className="sr-only">Edit</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <PencilIcon className="size-4" />
              Edit
            </Button>
          )}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit session</DrawerTitle>
            <DrawerDescription>{session.sessionDate}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
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
              scope={scope}
              selectedVenueId={selectedVenueId}
              selectedCampId={selectedCampId}
              currentPage={currentPage}
              action={updateSessionAction}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog>
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>{session.sessionDate}</DialogDescription>
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
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampId={selectedCampId}
          currentPage={currentPage}
          action={updateSessionAction}
        />
      </DialogContent>
    </Dialog>
  )
}
