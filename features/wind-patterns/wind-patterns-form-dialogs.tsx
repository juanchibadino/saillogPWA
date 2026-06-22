"use client"

import * as React from "react"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  archiveTeamVenueWindPatternAction,
  createTeamVenueWindPatternAction,
  restoreTeamVenueWindPatternAction,
  updateTeamVenueWindPatternAction,
} from "@/features/wind-patterns/actions"
import type { TeamVenueWindPatternListItem } from "@/features/wind-patterns/data"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type EditableWindPattern = Pick<
  TeamVenueWindPatternListItem,
  "id" | "name" | "description" | "isActive"
>

type WindPatternFormInitialValues = {
  id?: string
  name: string
  description: string
}

function ScopeHiddenInputs({
  scope,
  teamVenueId,
  statusFilter,
  year,
}: {
  scope: NavigationScope
  teamVenueId: string
  statusFilter?: string
  year?: number
}) {
  return (
    <>
      <input type="hidden" name="teamVenueId" value={teamVenueId} />
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {statusFilter ? <input type="hidden" name="scopeStatus" value={statusFilter} /> : null}
      {typeof year === "number" ? <input type="hidden" name="scopeYear" value={year} /> : null}
    </>
  )
}

function WindPatternDialogFieldset({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return <fieldset disabled={pending} className="space-y-4">{children}</fieldset>
}

function WindPatternDialogSubmitButton({
  submitLabel,
  pendingLabel,
  canSubmit,
}: {
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={!canSubmit || pending}>
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

function WindPatternDialogForm({
  initialValues,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  teamVenueId,
  statusFilter,
  year,
  action,
}: {
  initialValues: WindPatternFormInitialValues
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  teamVenueId: string
  statusFilter?: string
  year?: number
  action: (formData: FormData) => void | Promise<void>
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const canSubmit = name.trim().length > 0

  return (
    <form action={action} className="space-y-4">
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <ScopeHiddenInputs
        scope={scope}
        teamVenueId={teamVenueId}
        statusFilter={statusFilter}
        year={year}
      />

      <WindPatternDialogFieldset>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Thermal Left Shift"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-description`}>Description</Label>
          <Textarea
            id={`${idPrefix}-description`}
            name="description"
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional venue-specific pattern details."
          />
        </div>
      </WindPatternDialogFieldset>

      <DialogFooter>
        <WindPatternDialogSubmitButton
          submitLabel={submitLabel}
          pendingLabel={pendingLabel}
          canSubmit={canSubmit}
        />
      </DialogFooter>
    </form>
  )
}

export function CreateWindPatternDialog({
  scope,
  teamVenueId,
  statusFilter,
  year,
  disabled,
}: {
  scope: NavigationScope
  teamVenueId: string
  statusFilter?: string
  year?: number
  disabled: boolean
}) {
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
          <DialogTitle>Create Wind Pattern</DialogTitle>
          <DialogDescription>
            Add a reusable wind pattern for this venue and team.
          </DialogDescription>
        </DialogHeader>

        <WindPatternDialogForm
          initialValues={{
            name: "",
            description: "",
          }}
          idPrefix="create-wind-pattern"
          submitLabel="Create pattern"
          pendingLabel="Creating pattern..."
          scope={scope}
          teamVenueId={teamVenueId}
          statusFilter={statusFilter}
          year={year}
          action={createTeamVenueWindPatternAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditWindPatternDialog({
  windPattern,
  scope,
  teamVenueId,
  statusFilter,
  year,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  windPattern: EditableWindPattern
  scope: NavigationScope
  teamVenueId: string
  statusFilter?: string
  year?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && !isOpenControlled ? (
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <PencilIcon className="size-4" />
          Edit
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Wind Pattern</DialogTitle>
          <DialogDescription>{windPattern.name}</DialogDescription>
        </DialogHeader>

        <WindPatternDialogForm
          initialValues={{
            id: windPattern.id,
            name: windPattern.name,
            description: windPattern.description ?? "",
          }}
          idPrefix={`edit-wind-pattern-${windPattern.id}`}
          submitLabel="Save changes"
          pendingLabel="Saving changes..."
          scope={scope}
          teamVenueId={teamVenueId}
          statusFilter={statusFilter}
          year={year}
          action={updateTeamVenueWindPatternAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function WindPatternActionsMenu({
  windPattern,
  scope,
  teamVenueId,
  statusFilter,
  year,
  canManageWindPatterns,
}: {
  windPattern: EditableWindPattern
  scope: NavigationScope
  teamVenueId: string
  statusFilter?: string
  year?: number
  canManageWindPatterns: boolean
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const toggleStatusFormRef = React.useRef<HTMLFormElement | null>(null)
  const toggleAction = windPattern.isActive
    ? archiveTeamVenueWindPatternAction
    : restoreTeamVenueWindPatternAction

  if (!canManageWindPatterns) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="More actions unavailable">
        <MoreHorizontalIcon className="size-4" />
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label={`Open actions for ${windPattern.name}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setIsEditOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              toggleStatusFormRef.current?.requestSubmit()
            }}
          >
            {windPattern.isActive ? "Archive" : "Restore"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form action={toggleAction} ref={toggleStatusFormRef} className="hidden">
        <input type="hidden" name="id" value={windPattern.id} />
        <ScopeHiddenInputs
          scope={scope}
          teamVenueId={teamVenueId}
          statusFilter={statusFilter}
          year={year}
        />
      </form>

      <EditWindPatternDialog
        windPattern={windPattern}
        scope={scope}
        teamVenueId={teamVenueId}
        statusFilter={statusFilter}
        year={year}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        hideTrigger
      />
    </>
  )
}
