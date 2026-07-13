"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { Loader2Icon, MoreHorizontalIcon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createCampAction,
  deleteCampAction,
  updateCampAction,
} from "@/features/camps/actions"
import type {
  TeamCampListItem,
  TeamCampStatusFilter,
  TeamCampTypeFilter,
  TeamCampVenueOption,
} from "@/features/camps/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  SheetTrigger,
} from "@/components/ui/sheet"

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

type CampFormSurface = "drawer" | "sheet"
type CampFormFooter = CampFormSurface | "none"

function CampDialogFields({
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

function CampDialogSubmitButton({
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

function CampDeleteSubmitButton() {
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

function CampDeleteDialogFooter({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onCancel}
      >
        Cancel
      </Button>
      <CampDeleteSubmitButton />
    </DialogFooter>
  )
}

function CampDialogSubmitFooter({
  footer,
  submitLabel,
  pendingLabel,
  canSubmit,
}: {
  footer: CampFormFooter
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
}) {
  if (footer === "none") {
    return null
  }

  const button = (
    <CampDialogSubmitButton
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      canSubmit={canSubmit}
      className={footer === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (footer === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:justify-end">
      {button}
    </SheetFooter>
  )
}

function CampDialogForm({
  teamVenueOptions,
  initialValues,
  includeIsActive,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  returnPath,
  action,
  formId,
  footer = "sheet",
  fieldsClassName,
  surface,
}: {
  teamVenueOptions: TeamCampVenueOption[]
  initialValues: CampFormInitialValues
  includeIsActive: boolean
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  returnPath?: string
  action: (formData: FormData) => Promise<void>
  formId?: string
  footer?: CampFormFooter
  fieldsClassName?: string
  surface: CampFormSurface
}) {
  const [teamVenueId, setTeamVenueId] = React.useState(initialValues.teamVenueId)
  const [name, setName] = React.useState(initialValues.name)
  const [campType, setCampType] = React.useState(initialValues.campType)
  const [startDate, setStartDate] = React.useState(initialValues.startDate)
  const [endDate, setEndDate] = React.useState(initialValues.endDate)
  const hasDateRangeError =
    startDate.length > 0 && endDate.length > 0 && endDate < startDate

  const canSubmit =
    teamVenueId.length > 0 &&
    name.trim().length > 0 &&
    campType.length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    !hasDateRangeError
  const isDrawerSurface = surface === "drawer"
  const hasFixedFooter = footer === "drawer" || footer === "sheet"
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3",
  )
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined

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
      {selectedCampType ? (
        <input type="hidden" name="scopeCampType" value={selectedCampType} />
      ) : null}
      {selectedCampStatus ? (
        <input type="hidden" name="scopeCampStatus" value={selectedCampStatus} />
      ) : null}
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {returnPath ? (
        <input type="hidden" name="scopeReturnPath" value={returnPath} />
      ) : null}

      <CampDialogFields
        className={cn(
          hasFixedFooter && "min-h-0 flex-1 overflow-y-auto",
          fieldsClassName,
        )}
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-teamVenueId`}>Venue</Label>
          <select
            id={`${idPrefix}-teamVenueId`}
            name="teamVenueId"
            required
            value={teamVenueId}
            onChange={(event) => setTeamVenueId(event.target.value)}
            className={selectClassName}
          >
            <option value="">Select venue</option>
            {teamVenueOptions.map((option) => (
              <option key={option.teamVenueId} value={option.teamVenueId}>
                {option.venueName} - {option.venueLocation}
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
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-campType`}>Camp type</Label>
            <select
              id={`${idPrefix}-campType`}
              name="campType"
              required
              value={campType}
              onChange={(event) =>
                setCampType(event.target.value as CampFormInitialValues["campType"])
              }
              className={selectClassName}
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
              lang="en-US"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-endDate`}>End date</Label>
            <Input
              id={`${idPrefix}-endDate`}
              name="endDate"
              type="date"
              required
              lang="en-US"
              min={startDate || undefined}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClassName}
              aria-invalid={hasDateRangeError}
              aria-describedby={
                hasDateRangeError ? `${idPrefix}-endDate-error` : undefined
              }
            />
            {hasDateRangeError ? (
              <p id={`${idPrefix}-endDate-error`} className="text-sm text-destructive">
                End date must be on or after start date.
              </p>
            ) : null}
          </div>
        </div>

        {includeIsActive ? (
          <label
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              isDrawerSurface && "min-h-11",
            )}
          >
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initialValues.isActive}
              className="size-4 rounded border-input"
            />
            Active camp
          </label>
        ) : null}
      </CampDialogFields>

      <CampDialogSubmitFooter
        footer={footer}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        canSubmit={canSubmit}
      />
    </form>
  )
}

export function CreateCampDialog({
  teamVenueOptions,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  returnPath,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  returnPath?: string
  disabled: boolean
  surface?: CampFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = React.useState(false)
  const defaultTeamVenueId =
    teamVenueOptions.find((option) => option.venueId === selectedVenueId)?.teamVenueId ??
    teamVenueOptions[0]?.teamVenueId ??
    ""
  const isFabTrigger = triggerVariant === "fab"
  const createFormId = `create-camp-${surface}-form`

  if (surface === "drawer") {
    return (
      <Drawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New camp" : undefined}
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
          {isFabTrigger ? <span className="sr-only">New camp</span> : "New"}
        </Button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create camp</DrawerTitle>
          </DrawerHeader>

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
            pendingLabel="Creating..."
            scope={scope}
            selectedVenueId={selectedVenueId}
            selectedCampType={selectedCampType}
            selectedCampStatus={selectedCampStatus}
            currentPage={currentPage}
            returnPath={returnPath}
            action={createCampAction}
            formId={createFormId}
            footer="drawer"
            fieldsClassName="px-4 py-4"
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
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create camp</SheetTitle>
        </SheetHeader>

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
          pendingLabel="Creating..."
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampType={selectedCampType}
          selectedCampStatus={selectedCampStatus}
          currentPage={currentPage}
          returnPath={returnPath}
          action={createCampAction}
          formId={createFormId}
          footer="sheet"
          fieldsClassName="px-4 py-4"
          surface="sheet"
        />
      </SheetContent>
    </Sheet>
  )
}

export function EditCampDialog({
  camp,
  teamVenueOptions,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  returnPath,
  surface = "sheet",
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  camp: EditableCamp
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  returnPath?: string
  surface?: CampFormSurface
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const editFormId = `edit-camp-${camp.id}-${surface}-form`

  if (surface === "drawer") {
    return (
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        {!hideTrigger ? (
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
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit camp</DrawerTitle>
            <DrawerDescription>{camp.name}</DrawerDescription>
          </DrawerHeader>

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
            submitLabel="Save"
            pendingLabel="Saving..."
            scope={scope}
            selectedVenueId={selectedVenueId}
            selectedCampType={selectedCampType}
            selectedCampStatus={selectedCampStatus}
            currentPage={currentPage}
            returnPath={returnPath}
            action={updateCampAction}
            formId={editFormId}
            footer="drawer"
            fieldsClassName="px-4 py-4"
            surface="drawer"
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
      {!hideTrigger ? (
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <PencilIcon className="size-4" />
          Edit
        </SheetTrigger>
      ) : null}
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit camp</SheetTitle>
          <SheetDescription>{camp.name}</SheetDescription>
        </SheetHeader>

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
          submitLabel="Save"
          pendingLabel="Saving..."
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampType={selectedCampType}
          selectedCampStatus={selectedCampStatus}
          currentPage={currentPage}
          returnPath={returnPath}
          action={updateCampAction}
          formId={editFormId}
          footer="sheet"
          fieldsClassName="px-4 py-4"
          surface="sheet"
        />
      </SheetContent>
    </Sheet>
  )
}

function DeleteCampDialog({
  camp,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  returnPath,
  open,
  onOpenChange,
}: {
  camp: EditableCamp
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  returnPath?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Delete camp</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{camp.name}</strong> and all sessions
            linked to it.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteCampAction} className="space-y-4">
          <input type="hidden" name="id" value={camp.id} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedVenueId ? (
            <input type="hidden" name="scopeVenueId" value={selectedVenueId} />
          ) : null}
          {selectedCampType ? (
            <input type="hidden" name="scopeCampType" value={selectedCampType} />
          ) : null}
          {selectedCampStatus ? (
            <input type="hidden" name="scopeCampStatus" value={selectedCampStatus} />
          ) : null}
          {currentPage > 1 ? (
            <input type="hidden" name="scopePage" value={String(currentPage)} />
          ) : null}
          {returnPath ? (
            <input type="hidden" name="scopeReturnPath" value={returnPath} />
          ) : null}

          <CampDeleteDialogFooter onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CampActionsMenu({
  camp,
  teamVenueOptions,
  scope,
  selectedVenueId,
  selectedCampType,
  selectedCampStatus,
  currentPage,
  returnPath,
  canEditCamp,
  canDeleteCamp,
  editSurface = "sheet",
}: {
  camp: EditableCamp
  teamVenueOptions: TeamCampVenueOption[]
  scope: NavigationScope
  selectedVenueId?: string
  selectedCampType?: TeamCampTypeFilter
  selectedCampStatus?: TeamCampStatusFilter
  currentPage: number
  returnPath?: string
  canEditCamp: boolean
  canDeleteCamp: boolean
  editSurface?: CampFormSurface
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  if (!canEditCamp && !canDeleteCamp) {
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
          aria-label={`Open actions for ${camp.name}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditCamp ? (
            <DropdownMenuItem
              onClick={() => {
                setIsEditOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : null}
          {canDeleteCamp ? (
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

      {canEditCamp ? (
        <EditCampDialog
          camp={camp}
          teamVenueOptions={teamVenueOptions}
          scope={scope}
          selectedVenueId={selectedVenueId}
          selectedCampType={selectedCampType}
          selectedCampStatus={selectedCampStatus}
          currentPage={currentPage}
          returnPath={returnPath}
          surface={editSurface}
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
          selectedCampType={selectedCampType}
          selectedCampStatus={selectedCampStatus}
          currentPage={currentPage}
          returnPath={returnPath}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
        />
      ) : null}
    </>
  )
}
