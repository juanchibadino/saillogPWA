"use client"

import * as React from "react"
import { Loader2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  createCrewMemberAction,
  deleteUserAction,
  unlinkCrewMemberAction,
  updateCrewMemberAction,
} from "@/features/users/actions"
import type {
  CrewListItem,
  CrewTeamOption,
  TeamCrewListItem,
} from "@/features/users/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
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
type TeamRole = TeamCrewListItem["role"]
type InviteRole = TeamRole | "organization_admin"
type InviteTargetMode = "all" | "team"

type CrewMemberFormValues = {
  email?: string
  firstName: string
  lastName: string
  role: InviteRole
  teamId: string
  avatarUrl: string
}

type DecodedAvatarImageSource = {
  cleanup: () => void
  height: number
  source: CanvasImageSource
  width: number
}

const CREW_AVATAR_DIMENSION = 96
const CREW_AVATAR_MAX_BYTES = 32 * 1024
const CREW_AVATAR_WEBP_TYPE = "image/webp"
const CREW_AVATAR_QUALITY_LADDER = [0.56, 0.46, 0.36, 0.28] as const

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

function buildCompressedAvatarFileName(fileName: string): string {
  const normalizedName = fileName.trim()
  const baseName =
    normalizedName.length > 0
      ? normalizedName.replace(/\.[^/.]+$/, "")
      : "avatar"

  return `${baseName || "avatar"}.webp`
}

async function decodeAvatarImageSource(file: File): Promise<DecodedAvatarImageSource> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await window.createImageBitmap(file)

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall through to the image element path.
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not read this image."))
    }
    image.src = objectUrl
  })
}

function canvasToAvatarWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this avatar."))
          return
        }

        resolve(blob)
      },
      CREW_AVATAR_WEBP_TYPE,
      quality,
    )
  })
}

async function compressCrewAvatarFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file.")
  }

  const decodedImage = await decodeAvatarImageSource(file)

  try {
    const sourceSize = Math.min(decodedImage.width, decodedImage.height)
    const sourceX = Math.max(0, Math.floor((decodedImage.width - sourceSize) / 2))
    const sourceY = Math.max(0, Math.floor((decodedImage.height - sourceSize) / 2))
    const canvas = document.createElement("canvas")
    canvas.width = CREW_AVATAR_DIMENSION
    canvas.height = CREW_AVATAR_DIMENSION

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Could not prepare this avatar.")
    }

    context.drawImage(
      decodedImage.source,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      CREW_AVATAR_DIMENSION,
      CREW_AVATAR_DIMENSION,
    )

    let compressedBlob: Blob | null = null

    for (const quality of CREW_AVATAR_QUALITY_LADDER) {
      compressedBlob = await canvasToAvatarWebpBlob(canvas, quality)

      if (compressedBlob.size <= CREW_AVATAR_MAX_BYTES) {
        break
      }
    }

    if (!compressedBlob) {
      throw new Error("Could not compress this avatar.")
    }

    if (compressedBlob.type !== CREW_AVATAR_WEBP_TYPE) {
      throw new Error("This browser could not create a WebP avatar.")
    }

    if (compressedBlob.size > CREW_AVATAR_MAX_BYTES) {
      throw new Error("This avatar is still too large after compression.")
    }

    return new File([compressedBlob], buildCompressedAvatarFileName(file.name), {
      type: CREW_AVATAR_WEBP_TYPE,
      lastModified: Date.now(),
    })
  } finally {
    decodedImage.cleanup()
  }
}

function isTeamCrewListItem(crew: CrewListItem): crew is TeamCrewListItem {
  return crew.membershipKind === "team"
}

function formatLinkedTeamsLabel(crew: CrewListItem): string {
  if (isTeamCrewListItem(crew)) {
    return crew.teamName
  }

  if (crew.linkedTeams.length === 1) {
    return crew.linkedTeams[0]?.name ?? "their linked team"
  }

  return `${crew.linkedTeams.length} linked teams`
}

function UsersScopeHiddenInputs({
  currentPage,
  loadMoreMode,
  redirectTo,
  scope,
  selectedTeamId,
}: {
  currentPage?: number
  loadMoreMode?: boolean
  redirectTo?: "/team-home" | "/users"
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
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
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
  allowedInviteTargets,
  crew,
  currentPage,
  idPrefix,
  initialValues,
  loadMoreMode,
  mode,
  redirectTo,
  scope,
  selectedTeamId,
  surface,
  teamOptions,
}: {
  action: (formData: FormData) => void | Promise<void>
  allowedInviteTargets: InviteTargetMode
  crew?: TeamCrewListItem
  currentPage?: number
  idPrefix: string
  initialValues: CrewMemberFormValues
  loadMoreMode?: boolean
  mode: CrewMemberFormMode
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
  surface: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
}) {
  const [email, setEmail] = React.useState(initialValues.email ?? "")
  const [firstName, setFirstName] = React.useState(initialValues.firstName)
  const [lastName, setLastName] = React.useState(initialValues.lastName)
  const [role, setRole] = React.useState<InviteRole>(initialValues.role)
  const [teamId, setTeamId] = React.useState(initialValues.teamId)
  const [avatarErrorMessage, setAvatarErrorMessage] = React.useState("")

  const isDrawerSurface = surface === "drawer"
  const isOrganizationInvite = mode === "create" && role === "organization_admin"
  const canSelectOrganizationInvite = mode === "create" && allowedInviteTargets === "all"
  const shouldHideTeamSelect =
    mode === "create" &&
    allowedInviteTargets === "team" &&
    teamOptions.length === 1
  const canSubmit =
    (mode === "edit" || email.trim().length > 0) &&
    normalizeNameInput(firstName).length > 0 &&
    normalizeNameInput(lastName).length > 0 &&
    role.length > 0 &&
    (isOrganizationInvite || teamId.length > 0)
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3 text-sm",
  )

  async function submitCrewMemberForm(formData: FormData): Promise<void> {
    setAvatarErrorMessage("")

    const avatarFile = formData.get("avatarFile")

    if (avatarFile instanceof File && avatarFile.size > 0) {
      try {
        const compressedAvatarFile = await compressCrewAvatarFile(avatarFile)
        formData.set("avatarFile", compressedAvatarFile)
      } catch (error) {
        setAvatarErrorMessage(
          error instanceof Error ? error.message : "Could not prepare this avatar.",
        )
        return
      }
    } else {
      formData.delete("avatarFile")
    }

    await action(formData)
  }

  return (
    <form
      action={submitCrewMemberForm}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {crew ? (
        <>
          <input type="hidden" name="membershipId" value={crew.membershipId} />
          <input type="hidden" name="profileId" value={crew.profileId} />
        </>
      ) : null}
      <UsersScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        redirectTo={redirectTo}
        scope={scope}
        selectedTeamId={selectedTeamId}
      />
      {shouldHideTeamSelect ? (
        <input type="hidden" name="teamId" value={teamId} />
      ) : null}
      <input type="hidden" name="avatarUrl" value={initialValues.avatarUrl} />

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
                const nextRole = event.target.value as InviteRole
                setRole(nextRole)

                if (nextRole === "organization_admin") {
                  setTeamId("")
                } else if (!teamId) {
                  setTeamId(getDefaultTeamId(teamOptions, selectedTeamId))
                }
              }}
              className={selectClassName}
            >
              {canSelectOrganizationInvite ? (
                <option value="organization_admin">Organization Admin</option>
              ) : null}
              <option value="team_admin">Team Admin</option>
              <option value="coach">Coach</option>
              <option value="crew">Crew</option>
            </select>
          </div>

          {!isOrganizationInvite && !shouldHideTeamSelect ? (
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
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-avatar`}>Avatar</Label>
          <Input
            id={`${idPrefix}-avatar`}
            name="avatarFile"
            type="file"
            accept="image/*"
            onChange={() => setAvatarErrorMessage("")}
            className={inputClassName}
          />
          {avatarErrorMessage ? (
            <p className="text-xs text-destructive">{avatarErrorMessage}</p>
          ) : null}
        </div>
      </CrewMemberDialogFieldset>

      <CrewMemberDialogFooter
        canSubmit={canSubmit}
        pendingLabel={mode === "create" ? "Inviting..." : "Saving..."}
        submitLabel={mode === "create" ? "Invite member" : "Save"}
        surface={surface}
      />
    </form>
  )
}

export function CreateCrewMemberDialog({
  allowedInviteTargets = "all",
  currentPage,
  disabled,
  loadMoreMode,
  redirectTo,
  scope,
  selectedTeamId,
  surface = "sheet",
  teamOptions,
  triggerClassName,
  triggerVariant = "default",
}: {
  allowedInviteTargets?: InviteTargetMode
  currentPage?: number
  disabled: boolean
  loadMoreMode?: boolean
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
  surface?: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
  triggerClassName?: string
  triggerVariant?: "default" | "fab"
}) {
  const [open, setOpen] = React.useState(false)
  const [formResetKey, setFormResetKey] = React.useState(0)
  const defaultTeamId = getDefaultTeamId(teamOptions, selectedTeamId)
  const isFabTrigger = triggerVariant === "fab"
  const isDisabled =
    disabled || (allowedInviteTargets === "team" && teamOptions.length === 0)
  const createForm = (
    <CrewMemberDialogForm
      key={formResetKey}
      action={createCrewMemberAction}
      allowedInviteTargets={allowedInviteTargets}
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
      redirectTo={redirectTo}
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
          aria-label={isFabTrigger ? "Invite member" : undefined}
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
            triggerClassName,
          )}
          onClick={openCreateSurface}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">Invite member</span> : "Invite"}
        </button>

        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 text-left">
            <DrawerTitle>Invite member</DrawerTitle>
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
        Invite
      </button>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Invite member</SheetTitle>
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
  crew: TeamCrewListItem
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
      allowedInviteTargets="team"
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

function UnlinkSubmitButton({
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
          Unlinking...
        </>
      ) : (
        "Unlink"
      )}
    </Button>
  )
}

function UnlinkCrewFooter({
  onCancel,
}: {
  onCancel: () => void
}) {
  const { pending } = useFormStatus()
  const cancelButton = (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="h-11 w-full sm:h-8 sm:w-auto"
      onClick={onCancel}
    >
      Cancel
    </Button>
  )
  const deleteButton = (
    <UnlinkSubmitButton className="h-11 w-full sm:h-8 sm:w-auto" />
  )

  return (
    <DialogFooter>
      {cancelButton}
      {deleteButton}
    </DialogFooter>
  )
}

function UnlinkCrewForm({
  currentPage,
  crew,
  loadMoreMode,
  onCancel,
  redirectTo,
  scope,
  selectedTeamId,
}: {
  currentPage?: number
  crew: CrewListItem
  loadMoreMode?: boolean
  onCancel: () => void
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
}) {
  return (
    <form
      action={unlinkCrewMemberAction}
      className="space-y-4"
    >
      <input type="hidden" name="profileId" value={crew.profileId} />
      {isTeamCrewListItem(crew) ? (
        <input type="hidden" name="membershipId" value={crew.membershipId} />
      ) : null}
      <UsersScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        redirectTo={redirectTo}
        scope={scope}
        selectedTeamId={selectedTeamId}
      />

      <UnlinkCrewFooter onCancel={onCancel} />
    </form>
  )
}

function UnlinkCrewSurface({
  crew,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
  redirectTo,
  scope,
  selectedTeamId,
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
}) {
  const unlinkForm = (
    <UnlinkCrewForm
      crew={crew}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      onCancel={() => onOpenChange(false)}
      redirectTo={redirectTo}
      scope={scope}
      selectedTeamId={selectedTeamId}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Unlink member</DialogTitle>
          <DialogDescription>
            Unlink <strong>{crew.fullName}</strong> from{" "}
            {formatLinkedTeamsLabel(crew)}. Their user account remains active;
            delete the user to remove their final access.
          </DialogDescription>
        </DialogHeader>
        {unlinkForm}
      </DialogContent>
    </Dialog>
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

function DeleteUserFooter({
  onCancel,
}: {
  onCancel: () => void
}) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="h-11 w-full sm:h-8 sm:w-auto"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <DeleteSubmitButton className="h-11 w-full sm:h-8 sm:w-auto" />
    </DialogFooter>
  )
}

function DeleteUserForm({
  currentPage,
  crew,
  loadMoreMode,
  onCancel,
  redirectTo,
  scope,
  selectedTeamId,
}: {
  currentPage?: number
  crew: CrewListItem
  loadMoreMode?: boolean
  onCancel: () => void
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
}) {
  return (
    <form action={deleteUserAction} className="space-y-4">
      <input type="hidden" name="profileId" value={crew.profileId} />
      <UsersScopeHiddenInputs
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        redirectTo={redirectTo}
        scope={scope}
        selectedTeamId={selectedTeamId}
      />

      <DeleteUserFooter onCancel={onCancel} />
    </form>
  )
}

function DeleteUserSurface({
  crew,
  currentPage,
  loadMoreMode,
  open,
  onOpenChange,
  redirectTo,
  scope,
  selectedTeamId,
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Delete <strong>{crew.fullName}</strong>. This unlinks their team
            connections in this organization and deletes their user account.
          </DialogDescription>
        </DialogHeader>
        <DeleteUserForm
          crew={crew}
          currentPage={currentPage}
          loadMoreMode={loadMoreMode}
          onCancel={() => onOpenChange(false)}
          redirectTo={redirectTo}
          scope={scope}
          selectedTeamId={selectedTeamId}
        />
      </DialogContent>
    </Dialog>
  )
}

export function CrewActionsMenu({
  crew,
  currentPage,
  loadMoreMode,
  redirectTo,
  scope,
  selectedTeamId,
  showEdit = true,
  surface = "sheet",
  teamOptions,
  triggerClassName,
  unlinkLabel = "Unlink",
}: {
  crew: CrewListItem
  currentPage?: number
  loadMoreMode?: boolean
  redirectTo?: "/team-home" | "/users"
  scope: NavigationScope
  selectedTeamId?: string
  showEdit?: boolean
  surface?: CrewMemberFormSurface
  teamOptions: CrewTeamOption[]
  triggerClassName?: string
  unlinkLabel?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isUnlinkOpen, setIsUnlinkOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const editableCrew = isTeamCrewListItem(crew) ? crew : null
  const canEditCrew = showEdit && editableCrew !== null
  const canUnlinkCrew = crew.linkedTeams.length > 0

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
          {canEditCrew ? (
            <DropdownMenuItem
              onClick={() => {
                setIsEditOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : null}
          {canUnlinkCrew ? (
            <DropdownMenuItem
              onClick={() => {
                setIsUnlinkOpen(true)
              }}
            >
              {unlinkLabel}
            </DropdownMenuItem>
          ) : null}
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

      {canEditCrew && editableCrew ? (
        <EditCrewSurface
          crew={editableCrew}
          currentPage={currentPage}
          loadMoreMode={loadMoreMode}
          teamOptions={teamOptions}
          scope={scope}
          selectedTeamId={selectedTeamId}
          surface={surface}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
        />
      ) : null}

      {canUnlinkCrew ? (
        <UnlinkCrewSurface
          crew={crew}
          currentPage={currentPage}
          loadMoreMode={loadMoreMode}
          redirectTo={redirectTo}
          scope={scope}
          selectedTeamId={selectedTeamId}
          open={isUnlinkOpen}
          onOpenChange={setIsUnlinkOpen}
        />
      ) : null}

      <DeleteUserSurface
        crew={crew}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        redirectTo={redirectTo}
        scope={scope}
        selectedTeamId={selectedTeamId}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  )
}
