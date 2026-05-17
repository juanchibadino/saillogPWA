import { redirect } from "next/navigation";

import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import { resolveNavigationScope } from "@/lib/navigation/scope";

function buildTeamHomePath(input: {
  activeOrgId: string;
  activeTeamId: string | null;
}): string {
  const params = new URLSearchParams();
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrgId);

  if (input.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId);
  }

  return `/team-home?${params.toString()}`;
}

function shouldCoachLandOnTeamHome(input: {
  globalRole: "super_admin" | null;
  organizationRoles: Array<"organization_admin">;
  teamRoles: Array<"team_admin" | "coach" | "crew">;
}): boolean {
  if (input.globalRole === "super_admin") {
    return false;
  }

  if (input.organizationRoles.includes("organization_admin")) {
    return false;
  }

  return input.teamRoles.includes("coach");
}

export default async function PostAuthPage() {
  const context = await requireAuthenticatedAccessContext();

  if (!hasAppAccess(context)) {
    redirect("/onboarding");
  }

  if (
    shouldCoachLandOnTeamHome({
      globalRole: context.effectiveRoles.globalRole,
      organizationRoles: context.effectiveRoles.organizationRoles,
      teamRoles: context.effectiveRoles.teamRoles,
    })
  ) {
    const navigation = await resolveNavigationScope({
      context,
      searchParams: {},
    });

    if (navigation.scope) {
      redirect(buildTeamHomePath(navigation.scope));
    }

    redirect("/team-home");
  }

  redirect("/dashboard");
}
