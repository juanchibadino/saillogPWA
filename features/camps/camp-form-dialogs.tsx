"use client"

import * as React from "react"
import { PencilIcon, PlusIcon } from "lucide-react"

import { createCampAction, updateCampAction } from "@/features/camps/actions"
import type { TeamCampListItem, TeamCampVenueOption } from "@/features/camps/data"
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

type CampFormInitialValues = {
  id?: string
  teamVenueId: string
  name: string
  campType: "training" | "regatta" | "mixed"
  startDate: string
  endDate: string
  isActive?: boolean
}

type EditableCamp = Pick<
  TeamCampListItem,
  "id" | "teamVenueId" | "name" | "campType" | "startDate" | "endDate" | "isActive"
>

function CampDialogForm({
  teamVenueOptions,
  initialValues,
  includeIsActive,
  idPrefix,
  submitLabel,
  scope,
  selectedVenueId,
  currentPage,
  action,
}: {
  teamVenueOptions: TeamCampVenueOption[]
  initialValues: CampFormInitialValues
  includeIsActive: boolean
  idPrefix: string
  submitLabel: string
  scope: NavigationScope
  selectedVenueId?: string
  currentPage: number
  action: (formData: FormData) => Promise<void>
}) {
  const [teamVenueId, setTeamVenueId] = React.useState(initialValues.teamVenueId)
  const [name, setName] = React.useState(initialValues.name)
  const [campType, setCampType] = React.useState(initialValues.campType)
  const [startDate, setStartDate] = React.useState(initialValues.startDate)
  const [endDate, setEndDate] = React.useState(initialValues.endDate)

  const canSubmit =
    teamVenueId.length > 0 &&
    name.trim().length > 0 &&
    campType.length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0

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
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-teamVenueId`}>Venue</Label>
        <select
          id={`${idPrefix}-teamVenueId`}
          name="teamVenueId"
          required
          value={teamVenueId}
          onChange={(event) => setTeamVenueId(event.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Select venue</option>
          {teamVenueOptions.map((option) => (
            <option key={option.teamVenueId} value={option.teamVenueId}>
              {option.venueName} — {option.venueLocation}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-name`}>Camp name</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-campType`}>Camp type</Label>
          <select
            id={`${idPrefix}-campType`}
            name="campType"
            required
            value={campType}
            onChange={(event) => setCampType(event.target.value as CampFormInitialValues["campType"])}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="training">Training</option>
            <option value="regatta">Regatta</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-startDate`}>Start date</Label>
          <Input
            id={`${idPrefix}-startDate`}
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-endDate`}>End date</Label>
          <Input
            id={`${idPrefix}-endDate`}
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      {includeIsActive ? (
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialValues.isActive}
            className="size-4 rounded border-input"
          />
          Active camp
        </label>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateCampDialog({
  teamVenueOptions,
  scope,
  selectedVenueId,
  currentPage,
  disabled,
}: {
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  currentPage: number
  disabled: boolean
}) {
  const defaultTeamVenueId =
    teamVenueOptions.find((option) => option.venueId === selectedVenueId)?.teamVenueId ??
    teamVenueOptions[0]?.teamVenueId ??
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
          <DialogTitle>Create camp</DialogTitle>
          <DialogDescription>
            Add a camp to one of the active team venues.
          </DialogDescription>
        </DialogHeader>

        <CampDialogForm
          teamVenueOptions={teamVenueOptions}
          initialValues={{
            teamVenueId: defaultTeamVenueId,
            name: "",
            campType: "training",
            startDate: "",
            endDate: "",
          }}
          includeIsActive={false}
          idPrefix="create-camp"
          submitLabel="Create camp"
          scope={scope}
          selectedVenueId={selectedVenueId}
          currentPage={currentPage}
          action={createCampAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditCampDialog({
  camp,
  teamVenueOptions,
  scope,
  selectedVenueId,
  currentPage,
}: {
  camp: EditableCamp
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
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
          <DialogTitle>Edit camp</DialogTitle>
          <DialogDescription>{camp.name}</DialogDescription>
        </DialogHeader>

        <CampDialogForm
          teamVenueOptions={teamVenueOptions}
          initialValues={{
            id: camp.id,
            teamVenueId: camp.teamVenueId,
            name: camp.name,
            campType: camp.campType,
            startDate: camp.startDate,
            endDate: camp.endDate,
            isActive: camp.isActive,
          }}
          includeIsActive
          idPrefix={`edit-camp-${camp.id}`}
          submitLabel="Save changes"
          scope={scope}
          selectedVenueId={selectedVenueId}
          currentPage={currentPage}
          action={updateCampAction}
        />
      </DialogContent>
    </Dialog>
  )
}
