const ORGANIZATION_ADMIN_ROLE = "organization_admin"
const TEAM_STRUCTURE_MANAGER_ROLES = ["team_admin", "coach"]
const TEAM_OPERATION_CREATOR_ROLES = ["team_admin", "coach", "crew"]
const TEAM_SESSION_MANAGER_ROLES = ["team_admin", "coach", "crew"]
const TEAM_FINANCE_MANAGER_ROLES = ["team_admin"]

function hasActiveTeamRole(context, teamId, roles) {
  return context.teamMemberships.some(
    (membership) =>
      membership.team_id === teamId &&
      membership.is_active &&
      roles.includes(membership.role),
  )
}

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

  return hasActiveTeamRole(context, input.teamId, TEAM_STRUCTURE_MANAGER_ROLES)
}

export function canCreateTeamVenuesFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  if (canManageOrganizationOperationsFromAccess(input)) {
    return true
  }

  return hasActiveTeamRole(context, input.teamId, TEAM_OPERATION_CREATOR_ROLES)
}

export function canCreateCampsFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  if (canManageOrganizationOperationsFromAccess(input)) {
    return true
  }

  return hasActiveTeamRole(context, input.teamId, TEAM_OPERATION_CREATOR_ROLES)
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

  return hasActiveTeamRole(context, input.teamId, TEAM_SESSION_MANAGER_ROLES)
}

export function canManageTeamFinanceFromAccess(input) {
  const context = input.context

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true
  }

  if (canManageOrganizationOperationsFromAccess(input)) {
    return true
  }

  return hasActiveTeamRole(context, input.teamId, TEAM_FINANCE_MANAGER_ROLES)
}
