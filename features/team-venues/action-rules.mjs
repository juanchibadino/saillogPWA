import { canManageTeamVenuesFromAccess } from "../../lib/auth/capability-rules.mjs"

export const TEAM_VENUE_WRITE_ACTIONS = [
  "create_link",
  "create_and_link",
  "update",
  "delete",
]

export function canRunTeamVenueWriteAction(input) {
  if (!TEAM_VENUE_WRITE_ACTIONS.includes(input.action)) {
    return false
  }

  return canManageTeamVenuesFromAccess({
    context: input.context,
    organizationId: input.organizationId,
    teamId: input.teamId,
  })
}

export function canDeleteTeamVenueLink(input) {
  return input.totalCampCount === 0
}
