const TEAM_MEMBER_INVITE_ROLES = new Set(["team_admin", "coach", "crew"])

export function resolveMemberInviteTarget(input) {
  if (input.role === "organization_admin") {
    return {
      kind: "organization",
      teamId: null,
      teamRole: null,
    }
  }

  if (!TEAM_MEMBER_INVITE_ROLES.has(input.role) || !input.teamId) {
    return null
  }

  return {
    kind: "team",
    teamId: input.teamId,
    teamRole: input.role,
  }
}
