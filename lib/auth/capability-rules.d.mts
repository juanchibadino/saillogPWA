import type { AccessContext } from "@/lib/auth/access"

export function canManageTeamSessionsFromAccess(input: {
  context: Pick<
    AccessContext,
    "effectiveRoles" | "organizationMemberships" | "teamMemberships"
  >
  organizationId: string
  teamId: string
}): boolean
