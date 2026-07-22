-- 059_team_expenses_assigned_members.sql
-- Preserve entered-by audit data while assigning expenses to active team members.

alter table public.team_expenses
  add column if not exists assigned_to_profile_id uuid;

update public.team_expenses
set assigned_to_profile_id = created_by_profile_id
where assigned_to_profile_id is null;

alter table public.team_expenses
  alter column assigned_to_profile_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_expenses_assigned_to_profile_id_fkey'
  ) then
    alter table public.team_expenses
      add constraint team_expenses_assigned_to_profile_id_fkey
      foreign key (assigned_to_profile_id)
      references public.profiles(id)
      on delete restrict;
  end if;
end $$;

create index if not exists team_expenses_team_assigned_year_idx
  on public.team_expenses (team_id, assigned_to_profile_id, expense_year, expense_date desc);

create or replace function public.can_manage_team_finance(target_team_id uuid)
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
        and tm.role = 'team_admin'
    );
$$;

create or replace function public.is_active_team_member_profile(
  target_team_id uuid,
  target_profile_id uuid
)
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
      and tm.profile_id = target_profile_id
      and tm.is_active
      and t.is_active
  );
$$;

create or replace function public.can_view_team_expense(target_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        public.can_read_team_scope(te.team_id)
        and (
          te.assigned_to_profile_id = auth.uid()
          or public.can_manage_team_finance(te.team_id)
          or exists (
            select 1
            from public.teams t
            where t.id = te.team_id
              and t.expenses_show_team_totals
          )
        )
      from public.team_expenses te
      where te.id = target_expense_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.can_manage_team_expense(target_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        public.can_manage_team_sessions(te.team_id)
        and (
          te.assigned_to_profile_id = auth.uid()
          or public.can_manage_team_finance(te.team_id)
        )
      from public.team_expenses te
      where te.id = target_expense_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.validate_team_expense_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_team_id uuid;
  camp_team_venue_id uuid;
  org_currency text;
begin
  select tv.team_id
  into venue_team_id
  from public.team_venues tv
  where tv.id = new.team_venue_id
  limit 1;

  if venue_team_id is null or venue_team_id <> new.team_id then
    raise exception 'Expense venue must belong to the expense team.';
  end if;

  if not public.is_active_team_member_profile(new.team_id, new.assigned_to_profile_id) then
    raise exception 'Expense assignee must be an active team member.';
  end if;

  if new.camp_id is not null then
    select c.team_venue_id
    into camp_team_venue_id
    from public.camps c
    where c.id = new.camp_id
    limit 1;

    if camp_team_venue_id is null or camp_team_venue_id <> new.team_venue_id then
      raise exception 'Expense camp must belong to the selected team venue.';
    end if;
  end if;

  select o.default_currency_code
  into org_currency
  from public.teams t
  join public.organizations o on o.id = t.organization_id
  where t.id = new.team_id
  limit 1;

  if org_currency is not null and new.organization_currency_code <> org_currency then
    raise exception 'Expense organization currency must match organization settings.';
  end if;

  return new;
end;
$$;

drop policy if exists team_expenses_select_visible_scope on public.team_expenses;
create policy team_expenses_select_visible_scope
on public.team_expenses
for select
using (
  public.can_read_team_scope(team_id)
  and (
    assigned_to_profile_id = auth.uid()
    or public.can_manage_team_finance(team_id)
    or exists (
      select 1
      from public.teams t
      where t.id = team_expenses.team_id
        and t.expenses_show_team_totals
    )
  )
);

drop policy if exists team_expenses_insert_own_team_sessions on public.team_expenses;
create policy team_expenses_insert_own_team_sessions
on public.team_expenses
for insert
with check (
  public.can_manage_team_sessions(team_id)
  and created_by_profile_id = auth.uid()
  and public.is_active_team_member_profile(team_id, assigned_to_profile_id)
  and (
    assigned_to_profile_id = auth.uid()
    or public.can_manage_team_finance(team_id)
  )
);

drop policy if exists team_expenses_update_owner_or_structure_manager on public.team_expenses;
create policy team_expenses_update_owner_or_structure_manager
on public.team_expenses
for update
using (
  public.can_manage_team_sessions(team_id)
  and (
    assigned_to_profile_id = auth.uid()
    or public.can_manage_team_finance(team_id)
  )
)
with check (
  public.can_manage_team_sessions(team_id)
  and public.is_active_team_member_profile(team_id, assigned_to_profile_id)
  and (
    assigned_to_profile_id = auth.uid()
    or public.can_manage_team_finance(team_id)
  )
);

drop policy if exists team_expenses_delete_owner_or_structure_manager on public.team_expenses;
create policy team_expenses_delete_owner_or_structure_manager
on public.team_expenses
for delete
using (
  public.can_manage_team_sessions(team_id)
  and (
    assigned_to_profile_id = auth.uid()
    or public.can_manage_team_finance(team_id)
  )
);
