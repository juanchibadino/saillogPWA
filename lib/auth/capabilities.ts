import type { AccessContext } from "@/lib/auth/access";
import type { Database } from "@/types/database";

type TeamRole = Database["public"]["Enums"]["team_role_type"];
type OrganizationRole = Database["public"]["Enums"]["organization_role_type"];

const ORGANIZATION_ADMIN_ROLE: OrganizationRole = "organization_admin";
const TEAM_STRUCTURE_MANAGER_ROLES: TeamRole[] = ["team_admin", "coach"];
const TEAM_SESSION_MANAGER_ROLES: TeamRole[] = ["team_admin", "coach", "crew"];

function hasOrganizationRole(
  context: AccessContext,
  organizationId: string,
  role: OrganizationRole,
): boolean {
  return context.organizationMemberships.some(
    (membership) =>
      membership.organization_id === organizationId && membership.role === role,
  );
}

function hasTeamRole(
  context: AccessContext,
  teamId: string,
  roles: TeamRole[],
): boolean {
  return context.teamMemberships.some(
    (membership) =>
      membership.team_id === teamId &&
      membership.is_active &&
      roles.includes(membership.role),
  );
}

export function isSuperAdmin(context: AccessContext): boolean {
  return context.effectiveRoles.globalRole === "super_admin";
}

export function canManageOrganizationOperations(
  context: AccessContext,
  organizationId: string,
): boolean {
  return (
    isSuperAdmin(context) ||
    hasOrganizationRole(context, organizationId, ORGANIZATION_ADMIN_ROLE)
  );
}

export function canManageTeamStructure(input: {
  context: AccessContext;
  organizationId: string;
  teamId: string;
}): boolean {
  return (
    canManageOrganizationOperations(input.context, input.organizationId) ||
    hasTeamRole(input.context, input.teamId, TEAM_STRUCTURE_MANAGER_ROLES)
  );
}

export function canManageTeamSessions(input: {
  context: AccessContext;
  organizationId: string;
  teamId: string;
}): boolean {
  return (
    canManageOrganizationOperations(input.context, input.organizationId) ||
    hasTeamRole(input.context, input.teamId, TEAM_SESSION_MANAGER_ROLES)
  );
}
