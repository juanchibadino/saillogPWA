type GlobalRole = "super_admin" | null
type OrganizationRole = "organization_admin"
type TeamRole = "team_admin" | "coach" | "crew"

export declare function shouldTeamUserLandOnTeamHome(input: {
  globalRole: GlobalRole
  organizationRoles: OrganizationRole[]
  teamRoles: TeamRole[]
}): boolean
