import "server-only";

import { cache } from "react";
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

type AccessContextWithoutUser = Omit<AccessContext, "user">;

const EMPTY_ROLES: EffectiveRoles = {
  globalRole: null,
  organizationRoles: [],
  teamRoles: [],
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

const loadAccessDataForUser = cache(
  async (userId: string): Promise<AccessContextWithoutUser> => {
    const supabase = await createServerSupabaseClient();
    const [{ data: profile }, { data: organizationMemberships }, { data: teamMemberships }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("organization_memberships")
          .select("*")
          .eq("profile_id", userId),
        supabase
          .from("team_memberships")
          .select("*")
          .eq("profile_id", userId)
          .eq("is_active", true),
      ]);

    const orgRows = organizationMemberships ?? [];
    const teamRows = teamMemberships ?? [];

    return {
      profile: profile ?? null,
      organizationMemberships: orgRows,
      teamMemberships: teamRows,
      effectiveRoles: buildEffectiveRoles(profile ?? null, orgRows, teamRows),
    };
  },
);

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
      effectiveRoles: EMPTY_ROLES,
    };
  }
  const accessData = await loadAccessDataForUser(user.id);

  return {
    user,
    ...accessData,
  };
}

export async function requireAuthenticatedAccessContext(): Promise<AuthenticatedAccessContext> {
  const context = await getCurrentAccessContext();

  if (!context.user) {
    redirect("/sign-in");
  }

  return context as AuthenticatedAccessContext;
}
