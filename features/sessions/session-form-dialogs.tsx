"use client"

import * as React from "react"
import { PencilIcon, PlusIcon } from "lucide-react"

import {
  createSessionAction,
  updateSessionAction,
} from "@/features/sessions/actions"
import type {
  TeamSessionCampOption,
  TeamSessionListItem,
} from "@/features/sessions/data"
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
}) {
  const [campId, setCampId] = React.useState(initialValues.campId)
  const [sessionType, setSessionType] = React.useState(initialValues.sessionType)
  const [sessionDate, setSessionDate] = React.useState(initialValues.sessionDate)
  const [netTimeMinutes, setNetTimeMinutes] = React.useState(initialValues.netTimeMinutes)
  const [highlightedByCoach, setHighlightedByCoach] = React.useState(
    initialValues.highlightedByCoach,
  )

  const canSubmit = campId.length > 0 && sessionDate.length > 0

  return (
    <form action={action} className="space-y-4">
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
          <Label htmlFor={`${idPrefix}-netTimeMinutes`}>Net time (minutes)</Label>
          <Input
            id={`${idPrefix}-netTimeMinutes`}
            name="netTimeMinutes"
            type="number"
            min={0}
            max={24 * 60}
            step={1}
            value={netTimeMinutes}
            onChange={(event) => setNetTimeMinutes(event.target.value)}
            placeholder="Optional"
          />
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

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </DialogFooter>
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
  const defaultCampId =
    campOptions.find((option) => option.campId === selectedCampId)?.campId ??
    campOptions[0]?.campId ??
    ""

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create session</DialogTitle>
          <DialogDescription>
            Add a session record to the selected camp.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  )
}

export function EditSessionDialog({
  session,
  campOptions,
  scope,
  selectedVenueId,
  selectedCampId,
  currentPage,
}: {
  session: EditableSession
  campOptions: TeamSessionCampOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampId?: string
  currentPage: number
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PencilIcon className="size-4" />
        Edit
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
