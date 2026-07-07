import { canManageOrganizationOperationsFromAccess } from "../../lib/auth/capability-rules.mjs"

const TEAM_ASSESSMENT_MANAGER_ROLES = ["team_admin", "coach"]

export function canManageAssessmentsFromAccess(input) {
  const context = input.context

  if (
    canManageOrganizationOperationsFromAccess({
      context,
      organizationId: input.organizationId,
    })
  ) {
    return true
  }

  return context.teamMemberships.some(
    (membership) =>
      membership.team_id === input.teamId &&
      membership.is_active &&
      TEAM_ASSESSMENT_MANAGER_ROLES.includes(membership.role),
  )
}
