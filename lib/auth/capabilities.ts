import type { AccessContext } from "@/lib/auth/access";
import {
  canManageOrganizationOperationsFromAccess,
  canManageTeamFinanceFromAccess,
  canManageTeamSessionsFromAccess,
  canManageTeamVenuesFromAccess,
} from "@/lib/auth/capability-rules.mjs";
import type { Database } from "@/types/database";

type TeamRole = Database["public"]["Enums"]["team_role_type"];
const TEAM_STRUCTURE_MANAGER_ROLES: TeamRole[] = ["team_admin", "coach"];
const TEAM_CAMP_DELETE_ROLES: TeamRole[] = ["coach"];

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
  return canManageOrganizationOperationsFromAccess({ context, organizationId });
}

export function isOrganizationAdmin(
  context: AccessContext,
  organizationId: string,
): boolean {
  return context.organizationMemberships.some(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.role === "organization_admin",
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
  return canManageTeamSessionsFromAccess(input);
}

export function canManageTeamVenues(input: {
  context: AccessContext;
  organizationId: string;
  teamId: string;
}): boolean {
  return canManageTeamVenuesFromAccess(input);
}

export function canManageTeamFinance(input: {
  context: AccessContext;
  organizationId: string;
  teamId: string;
}): boolean {
  return canManageTeamFinanceFromAccess(input);
}

export function canDeleteCamps(input: {
  context: AccessContext;
  organizationId: string;
  teamId: string;
}): boolean {
  return (
    canManageOrganizationOperations(input.context, input.organizationId) ||
    hasTeamRole(input.context, input.teamId, TEAM_CAMP_DELETE_ROLES)
  );
}
