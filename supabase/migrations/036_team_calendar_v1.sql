-- 036_team_calendar_v1.sql
-- Team calendar events and per-day presence.

do $$ begin
  create type public.calendar_event_type as enum ('meeting', 'travel', 'logistics', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.calendar_presence_source_type as enum ('camp', 'event');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  event_type public.calendar_event_type not null default 'other',
  start_date date not null,
  end_date date not null,
  notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) between 1 and 120),
  check (notes is null or length(notes) <= 4000),
  check (end_date >= start_date)
);

create index if not exists calendar_events_team_start_created_idx
  on public.calendar_events (team_id, start_date desc, created_at desc);

create index if not exists calendar_events_team_active_start_idx
  on public.calendar_events (team_id, is_active, start_date);

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

create table if not exists public.calendar_presence (
  id uuid primary key default gen_random_uuid(),
  source_type public.calendar_presence_source_type not null,
  camp_id uuid references public.camps(id) on delete cascade,
  calendar_event_id uuid references public.calendar_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  presence_date date not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_type = 'camp' and camp_id is not null and calendar_event_id is null)
    or
    (source_type = 'event' and calendar_event_id is not null and camp_id is null)
  )
);

create unique index if not exists calendar_presence_camp_profile_date_key
  on public.calendar_presence (camp_id, profile_id, presence_date)
  where source_type = 'camp' and camp_id is not null;

create unique index if not exists calendar_presence_event_profile_date_key
  on public.calendar_presence (calendar_event_id, profile_id, presence_date)
  where source_type = 'event' and calendar_event_id is not null;

create index if not exists calendar_presence_profile_date_idx
  on public.calendar_presence (profile_id, presence_date);

create index if not exists calendar_presence_camp_date_idx
  on public.calendar_presence (camp_id, presence_date)
  where camp_id is not null;

create index if not exists calendar_presence_event_date_idx
  on public.calendar_presence (calendar_event_id, presence_date)
  where calendar_event_id is not null;

drop trigger if exists set_calendar_presence_updated_at on public.calendar_presence;
create trigger set_calendar_presence_updated_at
before update on public.calendar_presence
for each row
execute function public.set_updated_at();

create or replace function public.team_id_for_calendar_event(target_calendar_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ce.team_id
  from public.calendar_events ce
  where ce.id = target_calendar_event_id
  limit 1;
$$;

create or replace function public.team_id_for_calendar_presence_target(
  target_source_type public.calendar_presence_source_type,
  target_camp_id uuid,
  target_calendar_event_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_source_type = 'camp' then public.team_id_for_camp(target_camp_id)
    when target_source_type = 'event' then public.team_id_for_calendar_event(target_calendar_event_id)
    else null
  end;
$$;

create or replace function public.can_manage_calendar_presence(
  target_profile_id uuid,
  target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    target_profile_id = auth.uid()
    and public.is_team_member(target_team_id)
  )
  or public.can_manage_team_structure(target_team_id);
$$;

create or replace function public.validate_calendar_presence_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team_id uuid;
  target_start_date date;
  target_end_date date;
begin
  if new.source_type = 'camp' then
    select tv.team_id, c.start_date, c.end_date
    into target_team_id, target_start_date, target_end_date
    from public.camps c
    join public.team_venues tv on tv.id = c.team_venue_id
    where c.id = new.camp_id;
  elsif new.source_type = 'event' then
    select ce.team_id, ce.start_date, ce.end_date
    into target_team_id, target_start_date, target_end_date
    from public.calendar_events ce
    where ce.id = new.calendar_event_id
      and ce.is_active;
  end if;

  if target_team_id is null then
    raise exception 'Calendar presence target is invalid';
  end if;

  if new.presence_date < target_start_date or new.presence_date > target_end_date then
    raise exception 'Presence date % is outside target range % - %',
      new.presence_date, target_start_date, target_end_date;
  end if;

  if not exists (
    select 1
    from public.team_memberships tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = target_team_id
      and tm.profile_id = new.profile_id
      and tm.is_active
      and p.is_active
  ) then
    raise exception 'Profile % is not an active member of team %',
      new.profile_id, target_team_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_calendar_presence_scope on public.calendar_presence;
create trigger validate_calendar_presence_scope
before insert or update on public.calendar_presence
for each row
execute function public.validate_calendar_presence_scope();

alter table public.calendar_events enable row level security;
alter table public.calendar_presence enable row level security;

drop policy if exists calendar_events_select_team_scope on public.calendar_events;
create policy calendar_events_select_team_scope
on public.calendar_events
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists calendar_events_insert_team_members on public.calendar_events;
create policy calendar_events_insert_team_members
on public.calendar_events
for insert
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists calendar_events_update_team_members on public.calendar_events;
create policy calendar_events_update_team_members
on public.calendar_events
for update
using (
  public.can_manage_team_sessions(team_id)
)
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists calendar_events_delete_team_members on public.calendar_events;
create policy calendar_events_delete_team_members
on public.calendar_events
for delete
using (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists calendar_presence_select_team_scope on public.calendar_presence;
create policy calendar_presence_select_team_scope
on public.calendar_presence
for select
using (
  public.can_read_team_scope(
    public.team_id_for_calendar_presence_target(source_type, camp_id, calendar_event_id)
  )
);

drop policy if exists calendar_presence_insert_self_or_manager on public.calendar_presence;
create policy calendar_presence_insert_self_or_manager
on public.calendar_presence
for insert
with check (
  public.can_manage_calendar_presence(
    profile_id,
    public.team_id_for_calendar_presence_target(source_type, camp_id, calendar_event_id)
  )
);

drop policy if exists calendar_presence_update_self_or_manager on public.calendar_presence;
create policy calendar_presence_update_self_or_manager
on public.calendar_presence
for update
using (
  public.can_manage_calendar_presence(
    profile_id,
    public.team_id_for_calendar_presence_target(source_type, camp_id, calendar_event_id)
  )
)
with check (
  public.can_manage_calendar_presence(
    profile_id,
    public.team_id_for_calendar_presence_target(source_type, camp_id, calendar_event_id)
  )
);

drop policy if exists calendar_presence_delete_self_or_manager on public.calendar_presence;
create policy calendar_presence_delete_self_or_manager
on public.calendar_presence
for delete
using (
  public.can_manage_calendar_presence(
    profile_id,
    public.team_id_for_calendar_presence_target(source_type, camp_id, calendar_event_id)
  )
);
