import "server-only";

import { redirect } from "next/navigation";

import type { AuthenticatedAccessContext } from "@/lib/auth/access";
import { canAccessOrganizationRoutes } from "@/lib/auth/organization-route-access.mjs";
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import { resolveNavigationScope } from "@/lib/navigation/scope";
import type {
  NavigationScope,
  ResolvedNavigationScope,
  ScopeSearchParams,
} from "@/lib/navigation/types";

function buildScopedTeamHomePath(scope: NavigationScope | null): string {
  if (!scope) {
    return "/team-home";
  }

  const params = new URLSearchParams();
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, scope.activeOrgId);

  if (scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, scope.activeTeamId);
  }

  return `/team-home?${params.toString()}`;
}

export async function requireOrganizationRouteAccess(input: {
  context: AuthenticatedAccessContext;
  searchParams: ScopeSearchParams;
}): Promise<ResolvedNavigationScope> {
  const navigation = await resolveNavigationScope(input);

  if (
    !canAccessOrganizationRoutes({
      globalRole: input.context.effectiveRoles.globalRole,
      organizationRoles: input.context.effectiveRoles.organizationRoles,
      teamRoles: input.context.effectiveRoles.teamRoles,
    })
  ) {
    redirect(buildScopedTeamHomePath(navigation.scope));
  }

  return navigation;
}
