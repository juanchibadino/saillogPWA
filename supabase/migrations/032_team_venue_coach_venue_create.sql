-- 032_team_venue_coach_venue_create.sql
-- Allow team structure managers to create organization venues from Team Venues.

create or replace function public.can_create_team_venue_in_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_org_operations(target_organization_id)
    or exists (
      select 1
      from public.team_memberships tm
      join public.teams t on t.id = tm.team_id
      where t.organization_id = target_organization_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and t.is_active
        and tm.role in ('team_admin', 'coach')
    );
$$;

drop policy if exists venues_insert_manage_org_operations on public.venues;
drop policy if exists venues_insert_team_venue_structure_managers on public.venues;
create policy venues_insert_team_venue_structure_managers
on public.venues
for insert
with check (
  public.can_create_team_venue_in_org(organization_id)
);
