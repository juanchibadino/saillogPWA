-- 063_crew_create_team_venues_and_camps.sql
-- Allow active crew to create Team Venue links and Camps while preserving stricter update/delete policies.

create or replace function public.can_create_team_operations(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.can_manage_org_operations(public.team_organization_id(target_team_id))
    or exists (
      select 1
      from public.team_memberships tm
      join public.teams t on t.id = tm.team_id
      where tm.team_id = target_team_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and t.is_active
        and tm.role in ('team_admin', 'coach', 'crew')
    );
$$;

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
        and tm.role in ('team_admin', 'coach', 'crew')
    );
$$;

drop policy if exists team_venues_insert_team_operation_creators on public.team_venues;
drop policy if exists team_venues_insert_manage_team_structure on public.team_venues;
create policy team_venues_insert_team_operation_creators
on public.team_venues
for insert
with check (
  public.can_create_team_operations(team_id)
);

drop policy if exists camps_insert_team_operation_creators on public.camps;
drop policy if exists camps_insert_manage_team_structure on public.camps;
create policy camps_insert_team_operation_creators
on public.camps
for insert
with check (
  public.can_create_team_operations(public.team_id_for_team_venue(team_venue_id))
);
