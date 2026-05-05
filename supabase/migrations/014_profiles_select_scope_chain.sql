-- 014_profiles_select_scope_chain.sql
-- Allow authenticated users to read profile rows for members inside their
-- permitted organization/team scope (used by Team Home roster and similar views).

drop policy if exists profiles_select_self_or_super_admin on public.profiles;
drop policy if exists profiles_select_scope_chain on public.profiles;

create policy profiles_select_scope_chain
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.organization_memberships om
    where om.profile_id = profiles.id
      and public.is_org_member(om.organization_id)
  )
  or exists (
    select 1
    from public.team_memberships tm
    where tm.profile_id = profiles.id
      and tm.is_active
      and public.can_read_team_scope(tm.team_id)
  )
);
