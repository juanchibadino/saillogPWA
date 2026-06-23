"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { DrawerFooter } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { SheetFooter } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { updateSessionResultsAction } from "@/features/sessions/actions"
import {
  ResponsiveEditSurface,
  type ResponsiveEditSurfaceKind,
} from "@/features/sessions/detail/responsive-edit-surface"
import type { NavigationScope } from "@/lib/navigation/types"

function renderTextValue(value: string | null): string {
  if (!value) {
    return "—"
  }

  return value
}

function ResultsEditDialog(input: {
  sessionId: string
  scope: NavigationScope
  resultNotes: string | null
}) {
  function ResultsDialogFieldset(props: {
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

  const [resultNotes, setResultNotes] = React.useState(input.resultNotes ?? "")

  function ResultsDialogSubmitButton() {
    const { pending } = useFormStatus()
    const isPending = pending

    return (
      <Button type="submit" disabled={isPending}>
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

  function renderResultsForm(surface: ResponsiveEditSurfaceKind) {
    return (
      <form action={updateSessionResultsAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="sessionId" value={input.sessionId} />
        <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
        {input.scope.activeTeamId ? (
          <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
        ) : null}
        <input type="hidden" name="scopeTab" value="results" />

        <ResultsDialogFieldset className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor={`result-notes-${input.sessionId}`}>Result notes</Label>
            <Textarea
              id={`result-notes-${input.sessionId}`}
              name="resultNotes"
              rows={10}
              maxLength={4000}
              value={resultNotes}
              onChange={(event) => setResultNotes(event.target.value)}
              placeholder="Race result details, fleet notes, penalties, and post-race comments..."
            />
          </div>
        </ResultsDialogFieldset>

        {surface === "drawer" ? (
          <DrawerFooter className="shrink-0 border-t">
            <ResultsDialogSubmitButton />
          </DrawerFooter>
        ) : (
          <SheetFooter className="shrink-0 border-t">
            <ResultsDialogSubmitButton />
          </SheetFooter>
        )}
      </form>
    )
  }

  return (
    <ResponsiveEditSurface
      title="Edit regatta results"
      description="Save race outcomes or any free-form result notes for this session."
    >
      {({ surface }) => renderResultsForm(surface)}
    </ResponsiveEditSurface>
  )
}

export type ResultsPanelProps = {
  sessionId: string
  scope: NavigationScope
  resultNotes: string | null
  canManageSession: boolean
}

export function ResultsPanel(input: ResultsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Results</h3>
        </div>
        {input.canManageSession ? (
          <ResultsEditDialog
            sessionId={input.sessionId}
            scope={input.scope}
            resultNotes={input.resultNotes}
          />
        ) : null}
      </div>

      <div className="rounded-lg border p-4">
        <p className="whitespace-pre-wrap text-sm">{renderTextValue(input.resultNotes)}</p>
      </div>
    </div>
  )
}
