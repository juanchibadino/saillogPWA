"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { createOrganizationAction } from "@/features/organizations/actions"
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

function OrganizationDialogForm({
  scope,
}: {
  scope: NavigationScope | null
}) {
  const [name, setName] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState("")
  const canSubmit = name.trim().length > 0

  return (
    <form action={createOrganizationAction} className="space-y-4">
      {scope ? <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} /> : null}
      {scope?.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="create-organization-name">Organization name</Label>
        <Input
          id="create-organization-name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="ENARD Argentina"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-organization-avatar-url">Avatar URL (optional)</Label>
        <Input
          id="create-organization-avatar-url"
          name="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          Create organization
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateOrganizationDialog({
  scope,
  disabled,
}: {
  scope: NavigationScope | null
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
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Add a new organization record to Sailog.
          </DialogDescription>
        </DialogHeader>

        <OrganizationDialogForm scope={scope} />
      </DialogContent>
    </Dialog>
  )
}
