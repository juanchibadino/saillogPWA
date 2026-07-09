"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedAccessContext } from "@/lib/auth/access";
import { resolveOrganizationWriteEntitlement } from "@/lib/billing/entitlements";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scopeFormInputSchema } from "@/lib/validation/navigation";
import {
  createAndLinkTeamVenueInputSchema,
  createTeamVenueLinkInputSchema,
  deleteTeamVenueInputSchema,
  updateTeamVenueInputSchema,
} from "@/lib/validation/team-venues";
import { buildTeamVenuesRedirectPath } from "@/features/team-venues/list-route-state.mjs";
import {
  canDeleteTeamVenueLink,
  canRunTeamVenueWriteAction,
} from "@/features/team-venues/action-rules.mjs";
import type { TeamVenueStatusFilter } from "@/features/team-venues/data";

function parseStatusFilter(value: string | undefined): TeamVenueStatusFilter | undefined {
  if (value === "active" || value === "deprecated") {
    return value;
  }

  return undefined;
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

function getScopeFromFormData(formData: FormData): {
  scopeLoadMore?: boolean;
  scopeOrgId?: string;
  scopePage?: number;
  scopeTeamId?: string;
  scopeStatus?: TeamVenueStatusFilter;
} {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  });
  const scopeStatus = parseStatusFilter(getFormString(formData, "scopeStatus"));
  const scopePage = parseOptionalPage(getFormString(formData, "scopePage"));
  const scopeLoadMore = getFormString(formData, "scopeLoadMore") === "1";

  if (!parsedScope.success) {
    return { scopeLoadMore, scopePage, scopeStatus };
  }

  return {
    ...parsedScope.data,
    scopeLoadMore,
    scopePage,
    scopeStatus,
  };
}

function parseOptionalPage(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return Math.floor(parsed);
}

async function ensureActiveTeamInScope(input: {
  scopeOrgId: string;
  scopeTeamId: string;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", input.scopeTeamId)
    .eq("organization_id", input.scopeOrgId)
    .eq("is_active", true)
    .maybeSingle();

  return !teamError && Boolean(teamRow);
}

async function resolveTeamVenueVenueId(input: {
  teamVenueId: string;
  scopeTeamId: string;
}): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data: teamVenueRow, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,venue_id")
    .eq("id", input.teamVenueId)
    .eq("team_id", input.scopeTeamId)
    .maybeSingle();

  if (teamVenueError || !teamVenueRow) {
    return null;
  }

  return teamVenueRow.venue_id;
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

  const teamExistsInScope = await ensureActiveTeamInScope({
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!teamExistsInScope) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const canWriteTeamVenues = canRunTeamVenueWriteAction({
    action: "create_link",
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  });

  if (!canWriteTeamVenues) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
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
  revalidatePath("/venues");
  redirect(
    buildTeamVenuesRedirectPath({
      result: "linked_existing",
      ...scope,
    }),
  );
}

export async function createAndLinkTeamVenueAction(
  formData: FormData,
): Promise<void> {
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);

  const parsedInput = createAndLinkTeamVenueInputSchema.safeParse({
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
  });

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const teamExistsInScope = await ensureActiveTeamInScope({
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!teamExistsInScope) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const canWriteTeamVenues = canRunTeamVenueWriteAction({
    action: "create_and_link",
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  });

  if (!canWriteTeamVenues) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    );
  }

  const entitlementDecision = await resolveOrganizationWriteEntitlement({
    organizationId: scope.scopeOrgId,
    resource: "venues",
  });

  if (!entitlementDecision.allowed && entitlementDecision.reason) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: entitlementDecision.reason,
        ...scope,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: createdVenue, error: createVenueError } = await supabase
    .from("venues")
    .insert({
      organization_id: scope.scopeOrgId,
      name: parsedInput.data.name,
      country: parsedInput.data.country,
      city: parsedInput.data.city,
      is_active: true,
    })
    .select("id")
    .single();

  if (createVenueError || !createdVenue) {
    if (createVenueError?.code === "23505") {
      redirect(
        buildTeamVenuesRedirectPath({
          error: "venue_already_exists",
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

  const { error: linkError } = await supabase.from("team_venues").insert({
    team_id: scope.scopeTeamId,
    venue_id: createdVenue.id,
  });

  if (linkError) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "link_failed_after_create",
        ...scope,
      }),
    );
  }

  revalidatePath("/team-venues");
  revalidatePath("/venues");
  redirect(
    buildTeamVenuesRedirectPath({
      result: "created_and_linked",
      ...scope,
    }),
  );
}

export async function updateTeamVenueAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);

  const parsedInput = updateTeamVenueInputSchema.safeParse({
    teamVenueId: getFormString(formData, "teamVenueId"),
    name: getFormString(formData, "name"),
    country: getFormString(formData, "country"),
    city: getFormString(formData, "city"),
  });

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const teamExistsInScope = await ensureActiveTeamInScope({
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!teamExistsInScope) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  if (
    !canRunTeamVenueWriteAction({
      action: "update",
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    );
  }

  const venueId = await resolveTeamVenueVenueId({
    teamVenueId: parsedInput.data.teamVenueId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!venueId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: updateVenueError } = await supabase
    .from("venues")
    .update({
      name: parsedInput.data.name,
      city: parsedInput.data.city,
      country: parsedInput.data.country,
    })
    .eq("id", venueId)
    .eq("organization_id", scope.scopeOrgId);

  if (updateVenueError) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "update_failed",
        ...scope,
      }),
    );
  }

  revalidatePath("/team-venues");
  revalidatePath("/venues");
  revalidatePath("/team-camps");
  revalidatePath("/team-sessions");
  redirect(
    buildTeamVenuesRedirectPath({
      result: "updated",
      ...scope,
    }),
  );
}

export async function deleteTeamVenueAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext();
  const scope = getScopeFromFormData(formData);

  const parsedInput = deleteTeamVenueInputSchema.safeParse({
    teamVenueId: getFormString(formData, "teamVenueId"),
  });

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const teamExistsInScope = await ensureActiveTeamInScope({
    scopeOrgId: scope.scopeOrgId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!teamExistsInScope) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  if (
    !canRunTeamVenueWriteAction({
      action: "delete",
      context,
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
    })
  ) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "forbidden",
        ...scope,
      }),
    );
  }

  const venueId = await resolveTeamVenueVenueId({
    teamVenueId: parsedInput.data.teamVenueId,
    scopeTeamId: scope.scopeTeamId,
  });

  if (!venueId) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "invalid_input",
        ...scope,
      }),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: linkedCampRows, error: linkedCampError } = await supabase
    .from("camps")
    .select("id")
    .eq("team_venue_id", parsedInput.data.teamVenueId)
    .limit(1);

  if (linkedCampError) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    );
  }

  if (
    !canDeleteTeamVenueLink({
      totalCampCount: (linkedCampRows ?? []).length,
    })
  ) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "has_linked_operations",
        ...scope,
      }),
    );
  }

  const { error: deleteTeamVenueError } = await supabase
    .from("team_venues")
    .delete()
    .eq("id", parsedInput.data.teamVenueId)
    .eq("team_id", scope.scopeTeamId);

  if (deleteTeamVenueError) {
    redirect(
      buildTeamVenuesRedirectPath({
        error: "delete_failed",
        ...scope,
      }),
    );
  }

  revalidatePath("/team-venues");
  revalidatePath("/venues");
  revalidatePath("/team-camps");
  revalidatePath("/team-sessions");
  redirect(
    buildTeamVenuesRedirectPath({
      result: "deleted",
      ...scope,
    }),
  );
}
