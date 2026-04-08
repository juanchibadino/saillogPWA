-- 003_venues_access_policies.sql
-- Phase 6 kickoff: venues read/write policies.

drop policy if exists venues_select_chain on public.venues;
create policy venues_select_chain
on public.venues
for select
using (
  public.is_super_admin()
  or public.is_org_member(organization_id)
  or exists (
    select 1
    from public.teams t
    where t.organization_id = venues.organization_id
      and public.is_team_member(t.id)
  )
);

drop policy if exists venues_insert_org_admin on public.venues;
create policy venues_insert_org_admin
on public.venues
for insert
with check (
  public.is_super_admin()
  or public.is_org_member(organization_id)
);

drop policy if exists venues_update_org_admin on public.venues;
create policy venues_update_org_admin
on public.venues
for update
using (
  public.is_super_admin()
  or public.is_org_member(organization_id)
)
with check (
  public.is_super_admin()
  or public.is_org_member(organization_id)
);
