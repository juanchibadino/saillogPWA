"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { createTeamAction } from "@/features/teams/actions"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function TeamDialogForm({
  organizationId,
  scope,
}: {
  organizationId: string
  scope: NavigationScope
}) {
  const [name, setName] = React.useState("")
  const [teamType, setTeamType] = React.useState("")
  const canSubmit = name.trim().length > 0 && teamType.trim().length > 0

  return (
    <form action={createTeamAction} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="create-team-name">Team name</Label>
        <Input
          id="create-team-name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="ARG 49er"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-team-type">Team type</Label>
        <Input
          id="create-team-type"
          name="teamType"
          required
          value={teamType}
          onChange={(event) => setTeamType(event.target.value)}
          placeholder="49er, ILCA, Nacra 17"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          Create team
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateTeamDialog({
  organizationId,
  scope,
  disabled,
}: {
  organizationId: string
  scope: NavigationScope
  disabled: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Add a new team inside the active organization.
          </DialogDescription>
        </DialogHeader>

        <TeamDialogForm organizationId={organizationId} scope={scope} />
      </DialogContent>
    </Dialog>
  )
}
