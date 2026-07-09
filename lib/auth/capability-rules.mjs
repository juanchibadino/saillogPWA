const ORGANIZATION_ADMIN_ROLE = "organization_admin"
const TEAM_STRUCTURE_MANAGER_ROLES = ["team_admin", "coach"]
const TEAM_SESSION_MANAGER_ROLES = ["team_admin", "coach", "crew"]

export function canManageOrganizationOperationsFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  return context.organizationMemberships.some(
    (membership) =>
      membership.organization_id === input.organizationId &&
      membership.role === ORGANIZATION_ADMIN_ROLE,
  )
}

export function canManageTeamVenuesFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  if (canManageOrganizationOperationsFromAccess(input)) {
    return true
  }

  return context.teamMemberships.some(
    (membership) =>
      membership.team_id === input.teamId &&
      membership.is_active &&
      TEAM_STRUCTURE_MANAGER_ROLES.includes(membership.role),
  )
}

export function canManageTeamSessionsFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  const hasOrganizationAdminRole = context.organizationMemberships.some(
    (membership) =>
      membership.organization_id === input.organizationId &&
      membership.role === ORGANIZATION_ADMIN_ROLE,
  )

  if (hasOrganizationAdminRole) {
    return true
  }

  return context.teamMemberships.some(
    (membership) =>
      membership.team_id === input.teamId &&
      membership.is_active &&
      TEAM_SESSION_MANAGER_ROLES.includes(membership.role),
  )
}
