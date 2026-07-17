type TeamRole = "team_admin" | "coach" | "crew"
type InviteRole = "organization_admin" | TeamRole

export declare function resolveMemberInviteTarget(input: {
  role: InviteRole
  teamId?: string
}):
  | {
      kind: "organization"
      teamId: null
      teamRole: null
    }
  | {
      kind: "team"
      teamId: string
      teamRole: TeamRole
    }
  | null
