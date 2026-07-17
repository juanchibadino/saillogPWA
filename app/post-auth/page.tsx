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
import { resolvePostAuthLandingPath } from "@/lib/auth/post-auth-route-state.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function buildScopedPath(input: {
  path: string;
  activeOrgId: string;
  activeTeamId: string | null;
}): string {
  const params = new URLSearchParams();
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.activeOrgId);

  if (input.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.activeTeamId);
  }

  return `${input.path}?${params.toString()}`;
}

function buildTeamHomePath(input: {
  activeOrgId: string;
  activeTeamId: string | null;
}): string {
  return buildScopedPath({
    path: "/team-home",
    activeOrgId: input.activeOrgId,
    activeTeamId: input.activeTeamId,
  });
}

async function markFirstSeenIfNeeded(input: {
  userId: string;
  firstSeenAt: string | null | undefined;
}): Promise<void> {
  if (input.firstSeenAt) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("profiles")
    .update({ first_seen_at: new Date().toISOString() })
    .eq("id", input.userId)
    .is("first_seen_at", null);
}

export default async function PostAuthPage() {
  const context = await requireAuthenticatedAccessContext();

  if (!hasAppAccess(context)) {
    redirect("/onboarding");
  }

  await markFirstSeenIfNeeded({
    userId: context.user.id,
    firstSeenAt: context.profile?.first_seen_at,
  });

  const landingPath = resolvePostAuthLandingPath({
    globalRole: context.effectiveRoles.globalRole,
    organizationRoles: context.effectiveRoles.organizationRoles,
    teamRoles: context.effectiveRoles.teamRoles,
  });

  if (landingPath === "/team-home") {
    const navigation = await resolveNavigationScope({
      context,
      searchParams: {},
    });

    if (navigation.scope) {
      redirect(buildTeamHomePath(navigation.scope));
    }

    redirect("/team-home");
  }

  const navigation = await resolveNavigationScope({
    context,
    searchParams: {},
  });

  if (navigation.scope) {
    redirect(
      buildScopedPath({
        path: landingPath,
        activeOrgId: navigation.scope.activeOrgId,
        activeTeamId: navigation.scope.activeTeamId,
      }),
    );
  }

  redirect(landingPath);
}
