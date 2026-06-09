"use client"

import * as React from "react"
import { MoreVerticalIcon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createCampAction,
  deleteCampAction,
  updateCampAction,
} from "@/features/camps/actions"
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
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
  const isMobile = useIsMobile()
  const defaultTeamVenueId =
    teamVenueOptions.find((option) => option.venueId === selectedVenueId)?.teamVenueId ??
    teamVenueOptions[0]?.teamVenueId ??
    ""

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
            <DrawerTitle>Create camp</DrawerTitle>
            <DrawerDescription>Add a camp to one of the active team venues.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
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
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

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
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  camp: EditableCamp
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  currentPage: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const isMobile = useIsMobile()
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {!hideTrigger && !isOpenControlled ? (
          <DrawerTrigger asChild>
            <Button variant="outline" size="default" className="h-9 px-3">
              <PencilIcon className="size-4" />
              Edit
            </Button>
          </DrawerTrigger>
        ) : null}
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit camp</DrawerTitle>
            <DrawerDescription>{camp.name}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
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
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && !isOpenControlled ? (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <PencilIcon className="size-4" />
          Edit
        </DialogTrigger>
      ) : null}
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

function DeleteCampDialog({
  camp,
  scope,
  selectedVenueId,
  currentPage,
  open,
  onOpenChange,
}: {
  camp: EditableCamp
  scope: NavigationScope
  selectedVenueId?: string
  currentPage: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()

  const deleteCampContent = (
    <form action={deleteCampAction} className="space-y-4">
      <input type="hidden" name="id" value={camp.id} />
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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive">
          Remove
        </Button>
      </DialogFooter>
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Remove camp</DrawerTitle>
            <DrawerDescription>
              This will permanently remove <strong>{camp.name}</strong> and all sessions
              linked to it.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">{deleteCampContent}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove camp</DialogTitle>
          <DialogDescription>
            This will permanently remove <strong>{camp.name}</strong> and all sessions
            linked to it.
          </DialogDescription>
        </DialogHeader>
        {deleteCampContent}
      </DialogContent>
    </Dialog>
  )
}

export function CampActionsMenu({
  camp,
  teamVenueOptions,
  scope,
  selectedVenueId,
  currentPage,
  canEditCamp,
  canDeleteCamp,
}: {
  camp: EditableCamp
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  currentPage: number
  canEditCamp: boolean
  canDeleteCamp: boolean
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label={`Open actions for ${camp.name}`}
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!canEditCamp}
            onClick={() => {
              setIsEditOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDeleteCamp}
            onClick={() => {
              setIsDeleteOpen(true)
            }}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canEditCamp ? (
        <EditCampDialog
          camp={camp}
          teamVenueOptions={teamVenueOptions}
          scope={scope}
          selectedVenueId={selectedVenueId}
          currentPage={currentPage}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          hideTrigger
        />
      ) : null}

      {canDeleteCamp ? (
        <DeleteCampDialog
          camp={camp}
          scope={scope}
          selectedVenueId={selectedVenueId}
          currentPage={currentPage}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
        />
      ) : null}
    </>
  )
}
