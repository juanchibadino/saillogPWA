import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { AuthenticatedAccessContext } from "@/lib/auth/access";
import {
  NAVIGATION_SCOPE_ORG_COOKIE,
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_COOKIE,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants";
import type {
  NavigationPickerMode,
  NavigationScope,
  NavigationScopeCatalog,
  NavigationScopeUiCapabilities,
  NavigationTeamId,
  ResolvedNavigationScope,
  ScopeOrganizationOption,
  ScopeSearchParamValue,
  ScopeSearchParams,
  ScopeTeamOption,
  ScopeTeamPickerOption,
} from "@/lib/navigation/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "name" | "organization_id"
>;

type OrganizationRow = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "id" | "name" | "avatar_url"
>;

type NavigationBaseData = {
  organizations: ScopeOrganizationOption[];
  directTeamsByOrganizationId: Record<string, ScopeTeamOption[]>;
  orgIdsWithAllTeamsAccess: string[];
  defaultTeamIdByOrganizationId: Record<string, NavigationTeamId>;
  teamPickerOptions: ScopeTeamPickerOption[];
  uiCapabilities: NavigationScopeUiCapabilities;
};

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function encodeIdKey(values: string[]): string {
  return uniqueValues(values).join(",");
}

function decodeIdKey(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  return value.split(",").filter((item) => item.length > 0);
}

export function getSingleSearchParamValue(
  value: ScopeSearchParamValue,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function pickFirstAllowed(
  candidates: Array<string | undefined>,
  allowed: Set<string>,
): string | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (allowed.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveTeamCandidate(input: {
  candidate: string | null | undefined;
  allowedTeamIds: Set<string>;
}): NavigationTeamId | null {
  if (!input.candidate) {
    return null;
  }

  // Treat legacy `team=all` values as invalid and fall back to concrete teams.
  if (input.candidate === "all") {
    return null;
  }

  if (input.allowedTeamIds.has(input.candidate)) {
    return input.candidate;
  }

  return null;
}

function mapTeams(rows: TeamRow[]): ScopeTeamOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    organizationId: row.organization_id,
  }));
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

function sortTeamPickerOptions(
  rows: ScopeTeamPickerOption[],
): ScopeTeamPickerOption[] {
  return [...rows].sort((a, b) => {
    const orgComparison = a.organizationName.localeCompare(b.organizationName);

    if (orgComparison !== 0) {
      return orgComparison;
    }

    return a.name.localeCompare(b.name);
  });
}

function uiCapabilitiesFromPickerMode(
  pickerMode: NavigationPickerMode,
): NavigationScopeUiCapabilities {
  return {
    showOrganizationPicker: pickerMode === "super_admin",
    showTeamPicker: pickerMode !== "none",
    pickerMode,
  };
}

function resolvePickerMode(
  context: AuthenticatedAccessContext,
): NavigationPickerMode {
  if (context.effectiveRoles.globalRole === "super_admin") {
    return "super_admin";
  }

  if (context.organizationMemberships.length > 0) {
    return "organization_admin";
  }

  const distinctTeamIds = uniqueValues(
    context.teamMemberships.map((membership) => membership.team_id),
  );

  if (distinctTeamIds.length > 1) {
    return "team_member_multi";
  }

  return "none";
}

const loadNavigationBaseDataCached = cache(
  async (
    isSuperAdmin: boolean,
    orgAdminIdsKey: string,
    directTeamIdsKey: string,
    pickerMode: NavigationPickerMode,
  ): Promise<NavigationBaseData> => {
    const supabase = await createServerSupabaseClient();
    const orgAdminIds = decodeIdKey(orgAdminIdsKey);
    const directTeamIds = decodeIdKey(directTeamIdsKey);

    let organizations: OrganizationRow[] = [];
    let directTeams: TeamRow[] = [];

    if (!isSuperAdmin && directTeamIds.length > 0) {
      const { data: directTeamRows, error: directTeamsError } = await supabase
        .from("teams")
        .select("id, name, organization_id")
        .in("id", directTeamIds)
        .eq("is_active", true);

      if (directTeamsError) {
        throw new Error(`Could not load direct teams: ${directTeamsError.message}`);
      }

      directTeams = directTeamRows ?? [];
    }

    if (isSuperAdmin) {
      const { data: organizationRows, error: organizationsError } = await supabase
        .from("organizations")
        .select("id, name, avatar_url")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (organizationsError) {
        throw new Error(`Could not load organizations: ${organizationsError.message}`);
      }

      organizations = organizationRows ?? [];
    } else {
      const seedOrgIds = uniqueValues([
        ...orgAdminIds,
        ...directTeams.map((team) => team.organization_id),
      ]);

      if (seedOrgIds.length > 0) {
        const { data: organizationRows, error: organizationsError } = await supabase
          .from("organizations")
          .select("id, name, avatar_url")
          .in("id", seedOrgIds)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (organizationsError) {
          throw new Error(`Could not load organizations: ${organizationsError.message}`);
        }

        organizations = organizationRows ?? [];
      }
    }

    const organizationOptions = sortByName(
      organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        avatarUrl: organization.avatar_url,
      })),
    );

    const organizationNameById = new Map(
      organizationOptions.map((organization) => [organization.id, organization.name]),
    );
    const allowedOrganizationIds = new Set(
      organizationOptions.map((organization) => organization.id),
    );

    const directTeamOptions = mapTeams(directTeams).filter((team) =>
      allowedOrganizationIds.has(team.organizationId),
    );

    const directTeamsByOrganizationId: Record<string, ScopeTeamOption[]> = {};

    for (const organization of organizationOptions) {
      directTeamsByOrganizationId[organization.id] = [];
    }

    for (const team of directTeamOptions) {
      directTeamsByOrganizationId[team.organizationId].push(team);
    }

    for (const [organizationId, teamOptions] of Object.entries(
      directTeamsByOrganizationId,
    )) {
      directTeamsByOrganizationId[organizationId] = sortByName(teamOptions);
    }

    const orgAdminIdSet = new Set(orgAdminIds);
    const orgIdsWithAllTeamsAccess = isSuperAdmin
      ? organizationOptions.map((organization) => organization.id)
      : organizationOptions
          .filter((organization) => orgAdminIdSet.has(organization.id))
          .map((organization) => organization.id);

    const orgIdsWithAllTeamsAccessSet = new Set(orgIdsWithAllTeamsAccess);
    const defaultTeamIdByOrganizationId: Record<string, NavigationTeamId> = {};

    for (const organization of organizationOptions) {
      if (orgIdsWithAllTeamsAccessSet.has(organization.id)) {
        defaultTeamIdByOrganizationId[organization.id] = null;
        continue;
      }

      const fallbackTeam = directTeamsByOrganizationId[organization.id]?.[0]?.id;
      defaultTeamIdByOrganizationId[organization.id] =
        fallbackTeam ?? null;
    }

    const teamPickerRowsById = new Map<string, ScopeTeamPickerOption>();

    if (pickerMode === "organization_admin" && orgIdsWithAllTeamsAccess.length > 0) {
      const { data: orgWideTeamRows, error: orgWideTeamsError } = await supabase
        .from("teams")
        .select("id, name, organization_id")
        .in("organization_id", orgIdsWithAllTeamsAccess)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (orgWideTeamsError) {
        throw new Error(
          `Could not load organization teams for picker: ${orgWideTeamsError.message}`,
        );
      }

      for (const team of mapTeams(orgWideTeamRows ?? [])) {
        const organizationName = organizationNameById.get(team.organizationId);

        if (!organizationName) {
          continue;
        }

        teamPickerRowsById.set(team.id, {
          ...team,
          organizationName,
        });
      }
    }

    if (pickerMode === "organization_admin" || pickerMode === "team_member_multi") {
      for (const team of directTeamOptions) {
        const organizationName = organizationNameById.get(team.organizationId);

        if (!organizationName) {
          continue;
        }

        teamPickerRowsById.set(team.id, {
          ...team,
          organizationName,
        });
      }
    }

    return {
      organizations: organizationOptions,
      directTeamsByOrganizationId,
      orgIdsWithAllTeamsAccess,
      defaultTeamIdByOrganizationId,
      teamPickerOptions: sortTeamPickerOptions([...teamPickerRowsById.values()]),
      uiCapabilities: uiCapabilitiesFromPickerMode(pickerMode),
    };
  },
);

const loadOrganizationTeamsCached = cache(
  async (organizationId: string): Promise<ScopeTeamOption[]> => {
    const supabase = await createServerSupabaseClient();
    const { data: teamRows, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, organization_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (teamsError) {
      throw new Error(`Could not load teams: ${teamsError.message}`);
    }

    return mapTeams(teamRows ?? []);
  },
);

const loadAccessibleTeamByIdCached = cache(
  async (teamId: string): Promise<ScopeTeamOption | null> => {
    const supabase = await createServerSupabaseClient();
    const { data: teamRow, error: teamError } = await supabase
      .from("teams")
      .select("id, name, organization_id")
      .eq("id", teamId)
      .eq("is_active", true)
      .maybeSingle();

    if (teamError) {
      throw new Error(`Could not resolve team scope candidate: ${teamError.message}`);
    }

    if (!teamRow) {
      return null;
    }

    return {
      id: teamRow.id,
      name: teamRow.name,
      organizationId: teamRow.organization_id,
    };
  },
);

async function findAccessibleTeamScopeCandidate(
  candidates: Array<string | undefined>,
): Promise<ScopeTeamOption | null> {
  for (const candidate of candidates) {
    if (!candidate || candidate === "all") {
      continue;
    }

    const team = await loadAccessibleTeamByIdCached(candidate);

    if (team) {
      return team;
    }
  }

  return null;
}

function buildCatalogFromBaseData(input: {
  baseData: NavigationBaseData;
  teamsByOrganizationId: Record<string, ScopeTeamOption[]>;
}): NavigationScopeCatalog {
  return {
    organizations: input.baseData.organizations,
    teamsByOrganizationId: input.teamsByOrganizationId,
    orgIdsWithAllTeamsAccess: input.baseData.orgIdsWithAllTeamsAccess,
    defaultTeamIdByOrganizationId: input.baseData.defaultTeamIdByOrganizationId,
    teamPickerOptions: input.baseData.teamPickerOptions,
    uiCapabilities: input.baseData.uiCapabilities,
  };
}

export async function buildNavigationScopeCatalog(
  context: AuthenticatedAccessContext,
  activeOrgId?: string,
): Promise<NavigationScopeCatalog> {
  const pickerMode = resolvePickerMode(context);
  const baseData = await loadNavigationBaseDataCached(
    context.effectiveRoles.globalRole === "super_admin",
    encodeIdKey(
      context.organizationMemberships.map((membership) => membership.organization_id),
    ),
    encodeIdKey(context.teamMemberships.map((membership) => membership.team_id)),
    pickerMode,
  );

  let teamsByOrganizationId = baseData.directTeamsByOrganizationId;

  if (activeOrgId && baseData.orgIdsWithAllTeamsAccess.includes(activeOrgId)) {
    const activeOrganizationTeams = await loadOrganizationTeamsCached(activeOrgId);
    teamsByOrganizationId = {
      ...teamsByOrganizationId,
      [activeOrgId]: activeOrganizationTeams,
    };
  }

  return buildCatalogFromBaseData({
    baseData,
    teamsByOrganizationId,
  });
}

export async function resolveNavigationScope(input: {
  context: AuthenticatedAccessContext;
  searchParams: ScopeSearchParams;
}): Promise<ResolvedNavigationScope> {
  const pickerMode = resolvePickerMode(input.context);
  const orgAdminIdsKey = encodeIdKey(
    input.context.organizationMemberships.map(
      (membership) => membership.organization_id,
    ),
  );
  const directTeamIdsKey = encodeIdKey(
    input.context.teamMemberships.map((membership) => membership.team_id),
  );

  const baseData = await loadNavigationBaseDataCached(
    input.context.effectiveRoles.globalRole === "super_admin",
    orgAdminIdsKey,
    directTeamIdsKey,
    pickerMode,
  );

  if (baseData.organizations.length === 0) {
    return {
      scope: null,
      catalog: {
        organizations: [],
        teamsByOrganizationId: {},
        orgIdsWithAllTeamsAccess: [],
        defaultTeamIdByOrganizationId: {},
        teamPickerOptions: [],
        uiCapabilities: baseData.uiCapabilities,
      },
    };
  }

  const cookieStore = await cookies();
  const allowedOrgSet = new Set(
    baseData.organizations.map((organization) => organization.id),
  );

  const queryOrgId = getSingleSearchParamValue(
    input.searchParams[NAVIGATION_SCOPE_ORG_QUERY_KEY],
  );
  const cookieOrgId = cookieStore.get(NAVIGATION_SCOPE_ORG_COOKIE)?.value;
  const queryTeamId = getSingleSearchParamValue(
    input.searchParams[NAVIGATION_SCOPE_TEAM_QUERY_KEY],
  );
  const cookieTeamId = cookieStore.get(NAVIGATION_SCOPE_TEAM_COOKIE)?.value;

  const crossOrganizationTeamSelection = await findAccessibleTeamScopeCandidate([
    queryTeamId,
    cookieTeamId,
  ]);

  const activeOrgId = pickFirstAllowed(
    [
      crossOrganizationTeamSelection?.organizationId,
      queryOrgId,
      cookieOrgId,
      baseData.organizations[0]?.id,
    ],
    allowedOrgSet,
  );

  if (!activeOrgId) {
    return {
      scope: null,
      catalog: buildCatalogFromBaseData({
        baseData,
        teamsByOrganizationId: baseData.directTeamsByOrganizationId,
      }),
    };
  }

  const hasOrgWideTeamAccess = baseData.orgIdsWithAllTeamsAccess.includes(activeOrgId);
  const activeOrganizationTeams = hasOrgWideTeamAccess
    ? await loadOrganizationTeamsCached(activeOrgId)
    : baseData.directTeamsByOrganizationId[activeOrgId] ?? [];

  const teamsByOrganizationId = {
    ...baseData.directTeamsByOrganizationId,
    [activeOrgId]: activeOrganizationTeams,
  };

  const allowedTeamIds = activeOrganizationTeams.map((team) => team.id);
  const allowedTeamSet = new Set(allowedTeamIds);

  const defaultTeamId = baseData.defaultTeamIdByOrganizationId[activeOrgId] ?? null;

  const activeTeamId =
    resolveTeamCandidate({
      candidate: queryTeamId,
      allowedTeamIds: allowedTeamSet,
    }) ??
    resolveTeamCandidate({
      candidate: cookieTeamId,
      allowedTeamIds: allowedTeamSet,
    }) ??
    resolveTeamCandidate({
      candidate: defaultTeamId,
      allowedTeamIds: allowedTeamSet,
    }) ??
    activeOrganizationTeams[0]?.id ??
    null;

  const scope: NavigationScope = {
    activeOrgId,
    activeTeamId,
    allowedOrgIds: baseData.organizations.map((organization) => organization.id),
    allowedTeamIds,
  };

  return {
    scope,
    catalog: buildCatalogFromBaseData({
      baseData,
      teamsByOrganizationId,
    }),
  };
}

export function hasConcreteTeamSelection(
  scope: NavigationScope,
): scope is NavigationScope & { activeTeamId: string } {
  return scope.activeTeamId !== null;
}

export function assertTeamSelectedForTeamScopedWrite(
  scope: NavigationScope,
): string {
  if (!hasConcreteTeamSelection(scope)) {
    throw new Error("A specific team must be selected before writing team-scoped data.");
  }

  return scope.activeTeamId;
}
