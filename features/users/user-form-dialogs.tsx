"use client"

import * as React from "react"
import { Loader2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  createCrewMemberAction,
  deleteCrewMemberAction,
  updateCrewMemberAction,
} from "@/features/users/actions"
import type { CrewListItem, CrewTeamOption } from "@/features/users/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
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

type CrewMemberFormSurface = "drawer" | "sheet"
type CrewMemberFormMode = "create" | "edit"

type CrewMemberFormValues = {
  email?: string
  firstName: string
  lastName: string
  role: CrewListItem["role"]
  teamId: string
  avatarUrl: string
}

function normalizeNameInput(value: string): string {
  return value.trim()
}

function getDefaultTeamId(
  teamOptions: CrewTeamOption[],
  selectedTeamId: string | undefined,
): string {
  if (selectedTeamId && teamOptions.some((team) => team.id === selectedTeamId)) {
    return selectedTeamId
  }

  return teamOptions[0]?.id ?? ""
}

function UsersScopeHiddenInputs({
  currentPage,
  loadMoreMode,
  scope,
  selectedTeamId,
}: {
  currentPage?: number
  loadMoreMode?: boolean
  scope: NavigationScope
  selectedTeamId?: string
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedTeamId ? (
        <input type="hidden" name="scopeUsersTeamId" value={selectedTeamId} />
      ) : null}
      {typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode === true && typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMoreMode" value="1" />
      ) : null}
    </>
  )
}

function CrewMemberDialogFieldset({
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

function CrewMemberSubmitButton({
  canSubmit,
  className,
  pendingLabel,
  submitLabel,
}: {
  canSubmit: boolean
  className?: string
  pendingLabel: string
  submitLabel: string
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

function CrewMemberDialogFooter({
  canSubmit,
  pendingLabel,
  submitLabel,
  surface,
}: {
  canSubmit: boolean
  pendingLabel: string
  submitLabel: string
  surface: CrewMemberFormSurface
}) {
  const button = (
    <CrewMemberSubmitButton
      canSubmit={canSubmit}
      pendingLabel={pendingLabel}
      submitLabel={submitLabel}
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

function CrewMemberDialogForm({
  action,
  crew,
  currentPage,
  idPrefix,
  initialValues,
  loadMoreMode,
  mode,
  scope,
  selectedTeamId,
  surface,
  teamOptions,
}: {
  action: (formData: FormData) => void | Promise<void>
  crew?: CrewListItem
  currentPage?: number
  idPrefix: string
  initialValues: CrewMemberFormValues
  loadMoreMode?: boolean
  mode: CrewMemberFormMode
  scope: NavigationScope
  selectedTeamId?: string
  surface: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
}) {
  const [email, setEmail] = React.useState(initialValues.email ?? "")
  const [firstName, setFirstName] = React.useState(initialValues.firstName)
  const [lastName, setLastName] = React.useState(initialValues.lastName)
  const [role, setRole] = React.useState<CrewListItem["role"]>(
    initialValues.role,
  )
  const [teamId, setTeamId] = React.useState(initialValues.teamId)
  const [avatarUrl, setAvatarUrl] = React.useState(initialValues.avatarUrl)

  const isDrawerSurface = surface === "drawer"
  const canSubmit =
    (mode === "edit" || email.trim().length > 0) &&
    normalizeNameInput(firstName).length > 0 &&
    normalizeNameInput(lastName).length > 0 &&
    role.length > 0 &&
    teamId.length > 0
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3 text-sm",
  )

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {crew ? (
        <>
          <input type="hidden" name="membershipId" value={crew.membershipId} />
          <input type="hidden" name="profileId" value={crew.profileId} />
        </>
      ) : null}
      <UsersScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        scope={scope}
        selectedTeamId={selectedTeamId}
      />

      <CrewMemberDialogFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {mode === "create" ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-email`}>Email</Label>
            <Input
              id={`${idPrefix}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-first-name`}>Name</Label>
            <Input
              id={`${idPrefix}-first-name`}
              name="firstName"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-last-name`}>Last name</Label>
            <Input
              id={`${idPrefix}-last-name`}
              name="lastName"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-role`}>Role</Label>
            <select
              id={`${idPrefix}-role`}
              name="role"
              required
              value={role}
              onChange={(event) => {
                setRole(event.target.value as CrewListItem["role"])
              }}
              className={selectClassName}
            >
              <option value="team_admin">Team Admin</option>
              <option value="coach">Coach</option>
              <option value="crew">Crew</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-team`}>Team</Label>
            <select
              id={`${idPrefix}-team`}
              name="teamId"
              required
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className={selectClassName}
            >
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-avatar`}>Avatar URL</Label>
          <Input
            id={`${idPrefix}-avatar`}
            name="avatarUrl"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
            className={inputClassName}
          />
        </div>
      </CrewMemberDialogFieldset>

      <CrewMemberDialogFooter
        canSubmit={canSubmit}
        pendingLabel={mode === "create" ? "Creating..." : "Saving..."}
        submitLabel={mode === "create" ? "Create member" : "Save"}
        surface={surface}
      />
    </form>
  )
}

export function CreateCrewMemberDialog({
  currentPage,
  disabled,
  loadMoreMode,
  scope,
  selectedTeamId,
  surface = "sheet",
  teamOptions,
  triggerVariant = "default",
}: {
  currentPage?: number
  disabled: boolean
  loadMoreMode?: boolean
  scope: NavigationScope
  selectedTeamId?: string
  surface?: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
  triggerVariant?: "default" | "fab"
}) {
  const [open, setOpen] = React.useState(false)
  const [formResetKey, setFormResetKey] = React.useState(0)
  const defaultTeamId = getDefaultTeamId(teamOptions, selectedTeamId)
  const isFabTrigger = triggerVariant === "fab"
  const isDisabled = disabled || teamOptions.length === 0
  const createForm = (
    <CrewMemberDialogForm
      key={formResetKey}
      action={createCrewMemberAction}
      currentPage={currentPage}
      idPrefix={`create-crew-${surface}`}
      initialValues={{
        email: "",
        firstName: "",
        lastName: "",
        role: "crew",
        teamId: defaultTeamId,
        avatarUrl: "",
      }}
      loadMoreMode={loadMoreMode}
      mode="create"
      scope={scope}
      selectedTeamId={selectedTeamId}
      surface={surface}
      teamOptions={teamOptions}
    />
  )

  function openCreateSurface(): void {
    setFormResetKey((currentValue) => currentValue + 1)
    setOpen(true)
  }

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <button
          type="button"
          disabled={isDisabled}
          aria-label={isFabTrigger ? "New member" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            buttonVariants({
              variant: isFabTrigger ? "default" : "outline",
              size: isFabTrigger ? "icon" : "default",
            }),
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3",
          )}
          onClick={openCreateSurface}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New member</span> : "New"}
        </button>

        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 text-left">
            <DrawerTitle>Create member</DrawerTitle>
          </DrawerHeader>
          {createForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        onClick={openCreateSurface}
      >
        <PlusIcon className="size-4" />
        New
      </button>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create member</SheetTitle>
        </SheetHeader>
        {createForm}
      </SheetContent>
    </Sheet>
  )
}

function EditCrewSurface({
  crew,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
  scope,
  selectedTeamId,
  surface,
  teamOptions,
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: NavigationScope
  selectedTeamId?: string
  surface: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
}) {
  const [formResetKey, setFormResetKey] = React.useState(0)
  const editForm = (
    <CrewMemberDialogForm
      key={formResetKey}
      action={updateCrewMemberAction}
      crew={crew}
      currentPage={currentPage}
      idPrefix={`edit-crew-${crew.membershipId}-${surface}`}
      initialValues={{
        firstName: crew.firstName,
        lastName: crew.lastName,
        role: crew.role,
        teamId: crew.teamId,
        avatarUrl: crew.avatarUrl ?? "",
      }}
      loadMoreMode={loadMoreMode}
      mode="edit"
      scope={scope}
      selectedTeamId={selectedTeamId}
      surface={surface}
      teamOptions={teamOptions}
    />
  )

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      setFormResetKey((currentValue) => currentValue + 1)
    }

    onOpenChange(nextOpen)
  }

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 text-left">
            <DrawerTitle>Edit member</DrawerTitle>
          </DrawerHeader>
          {editForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit member</SheetTitle>
        </SheetHeader>
        {editForm}
      </SheetContent>
    </Sheet>
  )
}

function DeleteSubmitButton({
  className,
}: {
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
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

function DeleteCrewFooter({
  onCancel,
  surface,
}: {
  onCancel: () => void
  surface: CrewMemberFormSurface
}) {
  const { pending } = useFormStatus()
  const cancelButton = (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
      onClick={onCancel}
    >
      Cancel
    </Button>
  )
  const deleteButton = (
    <DeleteSubmitButton className={surface === "drawer" ? "h-11 w-full" : undefined} />
  )

  if (surface === "drawer") {
    return (
      <DrawerFooter className="shrink-0 border-t">
        {cancelButton}
        {deleteButton}
      </DrawerFooter>
    )
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:flex-row sm:justify-end">
      {cancelButton}
      {deleteButton}
    </SheetFooter>
  )
}

function DeleteCrewForm({
  currentPage,
  crew,
  loadMoreMode,
  onCancel,
  scope,
  selectedTeamId,
  surface,
}: {
  currentPage?: number
  crew: CrewListItem
  loadMoreMode?: boolean
  onCancel: () => void
  scope: NavigationScope
  selectedTeamId?: string
  surface: CrewMemberFormSurface
}) {
  return (
    <form
      action={deleteCrewMemberAction}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <input type="hidden" name="membershipId" value={crew.membershipId} />
      <UsersScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        scope={scope}
        selectedTeamId={selectedTeamId}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Remove <span className="font-medium text-foreground">{crew.fullName}</span>{" "}
          from {crew.teamName}.
        </p>
      </div>

      <DeleteCrewFooter surface={surface} onCancel={onCancel} />
    </form>
  )
}

function DeleteCrewSurface({
  crew,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
  scope,
  selectedTeamId,
  surface,
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: NavigationScope
  selectedTeamId?: string
  surface: CrewMemberFormSurface
}) {
  const deleteForm = (
    <DeleteCrewForm
      crew={crew}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      onCancel={() => onOpenChange(false)}
      scope={scope}
      selectedTeamId={selectedTeamId}
      surface={surface}
    />
  )

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b px-4 text-left">
            <DrawerTitle>Delete member</DrawerTitle>
          </DrawerHeader>
          {deleteForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Delete member</SheetTitle>
        </SheetHeader>
        {deleteForm}
      </SheetContent>
    </Sheet>
  )
}

export function CrewActionsMenu({
  crew,
  currentPage,
  loadMoreMode,
  scope,
  selectedTeamId,
  surface = "sheet",
  teamOptions,
  triggerClassName,
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  scope: NavigationScope
  selectedTeamId?: string
  surface?: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
  triggerClassName?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={triggerClassName}
            />
          }
          aria-label={`Open actions for ${crew.fullName}`}
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
            variant="destructive"
            onClick={() => {
              setIsDeleteOpen(true)
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCrewSurface
        crew={crew}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        teamOptions={teamOptions}
        scope={scope}
        selectedTeamId={selectedTeamId}
        surface={surface}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <DeleteCrewSurface
        crew={crew}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        scope={scope}
        selectedTeamId={selectedTeamId}
        surface={surface}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  )
}
