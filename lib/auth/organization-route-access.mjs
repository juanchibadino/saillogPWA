export function canAccessOrganizationRoutes(input) {
  if (input.globalRole === "super_admin") {
    return true
  }

  return input.organizationRoles.includes("organization_admin")
}
