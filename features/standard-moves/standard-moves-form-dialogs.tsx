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
  archiveTeamStandardMoveAction,
  createTeamStandardMoveAction,
  restoreTeamStandardMoveAction,
  updateTeamStandardMoveAction,
} from "@/features/standard-moves/actions"
import type { TeamStandardMoveListItem } from "@/features/standard-moves/data"
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

type EditableStandardMove = Pick<
  TeamStandardMoveListItem,
  "id" | "name" | "description" | "isActive"
>

type StandardMoveFormInitialValues = {
  id?: string
  name: string
  description: string
}

function ScopeHiddenInputs({
  scope,
  statusFilter,
}: {
  scope: NavigationScope
  statusFilter?: string
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {statusFilter ? <input type="hidden" name="scopeStatus" value={statusFilter} /> : null}
    </>
  )
}

function StandardMoveDialogFieldset({
  children,
}: {
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return <fieldset disabled={pending} className="space-y-4">{children}</fieldset>
}

function StandardMoveDialogSubmitButton({
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

function StandardMoveDialogForm({
  initialValues,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  statusFilter,
  action,
}: {
  initialValues: StandardMoveFormInitialValues
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  statusFilter?: string
  action: (formData: FormData) => void | Promise<void>
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const canSubmit = name.trim().length > 0

  return (
    <form action={action} className="space-y-4">
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <ScopeHiddenInputs scope={scope} statusFilter={statusFilter} />

      <StandardMoveDialogFieldset>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Pin-End Port Exit"
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
            placeholder="Optional context and intent."
          />
        </div>
      </StandardMoveDialogFieldset>

      <DialogFooter>
        <StandardMoveDialogSubmitButton
          submitLabel={submitLabel}
          pendingLabel={pendingLabel}
          canSubmit={canSubmit}
        />
      </DialogFooter>
    </form>
  )
}

export function CreateStandardMoveDialog({
  scope,
  statusFilter,
  disabled,
}: {
  scope: NavigationScope
  statusFilter?: string
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
          <DialogTitle>Create Std. Move</DialogTitle>
          <DialogDescription>
            Add a reusable move to this team playbook.
          </DialogDescription>
        </DialogHeader>

        <StandardMoveDialogForm
          initialValues={{
            name: "",
            description: "",
          }}
          idPrefix="create-standard-move"
          submitLabel="Create move"
          pendingLabel="Creating move..."
          scope={scope}
          statusFilter={statusFilter}
          action={createTeamStandardMoveAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditStandardMoveDialog({
  standardMove,
  scope,
  statusFilter,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  standardMove: EditableStandardMove
  scope: NavigationScope
  statusFilter?: string
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
          <DialogTitle>Edit Std. Move</DialogTitle>
          <DialogDescription>{standardMove.name}</DialogDescription>
        </DialogHeader>

        <StandardMoveDialogForm
          initialValues={{
            id: standardMove.id,
            name: standardMove.name,
            description: standardMove.description ?? "",
          }}
          idPrefix={`edit-standard-move-${standardMove.id}`}
          submitLabel="Save changes"
          pendingLabel="Saving changes..."
          scope={scope}
          statusFilter={statusFilter}
          action={updateTeamStandardMoveAction}
        />
      </DialogContent>
    </Dialog>
  )
}

export function StandardMoveActionsMenu({
  standardMove,
  scope,
  statusFilter,
  canManageStandardMoves,
}: {
  standardMove: EditableStandardMove
  scope: NavigationScope
  statusFilter?: string
  canManageStandardMoves: boolean
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const toggleStatusFormRef = React.useRef<HTMLFormElement | null>(null)
  const toggleAction = standardMove.isActive
    ? archiveTeamStandardMoveAction
    : restoreTeamStandardMoveAction

  if (!canManageStandardMoves) {
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
          aria-label={`Open actions for ${standardMove.name}`}
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
            {standardMove.isActive ? "Archive" : "Restore"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form action={toggleAction} ref={toggleStatusFormRef} className="hidden">
        <input type="hidden" name="id" value={standardMove.id} />
        <ScopeHiddenInputs scope={scope} statusFilter={statusFilter} />
      </form>

      <EditStandardMoveDialog
        standardMove={standardMove}
        scope={scope}
        statusFilter={statusFilter}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        hideTrigger
      />
    </>
  )
}
