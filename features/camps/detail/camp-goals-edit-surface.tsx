"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { Textarea } from "@/components/ui/textarea"
import { updateCampGoalsAction } from "@/features/camps/actions"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"

type CampGoalsEditSurfaceKind = "drawer" | "sheet"

type CampGoalsEditSurfaceProps = {
  campId: string
  goals: string | null
  scope: NavigationScope
}

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

function CampGoalsFieldset(props: {
  children: React.ReactNode
  surface: CampGoalsEditSurfaceKind
}) {
  const { pending } = useFormStatus()
  const className =
    props.surface === "drawer"
      ? "m-0 min-h-0 min-w-0 flex-1 overflow-y-auto border-0 px-4 pb-6 pt-0"
      : "m-0 min-h-0 min-w-0 flex-1 overflow-y-auto border-0 px-4 pb-4 pt-0"

  return (
    <fieldset disabled={pending} className={className}>
      {props.children}
    </fieldset>
  )
}

function CampGoalsSubmitButton(props: { surface: CampGoalsEditSurfaceKind }) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className={props.surface === "drawer" ? "h-11 w-full" : undefined}
    >
      {pending ? (
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

export function CampGoalsEditSurface({
  campId,
  goals,
  scope,
}: CampGoalsEditSurfaceProps) {
  const isMobile = useIsMobile()
  const [nextGoals, setNextGoals] = React.useState(goals ?? "")
  const textareaId = React.useId()

  function renderForm(surface: CampGoalsEditSurfaceKind) {
    const isDrawer = surface === "drawer"

    return (
      <form action={updateCampGoalsAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="campId" value={campId} />
        <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
        {scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="scopeTab" value="goals" />

        <CampGoalsFieldset surface={surface}>
          <div className={isDrawer ? "flex min-h-full flex-col gap-2" : "space-y-2"}>
            <Label htmlFor={textareaId}>Goals</Label>
            <Textarea
              id={textareaId}
              name="goals"
              rows={12}
              maxLength={4000}
              value={nextGoals}
              onChange={(event) => setNextGoals(event.target.value)}
              onFocus={isDrawer ? keepMobileFieldVisible : undefined}
              className={isDrawer ? "min-h-60 resize-none scroll-my-8 text-base" : undefined}
              placeholder="Write camp goals, priorities, and execution focus..."
            />
            <p className="text-xs text-muted-foreground">{nextGoals.length}/4000</p>
          </div>
        </CampGoalsFieldset>

        {isDrawer ? (
          <DrawerFooter className="shrink-0 border-t">
            <CampGoalsSubmitButton surface={surface} />
          </DrawerFooter>
        ) : (
          <SheetFooter className="shrink-0 border-t sm:justify-end">
            <CampGoalsSubmitButton surface={surface} />
          </SheetFooter>
        )}
      </form>
    )
  }

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" size="default" className="h-11 px-4">
            Edit
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>Edit camp goals</DrawerTitle>
            <DrawerDescription>
              Update the current goals and priorities for this camp.
            </DrawerDescription>
          </DrawerHeader>
          {renderForm("drawer")}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>Edit camp goals</SheetTitle>
          <SheetDescription>
            Update the current goals and priorities for this camp.
          </SheetDescription>
        </SheetHeader>
        {renderForm("sheet")}
      </SheetContent>
    </Sheet>
  )
}
