-- 026_wind_patterns_v1.sql
-- Venue-scoped reusable wind patterns + session links.

create table if not exists public.team_venue_wind_patterns (
  id uuid primary key default gen_random_uuid(),
  team_venue_id uuid not null references public.team_venues(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_venue_wind_patterns_team_venue_name_unique_idx
  on public.team_venue_wind_patterns (team_venue_id, lower(btrim(name)));

create index if not exists team_venue_wind_patterns_team_venue_active_created_idx
  on public.team_venue_wind_patterns (team_venue_id, is_active, created_at desc);

drop trigger if exists set_team_venue_wind_patterns_updated_at on public.team_venue_wind_patterns;
create trigger set_team_venue_wind_patterns_updated_at
before update on public.team_venue_wind_patterns
for each row
execute function public.set_updated_at();

create table if not exists public.session_wind_patterns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_venue_wind_pattern_id uuid not null references public.team_venue_wind_patterns(id) on delete restrict,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, team_venue_wind_pattern_id)
);

create index if not exists session_wind_patterns_session_idx
  on public.session_wind_patterns (session_id);

create index if not exists session_wind_patterns_team_venue_wind_pattern_idx
  on public.session_wind_patterns (team_venue_wind_pattern_id);

create or replace function public.team_venue_id_for_session(target_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.team_venue_id
  from public.sessions s
  join public.camps c on c.id = s.camp_id
  where s.id = target_session_id
  limit 1;
$$;

create or replace function public.team_id_for_team_venue_wind_pattern(target_team_venue_wind_pattern_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.team_venue_wind_patterns tvwp
  join public.team_venues tv on tv.id = tvwp.team_venue_id
  where tvwp.id = target_team_venue_wind_pattern_id
  limit 1;
$$;

create or replace function public.team_id_for_session_wind_pattern(target_session_wind_pattern_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.session_wind_patterns swp
  join public.team_venue_wind_patterns tvwp on tvwp.id = swp.team_venue_wind_pattern_id
  join public.team_venues tv on tv.id = tvwp.team_venue_id
  where swp.id = target_session_wind_pattern_id
  limit 1;
$$;

create or replace function public.validate_session_wind_pattern_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_team_venue_id uuid;
  pattern_team_venue_id uuid;
  pattern_is_active boolean;
begin
  session_team_venue_id := public.team_venue_id_for_session(new.session_id);

  select tvwp.team_venue_id, tvwp.is_active
  into pattern_team_venue_id, pattern_is_active
  from public.team_venue_wind_patterns tvwp
  where tvwp.id = new.team_venue_wind_pattern_id
  limit 1;

  if session_team_venue_id is null then
    raise exception 'Session % not found for wind pattern link', new.session_id;
  end if;

  if pattern_team_venue_id is null then
    raise exception 'Wind pattern % not found', new.team_venue_wind_pattern_id;
  end if;

  if session_team_venue_id <> pattern_team_venue_id then
    raise exception 'Session % and wind pattern % must belong to the same team venue', new.session_id, new.team_venue_wind_pattern_id;
  end if;

  if pattern_is_active is distinct from true then
    raise exception 'Wind pattern % is archived and cannot be linked to sessions', new.team_venue_wind_pattern_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_wind_pattern_scope on public.session_wind_patterns;
create trigger validate_session_wind_pattern_scope
before insert or update on public.session_wind_patterns
for each row
execute function public.validate_session_wind_pattern_scope();

alter table public.team_venue_wind_patterns enable row level security;
alter table public.session_wind_patterns enable row level security;

drop policy if exists team_venue_wind_patterns_select_team_scope on public.team_venue_wind_patterns;
create policy team_venue_wind_patterns_select_team_scope
on public.team_venue_wind_patterns
for select
using (
  public.can_read_team_scope(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists team_venue_wind_patterns_insert_manage_team_sessions on public.team_venue_wind_patterns;
create policy team_venue_wind_patterns_insert_manage_team_sessions
on public.team_venue_wind_patterns
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists team_venue_wind_patterns_update_manage_team_sessions on public.team_venue_wind_patterns;
create policy team_venue_wind_patterns_update_manage_team_sessions
on public.team_venue_wind_patterns
for update
using (
  public.can_manage_team_sessions(public.team_id_for_team_venue(team_venue_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists session_wind_patterns_select_team_scope on public.session_wind_patterns;
create policy session_wind_patterns_select_team_scope
on public.session_wind_patterns
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_wind_patterns_insert_manage_team_sessions on public.session_wind_patterns;
create policy session_wind_patterns_insert_manage_team_sessions
on public.session_wind_patterns
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_wind_patterns_delete_manage_team_sessions on public.session_wind_patterns;
create policy session_wind_patterns_delete_manage_team_sessions
on public.session_wind_patterns
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);
