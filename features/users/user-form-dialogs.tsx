"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { deleteCrewMemberAction, updateCrewMemberAction } from "@/features/users/actions"
import type { CrewListItem, CrewTeamOption } from "@/features/users/data"
import type { NavigationScope } from "@/lib/navigation/types"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function normalizeNameInput(value: string): string {
  return value.trim()
}

function EditCrewDialog({
  crew,
  teamOptions,
  scope,
  selectedTeamId,
  open,
  onOpenChange,
}: {
  crew: CrewListItem
  teamOptions: CrewTeamOption[]
  scope: NavigationScope
  selectedTeamId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [firstName, setFirstName] = React.useState(crew.firstName)
  const [lastName, setLastName] = React.useState(crew.lastName)
  const [role, setRole] = React.useState(crew.role)
  const [teamId, setTeamId] = React.useState(crew.teamId)
  const [avatarUrl, setAvatarUrl] = React.useState(crew.avatarUrl ?? "")

  React.useEffect(() => {
    if (!open) {
      return
    }

    setFirstName(crew.firstName)
    setLastName(crew.lastName)
    setRole(crew.role)
    setTeamId(crew.teamId)
    setAvatarUrl(crew.avatarUrl ?? "")
  }, [crew, open])

  const canSubmit =
    normalizeNameInput(firstName).length > 0 &&
    normalizeNameInput(lastName).length > 0 &&
    role.length > 0 &&
    teamId.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{crew.fullName}</DialogDescription>
        </DialogHeader>

        <form action={updateCrewMemberAction} className="space-y-4">
          <input type="hidden" name="membershipId" value={crew.membershipId} />
          <input type="hidden" name="profileId" value={crew.profileId} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedTeamId ? (
            <input type="hidden" name="scopeUsersTeamId" value={selectedTeamId} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-crew-first-name-${crew.membershipId}`}>Name</Label>
              <Input
                id={`edit-crew-first-name-${crew.membershipId}`}
                name="firstName"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit-crew-last-name-${crew.membershipId}`}>Lastname</Label>
              <Input
                id={`edit-crew-last-name-${crew.membershipId}`}
                name="lastName"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit-crew-role-${crew.membershipId}`}>Role</Label>
              <select
                id={`edit-crew-role-${crew.membershipId}`}
                name="role"
                required
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as CrewListItem["role"])
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="team_admin">Team Admin</option>
                <option value="coach">Coach</option>
                <option value="crew">Crew</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit-crew-team-${crew.membershipId}`}>Team</Label>
              <select
                id={`edit-crew-team-${crew.membershipId}`}
                name="teamId"
                required
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
              >
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`edit-crew-avatar-${crew.membershipId}`}>Avatar URL</Label>
              <Input
                id={`edit-crew-avatar-${crew.membershipId}`}
                name="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCrewDialog({
  crew,
  scope,
  selectedTeamId,
  open,
  onOpenChange,
}: {
  crew: CrewListItem
  scope: NavigationScope
  selectedTeamId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This removes <strong>{crew.fullName}</strong> from the selected team.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteCrewMemberAction} className="space-y-4">
          <input type="hidden" name="membershipId" value={crew.membershipId} />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedTeamId ? (
            <input type="hidden" name="scopeUsersTeamId" value={selectedTeamId} />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CrewActionsMenu({
  crew,
  teamOptions,
  scope,
  selectedTeamId,
}: {
  crew: CrewListItem
  teamOptions: CrewTeamOption[]
  scope: NavigationScope
  selectedTeamId?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" />}
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

      <EditCrewDialog
        crew={crew}
        teamOptions={teamOptions}
        scope={scope}
        selectedTeamId={selectedTeamId}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <DeleteCrewDialog
        crew={crew}
        scope={scope}
        selectedTeamId={selectedTeamId}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  )
}
