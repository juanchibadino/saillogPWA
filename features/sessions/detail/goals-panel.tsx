"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { DrawerFooter } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { SheetFooter } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { updateSessionGoalsAction } from "@/features/sessions/detail-actions"
import {
  ResponsiveEditSurface,
  type ResponsiveEditSurfaceKind,
} from "@/features/sessions/detail/responsive-edit-surface"
import type { NavigationScope } from "@/lib/navigation/types"

function GoalsDialogFieldset(props: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset disabled={pending} className={props.className ?? "space-y-4"}>
      {props.children}
    </fieldset>
  )
}

function GoalsDialogSubmitButton(props: { className?: string }) {
  const { pending } = useFormStatus()
  const isPending = pending

  return (
    <Button type="submit" disabled={isPending} className={props.className}>
      {isPending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving...
        </>
      ) : (
        "Save"
      )}
    </Button>
  )
}

function GoalsEditDialog(input: {
  sessionId: string
  scope: NavigationScope
  goals: string | null
}) {

  const [goals, setGoals] = React.useState(input.goals ?? "")

  function keepMobileFieldVisible(event: React.FocusEvent<HTMLElement>) {
    const target = event.currentTarget

    window.setTimeout(() => {
      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      })
    }, 120)
  }

  function renderGoalsForm(surface: ResponsiveEditSurfaceKind) {
    const isDrawer = surface === "drawer"

    return (
      <form action={updateSessionGoalsAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="sessionId" value={input.sessionId} />
        <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
        {input.scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="scopeTab" value="goals" />

        <GoalsDialogFieldset
          className={
            isDrawer
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4"
              : "min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          }
        >
          <div className={isDrawer ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2"}>
            <Label htmlFor={`session-goals-${input.sessionId}`}>Goals</Label>
            <Textarea
              id={`session-goals-${input.sessionId}`}
              name="goals"
              className={isDrawer ? "min-h-0 flex-1 resize-none scroll-my-8 text-base" : undefined}
              rows={12}
              maxLength={4000}
              value={goals}
              onFocus={isDrawer ? keepMobileFieldVisible : undefined}
              onChange={(event) => setGoals(event.target.value)}
              placeholder="Write session goals, priorities, and execution focus..."
            />
            <p className="text-xs text-muted-foreground">{goals.length}/4000</p>
          </div>
        </GoalsDialogFieldset>

        {surface === "drawer" ? (
          <DrawerFooter className="shrink-0 border-t">
            <GoalsDialogSubmitButton className="h-11 w-full" />
          </DrawerFooter>
        ) : (
          <SheetFooter className="shrink-0 border-t">
            <GoalsDialogSubmitButton />
          </SheetFooter>
        )}
      </form>
    )
  }

  return (
    <ResponsiveEditSurface
      title="Edit session goals"
      description="Update the goals and execution focus for this session."
      drawerContentClassName="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
      hideDrawerTitle
    >
      {({ surface }) => renderGoalsForm(surface)}
    </ResponsiveEditSurface>
  )
}

export type GoalsPanelProps = {
  sessionId: string
  scope: NavigationScope
  goals: string | null
  canManageSession: boolean
}

export function GoalsPanel(input: GoalsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Goals</h3>
        </div>
        {input.canManageSession ? (
          <GoalsEditDialog
            sessionId={input.sessionId}
            scope={input.scope}
            goals={input.goals}
          />
        ) : null}
      </div>

      <div className="rounded-lg border p-4">
        {input.goals && input.goals.trim().length > 0 ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{input.goals}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No goals set for this session yet.</p>
        )}
      </div>
    </div>
  )
}
