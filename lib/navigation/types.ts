export type ScopeSearchParamValue = string | string[] | undefined;

export type ScopeSearchParams = Record<string, ScopeSearchParamValue>;

export type NavigationTeamId = string | null;

export type ScopeOrganizationOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ScopeTeamOption = {
  id: string;
  name: string;
  organizationId: string;
};

export type ScopeTeamPickerOption = ScopeTeamOption & {
  organizationName: string;
};

export type NavigationScope = {
  activeOrgId: string;
  activeTeamId: NavigationTeamId;
  allowedOrgIds: string[];
  allowedTeamIds: string[];
};

export type NavigationPickerMode =
  | "super_admin"
  | "organization_admin"
  | "team_member_multi"
  | "none";

export type NavigationScopeUiCapabilities = {
  showOrganizationPicker: boolean;
  showTeamPicker: boolean;
  pickerMode: NavigationPickerMode;
};

export type NavigationScopeCatalog = {
  organizations: ScopeOrganizationOption[];
  teamsByOrganizationId: Record<string, ScopeTeamOption[]>;
  orgIdsWithAllTeamsAccess: string[];
  defaultTeamIdByOrganizationId: Record<string, NavigationTeamId>;
  teamPickerOptions: ScopeTeamPickerOption[];
  uiCapabilities: NavigationScopeUiCapabilities;
};

export type ResolvedNavigationScope = {
  scope: NavigationScope | null;
  catalog: NavigationScopeCatalog;
};
