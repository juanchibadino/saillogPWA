import "server-only"

import type { AuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageOrganizationOperations,
  canManageTeamFinance,
} from "@/lib/auth/capabilities"
import type { ResolvedNavigationScope } from "@/lib/navigation/types"

type PendingEmailUserFields = {
  email_change_sent_at?: string | null
  new_email?: string | null
}

export type SettingsUserData = {
  avatarUrl: string | null
  email: string
  firstName: string
  lastName: string
  pendingEmail: string | null
}

export type SettingsOrganizationData = {
  avatarUrl: string | null
  canEdit: boolean
  defaultCurrencyCode: string
  id: string
  name: string
}

export type SettingsTeamData = {
  canEdit: boolean
  canEditExpenseVisibility: boolean
  expensesShowTeamTotals: boolean
  id: string
  name: string
  organizationId: string
  teamType: string
}

export type SettingsPageData = {
  organization: SettingsOrganizationData | null
  team: SettingsTeamData | null
  user: SettingsUserData
}

export function canUpdateTeamSettings(input: {
  context: AuthenticatedAccessContext
  organizationId: string
  teamId: string
}): boolean {
  if (canManageOrganizationOperations(input.context, input.organizationId)) {
    return true
  }

  return input.context.teamMemberships.some(
    (membership) =>
      membership.team_id === input.teamId &&
      membership.is_active &&
      (membership.role === "team_admin" ||
        membership.role === "coach" ||
        membership.role === "crew"),
  )
}

function getPendingEmail(user: AuthenticatedAccessContext["user"]): string | null {
  const userWithPendingEmail = user as AuthenticatedAccessContext["user"] &
    PendingEmailUserFields
  const pendingEmail = userWithPendingEmail.new_email?.trim()

  if (!pendingEmail || !userWithPendingEmail.email_change_sent_at) {
    return null
  }

  return pendingEmail
}

export function getSettingsPageData(input: {
  context: AuthenticatedAccessContext
  navigation: ResolvedNavigationScope
}): SettingsPageData {
  const activeOrganization = input.navigation.scope
    ? input.navigation.catalog.organizations.find(
        (organization) => organization.id === input.navigation.scope?.activeOrgId,
      ) ?? null
    : null
  const activeTeam =
    input.navigation.scope?.activeTeamId && activeOrganization
      ? input.navigation.catalog.teamsByOrganizationId[activeOrganization.id]?.find(
          (team) => team.id === input.navigation.scope?.activeTeamId,
        ) ?? null
      : null

  return {
    user: {
      avatarUrl: input.context.profile?.photo_url ?? null,
      email: input.context.user.email ?? input.context.profile?.email ?? "",
      firstName: input.context.profile?.first_name ?? "",
      lastName: input.context.profile?.last_name ?? "",
      pendingEmail: getPendingEmail(input.context.user),
    },
    organization: activeOrganization
        ? {
          avatarUrl: activeOrganization.avatarUrl,
          canEdit: canManageOrganizationOperations(input.context, activeOrganization.id),
          defaultCurrencyCode: activeOrganization.defaultCurrencyCode,
          id: activeOrganization.id,
          name: activeOrganization.name,
        }
      : null,
    team: activeTeam
      ? {
          canEdit: canUpdateTeamSettings({
            context: input.context,
            organizationId: activeTeam.organizationId,
            teamId: activeTeam.id,
          }),
          canEditExpenseVisibility: canManageTeamFinance({
            context: input.context,
            organizationId: activeTeam.organizationId,
            teamId: activeTeam.id,
          }),
          expensesShowTeamTotals: activeTeam.expensesShowTeamTotals,
          id: activeTeam.id,
          name: activeTeam.name,
          organizationId: activeTeam.organizationId,
          teamType: activeTeam.teamType ?? "",
        }
      : null,
  }
}
