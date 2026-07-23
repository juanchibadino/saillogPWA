-- 062_team_calendar_feeds.sql
-- Private read-only iCalendar feed URLs for team calendars.

create table if not exists public.team_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token text not null,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  rotated_by_profile_id uuid references public.profiles(id) on delete set null,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(token) between 32 and 128),
  check (token ~ '^[A-Za-z0-9_-]+$')
);

create unique index if not exists team_calendar_feeds_token_key
  on public.team_calendar_feeds (token);

create unique index if not exists team_calendar_feeds_one_active_per_team
  on public.team_calendar_feeds (team_id)
  where is_active;

create index if not exists team_calendar_feeds_team_created_idx
  on public.team_calendar_feeds (team_id, created_at desc);

drop trigger if exists set_team_calendar_feeds_updated_at on public.team_calendar_feeds;
create trigger set_team_calendar_feeds_updated_at
before update on public.team_calendar_feeds
for each row
execute function public.set_updated_at();

alter table public.team_calendar_feeds enable row level security;

drop policy if exists team_calendar_feeds_select_managers on public.team_calendar_feeds;
create policy team_calendar_feeds_select_managers
on public.team_calendar_feeds
for select
using (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_calendar_feeds_insert_managers on public.team_calendar_feeds;
create policy team_calendar_feeds_insert_managers
on public.team_calendar_feeds
for insert
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_calendar_feeds_update_managers on public.team_calendar_feeds;
create policy team_calendar_feeds_update_managers
on public.team_calendar_feeds
for update
using (
  public.can_manage_team_sessions(team_id)
)
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_calendar_feeds_delete_managers on public.team_calendar_feeds;
create policy team_calendar_feeds_delete_managers
on public.team_calendar_feeds
for delete
using (
  public.can_manage_team_sessions(team_id)
);
