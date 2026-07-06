import type { AccessContext } from "@/lib/auth/access"

type CapabilityAccessContext = Pick<
  AccessContext,
  "effectiveRoles" | "organizationMemberships" | "teamMemberships"
>

export function canManageOrganizationOperationsFromAccess(input: {
  context: CapabilityAccessContext
  organizationId: string
}): boolean

export function canManageTeamVenuesFromAccess(input: {
  context: CapabilityAccessContext
  organizationId: string
  teamId: string
}): boolean

export function canManageTeamSessionsFromAccess(input: {
  context: CapabilityAccessContext
  organizationId: string
  teamId: string
}): boolean
