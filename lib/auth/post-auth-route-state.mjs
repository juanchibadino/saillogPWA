const TEAM_HOME_ROLES = new Set(["team_admin", "coach", "crew"])

export function shouldTeamUserLandOnTeamHome(input) {
  if (input.globalRole === "super_admin") {
    return false
  }

  if (input.organizationRoles.includes("organization_admin")) {
    return false
  }

  return input.teamRoles.some((role) => TEAM_HOME_ROLES.has(role))
}
