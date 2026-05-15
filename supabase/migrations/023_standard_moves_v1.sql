-- 023_standard_moves_v1.sql
-- Team-scoped reusable standard moves + session links.

create table if not exists public.team_standard_moves (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_standard_moves_team_name_unique_idx
  on public.team_standard_moves (team_id, lower(name));

create index if not exists team_standard_moves_team_active_created_idx
  on public.team_standard_moves (team_id, is_active, created_at desc);

drop trigger if exists set_team_standard_moves_updated_at on public.team_standard_moves;
create trigger set_team_standard_moves_updated_at
before update on public.team_standard_moves
for each row
execute function public.set_updated_at();

create table if not exists public.session_standard_moves (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_standard_move_id uuid not null references public.team_standard_moves(id) on delete restrict,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, team_standard_move_id)
);

create index if not exists session_standard_moves_session_idx
  on public.session_standard_moves (session_id);

create index if not exists session_standard_moves_team_standard_move_idx
  on public.session_standard_moves (team_standard_move_id);

create or replace function public.team_id_for_standard_move(target_team_standard_move_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tsm.team_id
  from public.team_standard_moves tsm
  where tsm.id = target_team_standard_move_id
  limit 1;
$$;

create or replace function public.team_id_for_session_standard_move(target_session_standard_move_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tsm.team_id
  from public.session_standard_moves ssm
  join public.team_standard_moves tsm on tsm.id = ssm.team_standard_move_id
  where ssm.id = target_session_standard_move_id
  limit 1;
$$;

create or replace function public.validate_session_standard_move_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_team_id uuid;
  move_team_id uuid;
  move_is_active boolean;
begin
  session_team_id := public.team_id_for_session(new.session_id);

  select tsm.team_id, tsm.is_active
  into move_team_id, move_is_active
  from public.team_standard_moves tsm
  where tsm.id = new.team_standard_move_id
  limit 1;

  if session_team_id is null then
    raise exception 'Session % not found for standard move link', new.session_id;
  end if;

  if move_team_id is null then
    raise exception 'Standard move % not found', new.team_standard_move_id;
  end if;

  if session_team_id <> move_team_id then
    raise exception 'Session % and standard move % must belong to the same team', new.session_id, new.team_standard_move_id;
  end if;

  if move_is_active is distinct from true then
    raise exception 'Standard move % is archived and cannot be linked to sessions', new.team_standard_move_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_standard_move_scope on public.session_standard_moves;
create trigger validate_session_standard_move_scope
before insert or update on public.session_standard_moves
for each row
execute function public.validate_session_standard_move_scope();

alter table public.team_standard_moves enable row level security;
alter table public.session_standard_moves enable row level security;

drop policy if exists team_standard_moves_select_team_scope on public.team_standard_moves;
create policy team_standard_moves_select_team_scope
on public.team_standard_moves
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists team_standard_moves_insert_manage_team_sessions on public.team_standard_moves;
create policy team_standard_moves_insert_manage_team_sessions
on public.team_standard_moves
for insert
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_standard_moves_update_manage_team_sessions on public.team_standard_moves;
create policy team_standard_moves_update_manage_team_sessions
on public.team_standard_moves
for update
using (
  public.can_manage_team_sessions(team_id)
)
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists session_standard_moves_select_team_scope on public.session_standard_moves;
create policy session_standard_moves_select_team_scope
on public.session_standard_moves
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_standard_moves_insert_manage_team_sessions on public.session_standard_moves;
create policy session_standard_moves_insert_manage_team_sessions
on public.session_standard_moves
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_standard_moves_delete_manage_team_sessions on public.session_standard_moves;
create policy session_standard_moves_delete_manage_team_sessions
on public.session_standard_moves
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

alter table public.session_reviews
  drop column if exists standard_moves;
