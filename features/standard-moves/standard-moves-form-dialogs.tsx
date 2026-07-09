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
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

type StandardMoveFormSurface = "drawer" | "sheet"

function ScopeHiddenInputs({
  currentPage,
  loadMoreMode,
  scope,
  statusFilter,
}: {
  currentPage: number
  loadMoreMode: boolean
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
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMore" value="1" />
      ) : null}
    </>
  )
}

function StandardMoveDialogFieldset({
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

function StandardMoveDialogSubmitButton({
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

function StandardMoveDialogFooter({
  submitLabel,
  pendingLabel,
  canSubmit,
  surface,
}: {
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
  surface: StandardMoveFormSurface
}) {
  const button = (
    <StandardMoveDialogSubmitButton
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      canSubmit={canSubmit}
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

function StandardMoveDialogForm({
  initialValues,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  statusFilter,
  action,
  currentPage,
  loadMoreMode,
  surface,
}: {
  initialValues: StandardMoveFormInitialValues
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  statusFilter?: string
  action: (formData: FormData) => void | Promise<void>
  currentPage: number
  loadMoreMode: boolean
  surface: StandardMoveFormSurface
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const canSubmit = name.trim().length > 0
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const textareaClassName = isDrawerSurface
    ? "min-h-28 px-3 text-base md:text-sm"
    : undefined

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <ScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        scope={scope}
        statusFilter={statusFilter}
      />

      <StandardMoveDialogFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
            className={inputClassName}
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
            className={textareaClassName}
          />
        </div>
      </StandardMoveDialogFieldset>

      <StandardMoveDialogFooter
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        canSubmit={canSubmit}
        surface={surface}
      />
    </form>
  )
}

export function CreateStandardMoveDialog({
  scope,
  statusFilter,
  currentPage,
  loadMoreMode,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  scope: NavigationScope
  statusFilter?: string
  currentPage: number
  loadMoreMode: boolean
  disabled: boolean
  surface?: StandardMoveFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const isFabTrigger = triggerVariant === "fab"
  const createForm = (
    <StandardMoveDialogForm
      initialValues={{
        name: "",
        description: "",
      }}
      idPrefix={`create-standard-move-${surface}`}
      submitLabel="Create move"
      pendingLabel="Creating move..."
      scope={scope}
      statusFilter={statusFilter}
      action={createTeamStandardMoveAction}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      surface={surface}
    />
  )

  if (surface === "drawer") {
    return (
      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <button
          type="button"
          disabled={disabled}
          aria-label={isFabTrigger ? "New standard move" : undefined}
          aria-haspopup="dialog"
          aria-expanded={isCreateOpen}
          className={cn(
            buttonVariants({
              variant: isFabTrigger ? "default" : "outline",
              size: isFabTrigger ? "icon" : "default",
            }),
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3",
          )}
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New standard move</span> : "New"}
        </button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create Std. Move</DrawerTitle>
            <DrawerDescription>
              Add a reusable move to this team playbook.
            </DrawerDescription>
          </DrawerHeader>
          {createForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isCreateOpen}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        onClick={() => setIsCreateOpen(true)}
      >
        <PlusIcon className="size-4" />
        New
      </button>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create Std. Move</SheetTitle>
          <SheetDescription>
            Add a reusable move to this team playbook.
          </SheetDescription>
        </SheetHeader>
        {createForm}
      </SheetContent>
    </Sheet>
  )
}

export function EditStandardMoveDialog({
  standardMove,
  scope,
  statusFilter,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
  hideTrigger = false,
  surface = "sheet",
}: {
  standardMove: EditableStandardMove
  scope: NavigationScope
  statusFilter?: string
  currentPage: number
  loadMoreMode: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  surface?: StandardMoveFormSurface
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const editForm = (
    <StandardMoveDialogForm
      initialValues={{
        id: standardMove.id,
        name: standardMove.name,
        description: standardMove.description ?? "",
      }}
      idPrefix={`edit-standard-move-${standardMove.id}-${surface}`}
      submitLabel="Save"
      pendingLabel="Saving..."
      scope={scope}
      statusFilter={statusFilter}
      action={updateTeamStandardMoveAction}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      surface={surface}
    />
  )

  if (surface === "drawer") {
    return (
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        {!hideTrigger && !isOpenControlled ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isEditOpen}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-11 px-3",
            )}
            onClick={() => setIsEditOpen(true)}
          >
            <PencilIcon className="size-4" />
            Edit
          </button>
        ) : null}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit Std. Move</DrawerTitle>
            <DrawerDescription>{standardMove.name}</DrawerDescription>
          </DrawerHeader>
          {editForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
      {!hideTrigger && !isOpenControlled ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isEditOpen}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => setIsEditOpen(true)}
        >
          <PencilIcon className="size-4" />
          Edit
        </button>
      ) : null}
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit Std. Move</SheetTitle>
          <SheetDescription>{standardMove.name}</SheetDescription>
        </SheetHeader>
        {editForm}
      </SheetContent>
    </Sheet>
  )
}

export function StandardMoveActionsMenu({
  standardMove,
  scope,
  statusFilter,
  currentPage,
  loadMoreMode,
  canManageStandardMoves,
  surface = "sheet",
  triggerClassName,
}: {
  standardMove: EditableStandardMove
  scope: NavigationScope
  statusFilter?: string
  currentPage: number
  loadMoreMode: boolean
  canManageStandardMoves: boolean
  surface?: StandardMoveFormSurface
  triggerClassName?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false)
  const toggleStatusFormRef = React.useRef<HTMLFormElement | null>(null)
  const toggleAction = standardMove.isActive
    ? archiveTeamStandardMoveAction
    : restoreTeamStandardMoveAction
  const toggleLabel = standardMove.isActive ? "Archive" : "Restore"
  const togglePendingLabel = standardMove.isActive ? "Archiving..." : "Restoring..."

  if (!canManageStandardMoves) {
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
              disabled={isTogglingStatus}
              aria-busy={isTogglingStatus}
              className={triggerClassName}
            />
          }
          aria-label={`Open actions for ${standardMove.name}`}
        >
          {isTogglingStatus ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="size-4" />
          )}
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
            disabled={isTogglingStatus}
            onClick={() => {
              setIsTogglingStatus(true)
              toggleStatusFormRef.current?.requestSubmit()
            }}
            className="gap-2"
          >
            {isTogglingStatus ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {isTogglingStatus ? togglePendingLabel : toggleLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form action={toggleAction} ref={toggleStatusFormRef} className="hidden">
        <input type="hidden" name="id" value={standardMove.id} />
        <ScopeHiddenInputs
          currentPage={currentPage}
          loadMoreMode={loadMoreMode}
          scope={scope}
          statusFilter={statusFilter}
        />
      </form>

      <EditStandardMoveDialog
        standardMove={standardMove}
        scope={scope}
        statusFilter={statusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        surface={surface}
        hideTrigger
      />
    </>
  )
}
