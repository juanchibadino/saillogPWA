import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrganizationMembershipRow =
  Database["public"]["Tables"]["organization_memberships"]["Row"];
type TeamMembershipRow = Database["public"]["Tables"]["team_memberships"]["Row"];

export type EffectiveRoles = {
  globalRole: ProfileRow["global_role"];
  organizationRoles: OrganizationMembershipRow["role"][];
  teamRoles: TeamMembershipRow["role"][];
};

export type AccessContext = {
  user: User | null;
  profile: ProfileRow | null;
  organizationMemberships: OrganizationMembershipRow[];
  teamMemberships: TeamMembershipRow[];
  effectiveRoles: EffectiveRoles;
};

export type AuthenticatedAccessContext = AccessContext & {
  user: User;
};

function buildEffectiveRoles(
  profile: ProfileRow | null,
  organizationMemberships: OrganizationMembershipRow[],
  teamMemberships: TeamMembershipRow[],
): EffectiveRoles {
  return {
    globalRole: profile?.global_role ?? null,
    organizationRoles: [...new Set(organizationMemberships.map((row) => row.role))],
    teamRoles: [...new Set(teamMemberships.map((row) => row.role))],
  };
}

export function hasAppAccess(context: AccessContext): boolean {
  if (!context.user || !context.profile) {
    return false;
  }

  if (context.effectiveRoles.globalRole === "super_admin") {
    return true;
  }

  return (
    context.organizationMemberships.length > 0 || context.teamMemberships.length > 0
  );
}

export async function getCurrentAccessContext(): Promise<AccessContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      organizationMemberships: [],
      teamMemberships: [],
      effectiveRoles: {
        globalRole: null,
        organizationRoles: [],
        teamRoles: [],
      },
    };
  }

  const [{ data: profile }, { data: organizationMemberships }, { data: teamMemberships }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("organization_memberships")
        .select("*")
        .eq("profile_id", user.id),
      supabase
        .from("team_memberships")
        .select("*")
        .eq("profile_id", user.id)
        .eq("is_active", true),
    ]);

  const orgRows = organizationMemberships ?? [];
  const teamRows = teamMemberships ?? [];

  return {
    user,
    profile: profile ?? null,
    organizationMemberships: orgRows,
    teamMemberships: teamRows,
    effectiveRoles: buildEffectiveRoles(profile ?? null, orgRows, teamRows),
  };
}

export async function requireAuthenticatedAccessContext(): Promise<AuthenticatedAccessContext> {
  const context = await getCurrentAccessContext();

  if (!context.user) {
    redirect("/sign-in");
  }

  return context as AuthenticatedAccessContext;
}
