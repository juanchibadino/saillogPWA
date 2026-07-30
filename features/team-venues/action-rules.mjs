import {
  canCreateTeamVenuesFromAccess,
  canManageTeamVenuesFromAccess,
} from "../../lib/auth/capability-rules.mjs"

export const TEAM_VENUE_CREATE_ACTIONS = ["create_link", "create_and_link"]
export const TEAM_VENUE_MANAGE_ACTIONS = ["update", "delete"]
export const TEAM_VENUE_WRITE_ACTIONS = [
  ...TEAM_VENUE_CREATE_ACTIONS,
  ...TEAM_VENUE_MANAGE_ACTIONS,
]

export function canRunTeamVenueWriteAction(input) {
  if (TEAM_VENUE_CREATE_ACTIONS.includes(input.action)) {
    return canCreateTeamVenuesFromAccess({
      context: input.context,
      organizationId: input.organizationId,
      teamId: input.teamId,
    })
  }

  if (TEAM_VENUE_MANAGE_ACTIONS.includes(input.action)) {
    return canManageTeamVenuesFromAccess({
      context: input.context,
      organizationId: input.organizationId,
      teamId: input.teamId,
    })
  }

  return false
}

export function canDeleteTeamVenueLink(input) {
  return input.totalCampCount === 0
}
