-- 011_organizations_and_teams_insert_policies.sql
-- Add create policies for organization and team management pages.

drop policy if exists organizations_insert_super_admin on public.organizations;
create policy organizations_insert_super_admin
on public.organizations
for insert
with check (
  public.is_super_admin()
);

drop policy if exists teams_insert_manage_org_operations on public.teams;
create policy teams_insert_manage_org_operations
on public.teams
for insert
with check (
  public.can_manage_org_operations(organization_id)
);
