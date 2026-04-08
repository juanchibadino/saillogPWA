-- 002_auth_access_policies.sql
-- Auth/profile bootstrap and baseline access policies for Milestone 1.

create or replace function public.auth_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'super_admin'
      and p.is_active
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.profile_id = auth.uid()
      and o.is_active
  );
$$;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = target_team_id
      and tm.profile_id = auth.uid()
      and tm.is_active
      and t.is_active
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      last_name = coalesce(excluded.last_name, public.profiles.last_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

drop policy if exists profiles_select_self_or_super_admin on public.profiles;
create policy profiles_select_self_or_super_admin
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_super_admin()
);

drop policy if exists profiles_update_self_or_super_admin on public.profiles;
create policy profiles_update_self_or_super_admin
on public.profiles
for update
using (
  id = auth.uid()
  or public.is_super_admin()
)
with check (
  id = auth.uid()
  or public.is_super_admin()
);

drop policy if exists organization_memberships_select_chain on public.organization_memberships;
create policy organization_memberships_select_chain
on public.organization_memberships
for select
using (
  profile_id = auth.uid()
  or public.is_super_admin()
  or public.is_org_member(organization_id)
);

drop policy if exists team_memberships_select_chain on public.team_memberships;
create policy team_memberships_select_chain
on public.team_memberships
for select
using (
  profile_id = auth.uid()
  or public.is_super_admin()
  or public.is_team_member(team_id)
  or public.is_org_member(
    (
      select t.organization_id
      from public.teams t
      where t.id = team_memberships.team_id
    )
  )
);

drop policy if exists organizations_select_chain on public.organizations;
create policy organizations_select_chain
on public.organizations
for select
using (
  public.is_super_admin()
  or public.is_org_member(id)
  or exists (
    select 1
    from public.teams t
    where t.organization_id = organizations.id
      and public.is_team_member(t.id)
  )
);

drop policy if exists teams_select_chain on public.teams;
create policy teams_select_chain
on public.teams
for select
using (
  public.is_super_admin()
  or public.is_team_member(id)
  or public.is_org_member(organization_id)
);
