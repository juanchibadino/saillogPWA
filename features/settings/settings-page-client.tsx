"use client"

import * as React from "react"
import {
  Building2Icon,
  CoinsIcon,
  Loader2Icon,
  MailCheckIcon,
  SaveIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  updateOrganizationSettingsAction,
  updateTeamSettingsAction,
  updateUserSettingsAction,
} from "@/features/settings/actions"
import type { SettingsPageData } from "@/features/settings/data"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type SettingsScope = {
  activeOrgId?: string
  activeTeamId?: string | null
}

type DecodedAvatarImageSource = {
  cleanup: () => void
  height: number
  source: CanvasImageSource
  width: number
}

const PROFILE_AVATAR_DIMENSION = 96
const PROFILE_AVATAR_MAX_BYTES = 32 * 1024
const PROFILE_AVATAR_WEBP_TYPE = "image/webp"
const PROFILE_AVATAR_QUALITY_LADDER = [0.56, 0.46, 0.36, 0.28] as const
const TEAM_TYPE_OPTIONS = ["49er", "49erFX", "Laser", "Nacra"] as const

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
      PROFILE_AVATAR_WEBP_TYPE,
      quality,
    )
  })
}

async function compressProfileAvatarFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file.")
  }

  const decodedImage = await decodeAvatarImageSource(file)

  try {
    const sourceSize = Math.min(decodedImage.width, decodedImage.height)
    const sourceX = Math.max(0, Math.floor((decodedImage.width - sourceSize) / 2))
    const sourceY = Math.max(0, Math.floor((decodedImage.height - sourceSize) / 2))
    const canvas = document.createElement("canvas")
    canvas.width = PROFILE_AVATAR_DIMENSION
    canvas.height = PROFILE_AVATAR_DIMENSION

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
      PROFILE_AVATAR_DIMENSION,
      PROFILE_AVATAR_DIMENSION,
    )

    let compressedBlob: Blob | null = null

    for (const quality of PROFILE_AVATAR_QUALITY_LADDER) {
      compressedBlob = await canvasToAvatarWebpBlob(canvas, quality)

      if (compressedBlob.size <= PROFILE_AVATAR_MAX_BYTES) {
        break
      }
    }

    if (!compressedBlob) {
      throw new Error("Could not compress this avatar.")
    }

    if (compressedBlob.type !== PROFILE_AVATAR_WEBP_TYPE) {
      throw new Error("This browser could not create a WebP avatar.")
    }

    if (compressedBlob.size > PROFILE_AVATAR_MAX_BYTES) {
      throw new Error("This avatar is still too large after compression.")
    }

    return new File([compressedBlob], buildCompressedAvatarFileName(file.name), {
      type: PROFILE_AVATAR_WEBP_TYPE,
      lastModified: Date.now(),
    })
  } finally {
    decodedImage.cleanup()
  }
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return "DU"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

function SettingsScopeHiddenInputs({ scope }: { scope: SettingsScope }) {
  return (
    <>
      {scope.activeOrgId ? (
        <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      ) : null}
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
    </>
  )
}

function SettingsSubmitButton({
  disabled,
  pendingLabel,
}: {
  disabled?: boolean
  pendingLabel: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        <>
          <SaveIcon className="size-4" />
          Save
        </>
      )}
    </Button>
  )
}

function SettingsPanel({
  children,
  description,
  icon,
  locked,
  title,
}: {
  children: React.ReactNode
  description: string
  icon: React.ReactNode
  locked?: boolean
  title: string
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {locked ? (
          <Badge variant="secondary" className="shrink-0">
            Read-only
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function SettingsFieldset({
  children,
  disabled,
}: {
  children: React.ReactNode
  disabled?: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={disabled || pending}
      className="grid gap-4 disabled:pointer-events-none disabled:opacity-70"
    >
      {children}
    </fieldset>
  )
}

function buildTeamTypeOptions(currentTeamType: string): string[] {
  const options = [...TEAM_TYPE_OPTIONS]

  if (currentTeamType && !options.includes(currentTeamType as typeof TEAM_TYPE_OPTIONS[number])) {
    return [currentTeamType, ...options]
  }

  return options
}

function UserSettingsForm({
  data,
  scope,
}: {
  data: SettingsPageData["user"]
  scope: SettingsScope
}) {
  const [avatarErrorMessage, setAvatarErrorMessage] = React.useState("")
  const fullName = `${data.firstName} ${data.lastName}`.trim()
  const inputClassName = "h-11 px-3 text-base md:text-sm"

  async function submitUserSettingsForm(formData: FormData): Promise<void> {
    setAvatarErrorMessage("")

    const avatarFile = formData.get("avatarFile")

    if (avatarFile instanceof File && avatarFile.size > 0) {
      try {
        const compressedAvatarFile = await compressProfileAvatarFile(avatarFile)
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

    await updateUserSettingsAction(formData)
  }

  return (
    <SettingsPanel
      title="User"
      description="Personal profile and login email."
      icon={<UserIcon className="size-4" />}
    >
      <form action={submitUserSettingsForm} className="grid gap-5 px-4 py-4 sm:px-5">
        <SettingsScopeHiddenInputs scope={scope} />
        <input type="hidden" name="avatarUrl" value={data.avatarUrl ?? ""} />

        <SettingsFieldset>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 rounded-xl">
              {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={fullName} /> : null}
              <AvatarFallback className="rounded-xl text-sm font-medium">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName || "Dock Out User"}</p>
              <p className="truncate text-sm text-muted-foreground">{data.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-user-first-name">First name</Label>
              <Input
                id="settings-user-first-name"
                name="firstName"
                required
                defaultValue={data.firstName}
                autoComplete="given-name"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-user-last-name">Last name</Label>
              <Input
                id="settings-user-last-name"
                name="lastName"
                required
                defaultValue={data.lastName}
                autoComplete="family-name"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-user-email">Email</Label>
            <Input
              id="settings-user-email"
              name="email"
              type="email"
              required
              defaultValue={data.email}
              autoComplete="email"
              className={inputClassName}
            />
            {data.pendingEmail ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MailCheckIcon className="size-4" />
                Verification pending for {data.pendingEmail}.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-user-avatar">Avatar</Label>
            <Input
              id="settings-user-avatar"
              name="avatarFile"
              type="file"
              accept="image/*"
              onChange={() => setAvatarErrorMessage("")}
              className={inputClassName}
            />
            {avatarErrorMessage ? (
              <p className="text-sm text-destructive">{avatarErrorMessage}</p>
            ) : null}
          </div>
        </SettingsFieldset>

        <div className="flex justify-end">
          <SettingsSubmitButton pendingLabel="Saving..." />
        </div>
      </form>
    </SettingsPanel>
  )
}

function OrganizationSettingsForm({
  data,
  scope,
}: {
  data: SettingsPageData["organization"]
  scope: SettingsScope
}) {
  const [avatarErrorMessage, setAvatarErrorMessage] = React.useState("")
  const inputClassName = "h-11 px-3 text-base md:text-sm"

  if (!data) {
    return (
      <SettingsPanel
        title="Organization"
        description="Organization profile for the active scope."
        icon={<Building2Icon className="size-4" />}
        locked
      >
        <div className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
          No active organization context is available.
        </div>
      </SettingsPanel>
    )
  }

  async function submitOrganizationSettingsForm(formData: FormData): Promise<void> {
    setAvatarErrorMessage("")

    const avatarFile = formData.get("avatarFile")

    if (avatarFile instanceof File && avatarFile.size > 0) {
      try {
        const compressedAvatarFile = await compressProfileAvatarFile(avatarFile)
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

    await updateOrganizationSettingsAction(formData)
  }

  return (
    <SettingsPanel
      title="Organization"
      description="Organization profile and billing currency."
      icon={<Building2Icon className="size-4" />}
      locked={!data.canEdit}
    >
      <form action={submitOrganizationSettingsForm} className="grid gap-5 px-4 py-4 sm:px-5">
        <SettingsScopeHiddenInputs scope={scope} />
        <input type="hidden" name="organizationId" value={data.id} />
        <input type="hidden" name="avatarUrl" value={data.avatarUrl ?? ""} />

        <SettingsFieldset disabled={!data.canEdit}>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 rounded-xl">
              {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={data.name} /> : null}
              <AvatarFallback className="rounded-xl text-sm font-medium">
                {getInitials(data.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{data.name}</p>
              <p className="truncate text-sm text-muted-foreground">Active organization</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-organization-name">Name</Label>
              <Input
                id="settings-organization-name"
                name="name"
                required
                defaultValue={data.name}
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-organization-currency">Default currency</Label>
              <Input
                id="settings-organization-currency"
                name="defaultCurrencyCode"
                required
                defaultValue={data.defaultCurrencyCode}
                inputMode="text"
                maxLength={3}
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-organization-avatar">Avatar</Label>
              <Input
                id="settings-organization-avatar"
                name="avatarFile"
                type="file"
                accept="image/*"
                onChange={() => setAvatarErrorMessage("")}
                className={inputClassName}
              />
              {avatarErrorMessage ? (
                <p className="text-sm text-destructive">{avatarErrorMessage}</p>
              ) : null}
            </div>
          </div>
        </SettingsFieldset>

        <div className="flex justify-end">
          <SettingsSubmitButton disabled={!data.canEdit} pendingLabel="Saving..." />
        </div>
      </form>
    </SettingsPanel>
  )
}

function TeamSettingsForm({
  data,
  scope,
}: {
  data: SettingsPageData["team"]
  scope: SettingsScope
}) {
  const inputClassName = "h-11 px-3 text-base md:text-sm"
  const selectClassName = cn(
    "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-ring/50 focus-visible:ring-[3px] md:text-sm",
  )

  if (!data) {
    return (
      <SettingsPanel
        title="Team"
        description="Team profile for the active scope."
        icon={<UsersIcon className="size-4" />}
        locked
      >
        <div className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
          No active team context is available.
        </div>
      </SettingsPanel>
    )
  }

  return (
    <SettingsPanel
      title="Team"
      description="Team profile and expense visibility."
      icon={<UsersIcon className="size-4" />}
      locked={!data.canEdit}
    >
      <form action={updateTeamSettingsAction} className="grid gap-5 px-4 py-4 sm:px-5">
        <SettingsScopeHiddenInputs scope={scope} />
        <input type="hidden" name="organizationId" value={data.organizationId} />
        <input type="hidden" name="teamId" value={data.id} />

        <SettingsFieldset disabled={!data.canEdit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-team-name">Name</Label>
              <Input
                id="settings-team-name"
                name="name"
                required
                defaultValue={data.name}
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-team-type">Type</Label>
              <select
                id="settings-team-type"
                name="teamType"
                required
                defaultValue={data.teamType}
                className={selectClassName}
              >
                {data.teamType ? null : <option value="">Select type</option>}
                {buildTeamTypeOptions(data.teamType).map((teamType) => (
                  <option key={teamType} value={teamType}>
                    {teamType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  <CoinsIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="settings-team-expenses-show-team-totals">
                    See all team expenses
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Show team totals and team-scope exports on Expenses.
                  </p>
                </div>
              </div>
              <Switch
                id="settings-team-expenses-show-team-totals"
                name="expensesShowTeamTotals"
                defaultChecked={data.expensesShowTeamTotals}
                disabled={!data.canEditExpenseVisibility}
                className="shrink-0"
              />
            </div>
            {!data.canEditExpenseVisibility ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Only organization admins, team admins, and coaches can change this setting.
              </p>
            ) : null}
          </div>
        </SettingsFieldset>

        <div className="flex justify-end">
          <SettingsSubmitButton disabled={!data.canEdit} pendingLabel="Saving..." />
        </div>
      </form>
    </SettingsPanel>
  )
}

export function SettingsPageClient({
  data,
  scope,
}: {
  data: SettingsPageData
  scope: SettingsScope
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <UserSettingsForm data={data.user} scope={scope} />
      </div>
      <div className="grid gap-4">
        <OrganizationSettingsForm
          key={data.organization?.id ?? "no-organization"}
          data={data.organization}
          scope={scope}
        />
        <TeamSettingsForm
          key={data.team?.id ?? "no-team"}
          data={data.team}
          scope={scope}
        />
      </div>
    </div>
  )
}
