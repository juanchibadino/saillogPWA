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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type EditableWindPattern = Pick<
  TeamVenueWindPatternListItem,
  "id" | "name" | "description" | "isActive"
>

type WindPatternFormInitialValues = {
  id?: string
  name: string
  description: string
}

type WindPatternFormSurface = "dialog" | "drawer"

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

function WindPatternDialogFieldset({
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

function WindPatternDialogSubmitButton({
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
  formId,
  surface = "dialog",
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
  formId?: string
  surface?: WindPatternFormSurface
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const canSubmit = name.trim().length > 0
  const isDrawerSurface = surface === "drawer"

  return (
    <form
      id={formId}
      action={action}
      className={cn(
        isDrawerSurface
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "space-y-4",
      )}
    >
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <ScopeHiddenInputs
        scope={scope}
        teamVenueId={teamVenueId}
        statusFilter={statusFilter}
        year={year}
      />

      <WindPatternDialogFieldset
        className={isDrawerSurface ? "min-h-0 flex-1 overflow-y-auto px-4 py-4" : undefined}
      >
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
            className={isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined}
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
            className={
              isDrawerSurface
                ? "min-h-24 px-3 py-2 text-base md:text-sm"
                : undefined
            }
          />
        </div>
      </WindPatternDialogFieldset>

      {isDrawerSurface ? (
        <DrawerFooter className="shrink-0 border-t">
          <WindPatternDialogSubmitButton
            submitLabel={submitLabel}
            pendingLabel={pendingLabel}
            canSubmit={canSubmit}
            className="h-11 w-full"
          />
        </DrawerFooter>
      ) : (
        <DialogFooter>
          <WindPatternDialogSubmitButton
            submitLabel={submitLabel}
            pendingLabel={pendingLabel}
            canSubmit={canSubmit}
          />
        </DialogFooter>
      )}
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
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const createFormId = `create-wind-pattern-${isMobile ? "drawer" : "dialog"}-form`

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            disabled={disabled}
            aria-label="New wind pattern"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
          >
            <PlusIcon className="size-6" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create Wind Pattern</DrawerTitle>
            <DrawerDescription>
              Add a reusable wind pattern for this venue and team.
            </DrawerDescription>
          </DrawerHeader>

          <WindPatternDialogForm
            initialValues={{
              name: "",
              description: "",
            }}
            idPrefix="create-wind-pattern"
            submitLabel="Create pattern"
            pendingLabel="Creating..."
            scope={scope}
            teamVenueId={teamVenueId}
            statusFilter={statusFilter}
            year={year}
            action={createTeamVenueWindPatternAction}
            formId={createFormId}
            surface="drawer"
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
          formId={createFormId}
          surface="dialog"
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
  const isMobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const editFormId = `edit-wind-pattern-${windPattern.id}-${
    isMobile ? "drawer" : "dialog"
  }-form`

  if (isMobile) {
    return (
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        {!hideTrigger ? (
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="default"
              aria-haspopup="dialog"
              aria-expanded={isEditOpen}
              className="h-11 px-3"
            >
              <PencilIcon className="size-4" />
              Edit
            </Button>
          </DrawerTrigger>
        ) : null}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit Wind Pattern</DrawerTitle>
            <DrawerDescription>{windPattern.name}</DrawerDescription>
          </DrawerHeader>

          <WindPatternDialogForm
            initialValues={{
              id: windPattern.id,
              name: windPattern.name,
              description: windPattern.description ?? "",
            }}
            idPrefix={`edit-wind-pattern-${windPattern.id}`}
            submitLabel="Save"
            pendingLabel="Saving..."
            scope={scope}
            teamVenueId={teamVenueId}
            statusFilter={statusFilter}
            year={year}
            action={updateTeamVenueWindPatternAction}
            formId={editFormId}
            surface="drawer"
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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
          formId={editFormId}
          surface="dialog"
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
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="More actions unavailable"
        className="h-11 w-11 md:size-8"
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
              className="h-11 w-11 md:size-8"
            />
          }
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
