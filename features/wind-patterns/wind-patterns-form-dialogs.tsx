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
import type {
  TeamVenueWindPatternListItem,
  TeamWindPatternVenueOption,
} from "@/features/wind-patterns/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button, buttonVariants } from "@/components/ui/button"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

type WindPatternFormSurface = "dialog" | "drawer" | "sheet"

function ScopeHiddenInputs({
  currentPage,
  loadMoreMode,
  scope,
  teamVenueId,
  redirectTarget,
  statusFilter,
  year,
}: {
  currentPage?: number
  loadMoreMode?: boolean
  scope: NavigationScope
  teamVenueId?: string
  redirectTarget?: "venue-detail" | "team-page"
  statusFilter?: string
  year?: number
}) {
  return (
    <>
      {teamVenueId ? <input type="hidden" name="teamVenueId" value={teamVenueId} /> : null}
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {redirectTarget ? (
        <input type="hidden" name="redirectTarget" value={redirectTarget} />
      ) : null}
      {statusFilter ? <input type="hidden" name="scopeStatus" value={statusFilter} /> : null}
      {typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode === true && typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMore" value="1" />
      ) : null}
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
  currentPage,
  initialValues,
  idPrefix,
  loadMoreMode,
  submitLabel,
  pendingLabel,
  redirectTarget,
  scope,
  teamVenueId,
  venueOptions = [],
  statusFilter,
  year,
  action,
  surface = "dialog",
}: {
  currentPage?: number
  initialValues: WindPatternFormInitialValues
  idPrefix: string
  loadMoreMode?: boolean
  submitLabel: string
  pendingLabel: string
  redirectTarget?: "venue-detail" | "team-page"
  scope: NavigationScope
  teamVenueId?: string
  venueOptions?: TeamWindPatternVenueOption[]
  statusFilter?: string
  year?: number
  action: (formData: FormData) => void | Promise<void>
  surface?: WindPatternFormSurface
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const [selectedTeamVenueId, setSelectedTeamVenueId] = React.useState(
    teamVenueId ?? venueOptions[0]?.teamVenueId ?? "",
  )
  const shouldRenderVenueSelect = !teamVenueId && venueOptions.length > 0
  const canSubmit = name.trim().length > 0 && selectedTeamVenueId.length > 0
  const isDrawerSurface = surface === "drawer"
  const isSheetSurface = surface === "sheet"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )
  const textareaClassName =
    isDrawerSurface || isSheetSurface
      ? "min-h-28 px-3 text-base md:text-sm"
      : undefined

  return (
    <form
      action={action}
      className={cn(
        isDrawerSurface || isSheetSurface
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "space-y-4",
      )}
    >
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <ScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        scope={scope}
        teamVenueId={teamVenueId ?? selectedTeamVenueId}
        redirectTarget={redirectTarget}
        statusFilter={statusFilter}
        year={year}
      />

      <WindPatternDialogFieldset
        className={
          isDrawerSurface || isSheetSurface
            ? "min-h-0 flex-1 overflow-y-auto px-4 py-4"
            : undefined
        }
      >
        {shouldRenderVenueSelect ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-team-venue`}>Venue</Label>
            <select
              id={`${idPrefix}-team-venue`}
              required
              value={selectedTeamVenueId}
              onChange={(event) => setSelectedTeamVenueId(event.target.value)}
              className={selectClassName}
            >
              {venueOptions.map((venueOption) => (
                <option key={venueOption.teamVenueId} value={venueOption.teamVenueId}>
                  {venueOption.venueName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
            placeholder="Optional venue-specific pattern details."
            className={textareaClassName}
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
      ) : isSheetSurface ? (
        <SheetFooter className="shrink-0 border-t sm:justify-end">
          <WindPatternDialogSubmitButton
            submitLabel={submitLabel}
            pendingLabel={pendingLabel}
            canSubmit={canSubmit}
          />
        </SheetFooter>
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
  currentPage,
  loadMoreMode,
  scope,
  teamVenueId,
  venueOptions,
  redirectTarget = "venue-detail",
  statusFilter,
  year,
  disabled,
  surface,
  triggerVariant = "default",
}: {
  currentPage?: number
  loadMoreMode?: boolean
  scope: NavigationScope
  teamVenueId?: string
  venueOptions?: TeamWindPatternVenueOption[]
  redirectTarget?: "venue-detail" | "team-page"
  statusFilter?: string
  year?: number
  disabled: boolean
  surface?: WindPatternFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const isMobile = useIsMobile()
  const resolvedSurface = surface ?? (isMobile ? "drawer" : "dialog")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const isFabTrigger = triggerVariant === "fab"
  const createForm = (
    <WindPatternDialogForm
      initialValues={{
        name: "",
        description: "",
      }}
      idPrefix={`create-wind-pattern-${resolvedSurface}`}
      submitLabel="Create pattern"
      pendingLabel="Creating pattern..."
      scope={scope}
      teamVenueId={teamVenueId}
      venueOptions={venueOptions}
      redirectTarget={redirectTarget}
      statusFilter={statusFilter}
      year={year}
      action={createTeamVenueWindPatternAction}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      surface={resolvedSurface}
    />
  )

  if (resolvedSurface === "drawer") {
    return (
      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <button
          type="button"
          disabled={disabled}
          aria-label={isFabTrigger ? "New wind pattern" : undefined}
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
          {isFabTrigger ? <span className="sr-only">New wind pattern</span> : "New"}
        </button>
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create Wind Pattern</DrawerTitle>
          </DrawerHeader>
          {createForm}
        </DrawerContent>
      </Drawer>
    )
  }

  if (resolvedSurface === "sheet") {
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
            <SheetTitle>Create Wind Pattern</SheetTitle>
          </SheetHeader>
          {createForm}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
          venueOptions={venueOptions}
          redirectTarget={redirectTarget}
          statusFilter={statusFilter}
          year={year}
          action={createTeamVenueWindPatternAction}
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
  redirectTarget = "venue-detail",
  statusFilter,
  currentPage,
  loadMoreMode,
  year,
  open,
  onOpenChange,
  hideTrigger = false,
  surface,
}: {
  windPattern: EditableWindPattern
  scope: NavigationScope
  teamVenueId: string
  redirectTarget?: "venue-detail" | "team-page"
  statusFilter?: string
  currentPage?: number
  loadMoreMode?: boolean
  year?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  surface?: WindPatternFormSurface
}) {
  const isMobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const resolvedSurface = surface ?? (isMobile ? "drawer" : "dialog")
  const editForm = (
    <WindPatternDialogForm
      initialValues={{
        id: windPattern.id,
        name: windPattern.name,
        description: windPattern.description ?? "",
      }}
      idPrefix={`edit-wind-pattern-${windPattern.id}-${resolvedSurface}`}
      submitLabel="Save changes"
      pendingLabel="Saving changes..."
      scope={scope}
      teamVenueId={teamVenueId}
      redirectTarget={redirectTarget}
      statusFilter={statusFilter}
      year={year}
      action={updateTeamVenueWindPatternAction}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      surface={resolvedSurface}
    />
  )

  if (resolvedSurface === "drawer") {
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
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit Wind Pattern</DrawerTitle>
          </DrawerHeader>
          {editForm}
        </DrawerContent>
      </Drawer>
    )
  }

  if (resolvedSurface === "sheet") {
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
            <SheetTitle>Edit Wind Pattern</SheetTitle>
          </SheetHeader>
          {editForm}
        </SheetContent>
      </Sheet>
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

        {editForm}
      </DialogContent>
    </Dialog>
  )
}

export function WindPatternActionsMenu({
  windPattern,
  scope,
  teamVenueId,
  redirectTarget = "venue-detail",
  statusFilter,
  currentPage,
  loadMoreMode,
  year,
  canManageWindPatterns,
  surface,
  triggerClassName,
}: {
  windPattern: EditableWindPattern
  scope: NavigationScope
  teamVenueId: string
  redirectTarget?: "venue-detail" | "team-page"
  statusFilter?: string
  currentPage?: number
  loadMoreMode?: boolean
  year?: number
  canManageWindPatterns: boolean
  surface?: WindPatternFormSurface
  triggerClassName?: string
}) {
  const isMobile = useIsMobile()
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false)
  const toggleStatusFormRef = React.useRef<HTMLFormElement | null>(null)
  const toggleAction = windPattern.isActive
    ? archiveTeamVenueWindPatternAction
    : restoreTeamVenueWindPatternAction
  const toggleLabel = windPattern.isActive ? "Archive" : "Restore"
  const togglePendingLabel = windPattern.isActive ? "Archiving..." : "Restoring..."
  const resolvedSurface = surface ?? (isMobile ? "drawer" : "dialog")

  if (!canManageWindPatterns) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="More actions unavailable"
        className={triggerClassName ?? "h-11 w-11 md:size-8"}
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
              className={triggerClassName ?? "h-11 w-11 md:size-8"}
            />
          }
          aria-label={`Open actions for ${windPattern.name}`}
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
        <input type="hidden" name="id" value={windPattern.id} />
        <ScopeHiddenInputs
          scope={scope}
          teamVenueId={teamVenueId}
          redirectTarget={redirectTarget}
          statusFilter={statusFilter}
          currentPage={currentPage}
          loadMoreMode={loadMoreMode}
          year={year}
        />
      </form>

      <EditWindPatternDialog
        windPattern={windPattern}
        scope={scope}
        teamVenueId={teamVenueId}
        redirectTarget={redirectTarget}
        statusFilter={statusFilter}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        year={year}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        surface={resolvedSurface}
        hideTrigger
      />
    </>
  )
}
