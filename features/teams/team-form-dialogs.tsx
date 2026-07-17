"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { createTeamAction } from "@/features/teams/actions"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type TeamFormSurface = "drawer" | "sheet"

const TEAM_TYPE_OPTIONS = ["49er", "49erFX", "Nacra17", "Laser", "Other"] as const

function TeamDialogForm({
  currentPage,
  loadMoreMode,
  organizationId,
  scope,
  surface,
}: {
  currentPage?: number
  loadMoreMode?: boolean
  organizationId: string
  scope: NavigationScope
  surface: TeamFormSurface
}) {
  const [name, setName] = React.useState("")
  const [teamType, setTeamType] = React.useState("")
  const canSubmit = name.trim().length > 0 && teamType.trim().length > 0
  const inputClassName = surface === "drawer" ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background outline-none ring-ring/50 focus-visible:ring-[3px]",
    surface === "drawer" ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3 text-sm",
  )

  return (
    <form action={createTeamAction} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode === true && typeof currentPage === "number" && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMoreMode" value="1" />
      ) : null}

      <TeamDialogFieldset className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor={`create-team-${surface}-name`}>Team name</Label>
          <Input
            id={`create-team-${surface}-name`}
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ARG 49er"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`create-team-${surface}-type`}>Team type</Label>
          <select
            id={`create-team-${surface}-type`}
            name="teamType"
            required
            value={teamType}
            onChange={(event) => setTeamType(event.target.value)}
            className={selectClassName}
          >
            <option value="" disabled>
              Select team type
            </option>
            {TEAM_TYPE_OPTIONS.map((teamTypeOption) => (
              <option key={teamTypeOption} value={teamTypeOption}>
                {teamTypeOption}
              </option>
            ))}
          </select>
        </div>
      </TeamDialogFieldset>

      <TeamDialogFooter canSubmit={canSubmit} surface={surface} />
    </form>
  )
}

function TeamDialogFieldset({
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

function CreateTeamSubmitButton({
  canSubmit,
  className,
}: {
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
          Creating...
        </>
      ) : (
        "Create team"
      )}
    </Button>
  )
}

function TeamDialogFooter({
  canSubmit,
  surface,
}: {
  canSubmit: boolean
  surface: TeamFormSurface
}) {
  const button = (
    <CreateTeamSubmitButton
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

export function CreateTeamDialog({
  currentPage,
  organizationId,
  loadMoreMode,
  scope,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  currentPage?: number
  organizationId: string
  loadMoreMode?: boolean
  scope: NavigationScope
  disabled: boolean
  surface?: TeamFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [open, setOpen] = React.useState(false)
  const [formResetKey, setFormResetKey] = React.useState(0)
  const isFabTrigger = triggerVariant === "fab"
  const form = (
    <TeamDialogForm
      key={formResetKey}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      organizationId={organizationId}
      scope={scope}
      surface={surface}
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
          disabled={disabled}
          aria-label={isFabTrigger ? "New team" : undefined}
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
          {isFabTrigger ? <span className="sr-only">New team</span> : "New"}
        </button>

        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 text-left">
            <DrawerTitle>Create team</DrawerTitle>
          </DrawerHeader>
          {form}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        disabled={disabled}
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
        className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create team</SheetTitle>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  )
}
