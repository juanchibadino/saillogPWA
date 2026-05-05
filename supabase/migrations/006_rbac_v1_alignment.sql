-- 006_rbac_v1_alignment.sql
-- MVP RBAC v1: shared capability helpers + aligned operational policies.

create or replace function public.team_organization_id(target_team_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.organization_id
  from public.teams t
  where t.id = target_team_id
    and t.is_active
  limit 1;
$$;

create or replace function public.can_manage_org_operations(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = target_organization_id
        and om.profile_id = auth.uid()
        and om.role = 'organization_admin'
        and o.is_active
    );
$$;

create or replace function public.can_read_team_scope(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_team_member(target_team_id)
    or public.is_org_member(public.team_organization_id(target_team_id));
$$;

create or replace function public.can_manage_team_structure(target_team_id uuid)
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
        and tm.role in ('team_admin', 'coach')
    );
$$;

create or replace function public.can_manage_team_sessions(target_team_id uuid)
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

create or replace function public.team_id_for_team_venue(target_team_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.team_venues tv
  where tv.id = target_team_venue_id
  limit 1;
$$;

create or replace function public.team_id_for_camp(target_camp_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.camps c
  join public.team_venues tv on tv.id = c.team_venue_id
  where c.id = target_camp_id
  limit 1;
$$;

create or replace function public.team_id_for_session(target_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.sessions s
  join public.camps c on c.id = s.camp_id
  join public.team_venues tv on tv.id = c.team_venue_id
  where s.id = target_session_id
  limit 1;
$$;

drop policy if exists venues_insert_org_admin on public.venues;
drop policy if exists venues_insert_manage_org_operations on public.venues;
create policy venues_insert_manage_org_operations
on public.venues
for insert
with check (
  public.can_manage_org_operations(organization_id)
);

drop policy if exists venues_update_org_admin on public.venues;
drop policy if exists venues_update_manage_org_operations on public.venues;
create policy venues_update_manage_org_operations
on public.venues
for update
using (
  public.can_manage_org_operations(organization_id)
)
with check (
  public.can_manage_org_operations(organization_id)
);

drop policy if exists team_venues_select_chain on public.team_venues;
create policy team_venues_select_chain
on public.team_venues
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists team_venues_insert_team_admin_or_coach on public.team_venues;
drop policy if exists team_venues_insert_manage_team_structure on public.team_venues;
create policy team_venues_insert_manage_team_structure
on public.team_venues
for insert
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists team_venues_update_manage_team_structure on public.team_venues;
create policy team_venues_update_manage_team_structure
on public.team_venues
for update
using (
  public.can_manage_team_structure(team_id)
)
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists team_venues_delete_manage_team_structure on public.team_venues;
create policy team_venues_delete_manage_team_structure
on public.team_venues
for delete
using (
  public.can_manage_team_structure(team_id)
);

drop policy if exists camps_select_chain on public.camps;
create policy camps_select_chain
on public.camps
for select
using (
  public.can_read_team_scope(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists camps_insert_manage_team_structure on public.camps;
create policy camps_insert_manage_team_structure
on public.camps
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists camps_update_manage_team_structure on public.camps;
create policy camps_update_manage_team_structure
on public.camps
for update
using (
  public.can_manage_team_structure(public.team_id_for_team_venue(team_venue_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists camps_delete_manage_team_structure on public.camps;
create policy camps_delete_manage_team_structure
on public.camps
for delete
using (
  public.can_manage_team_structure(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists sessions_select_chain on public.sessions;
create policy sessions_select_chain
on public.sessions
for select
using (
  public.can_read_team_scope(public.team_id_for_camp(camp_id))
);

drop policy if exists sessions_insert_manage_team_sessions on public.sessions;
create policy sessions_insert_manage_team_sessions
on public.sessions
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_camp(camp_id))
);

drop policy if exists sessions_update_manage_team_sessions on public.sessions;
create policy sessions_update_manage_team_sessions
on public.sessions
for update
using (
  public.can_manage_team_sessions(public.team_id_for_camp(camp_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_camp(camp_id))
);

drop policy if exists sessions_delete_manage_team_sessions on public.sessions;
create policy sessions_delete_manage_team_sessions
on public.sessions
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_camp(camp_id))
);

drop policy if exists session_reviews_select_team_scope on public.session_reviews;
create policy session_reviews_select_team_scope
on public.session_reviews
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_reviews_insert_manage_team_sessions on public.session_reviews;
create policy session_reviews_insert_manage_team_sessions
on public.session_reviews
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_reviews_update_manage_team_sessions on public.session_reviews;
create policy session_reviews_update_manage_team_sessions
on public.session_reviews
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_reviews_delete_manage_team_sessions on public.session_reviews;
create policy session_reviews_delete_manage_team_sessions
on public.session_reviews
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_regatta_results_select_team_scope on public.session_regatta_results;
create policy session_regatta_results_select_team_scope
on public.session_regatta_results
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_regatta_results_insert_manage_team_sessions on public.session_regatta_results;
create policy session_regatta_results_insert_manage_team_sessions
on public.session_regatta_results
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_regatta_results_update_manage_team_sessions on public.session_regatta_results;
create policy session_regatta_results_update_manage_team_sessions
on public.session_regatta_results
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_regatta_results_delete_manage_team_sessions on public.session_regatta_results;
create policy session_regatta_results_delete_manage_team_sessions
on public.session_regatta_results
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setups_select_team_scope on public.session_setups;
create policy session_setups_select_team_scope
on public.session_setups
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_setups_insert_manage_team_sessions on public.session_setups;
create policy session_setups_insert_manage_team_sessions
on public.session_setups
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setups_update_manage_team_sessions on public.session_setups;
create policy session_setups_update_manage_team_sessions
on public.session_setups
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setups_delete_manage_team_sessions on public.session_setups;
create policy session_setups_delete_manage_team_sessions
on public.session_setups
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_assets_select_team_scope on public.session_assets;
create policy session_assets_select_team_scope
on public.session_assets
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_assets_insert_manage_team_sessions on public.session_assets;
create policy session_assets_insert_manage_team_sessions
on public.session_assets
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_assets_update_manage_team_sessions on public.session_assets;
create policy session_assets_update_manage_team_sessions
on public.session_assets
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_assets_delete_manage_team_sessions on public.session_assets;
create policy session_assets_delete_manage_team_sessions
on public.session_assets
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);
