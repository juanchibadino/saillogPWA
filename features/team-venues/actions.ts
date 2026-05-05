"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import { canManageTeamStructure } from "@/lib/auth/capabilities";
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scopeFormInputSchema } from "@/lib/validation/navigation";
import { createTeamVenueLinkInputSchema } from "@/lib/validation/team-venues";

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

function getScopeFromFormData(formData: FormData): {
  scopeOrgId?: string;
  scopeTeamId?: string;
  scopeVenueId?: string;
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  });

  const scopeVenueId = getFormString(formData, "scopeVenueId");

  if (!parsedScope.success) {
    return { scopeVenueId };
  }

  return {
    ...parsedScope.data,
    scopeVenueId,
  };
}

function buildTeamVenuesRedirectPath(input: {
  status?: "created";
  error?: "invalid_input" | "create_failed" | "forbidden" | "already_linked";
  scopeOrgId?: string;
  scopeTeamId?: string;
  scopeVenueId?: string;
}): string {
  const params = new URLSearchParams();

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.error) {
    params.set("error", input.error);
  }

  if (input.scopeOrgId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scopeOrgId);
  }

  if (input.scopeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scopeTeamId);
  }

  if (input.scopeVenueId) {
    params.set("venue", input.scopeVenueId);
  }

  const query = params.toString();
  return query.length > 0 ? `/team-venues?${query}` : "/team-venues";
}

export async function createTeamVenueLinkAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);

  const parsedInput = createTeamVenueLinkInputSchema.safeParse({
    venueId: getFormString(formData, "venueId"),
  });

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", scope.scopeTeamId)
    .eq("organization_id", scope.scopeOrgId)
    .eq("is_active", true)
    .maybeSingle();

  if (teamError || !teamRow) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const canManageTeamVenues = canManageTeamStructure({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  });

  if (!canManageTeamVenues) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    );
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", parsedInput.data.venueId)
    .eq("organization_id", scope.scopeOrgId)
    .maybeSingle();

  if (venueError || !venueRow) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const { error: insertError } = await supabase.from("team_venues").insert({
    team_id: scope.scopeTeamId,
    venue_id: parsedInput.data.venueId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      redirect(
        buildTeamVenuesRedirectPath({
          error: "already_linked",
          ...scope,
        }),
      );
    }

    redirect(
      buildTeamVenuesRedirectPath({
        error: "create_failed",
        ...scope,
      }),
    );
  }

  revalidatePath("/team-venues");
  redirect(
    buildTeamVenuesRedirectPath({
      status: "created",
      ...scope,
    }),
  );
}
