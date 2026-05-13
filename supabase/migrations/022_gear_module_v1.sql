-- 022_gear_module_v1.sql
-- Gear module v1: team-scoped inventory + session usage linking + threshold alerts.

do $$ begin
  create type public.gear_type as enum (
    'sails',
    'spars_and_foils',
    'running_rigging',
    'hardware_and_fittings'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gear_status as enum (
    'active_regatta',
    'active_training',
    'retired_spare',
    'on_repair'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gear_condition as enum ('new', 'used', 'refurbished');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gear_alert_metric as enum ('usage_count', 'usage_minutes');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gear_alert_severity as enum ('warning', 'critical');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.gear_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  gear_type public.gear_type not null,
  serial_number text,
  barcode text,
  status public.gear_status not null default 'active_training',
  condition public.gear_condition not null default 'used',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name)) > 0)
);

create index if not exists gear_items_team_idx
  on public.gear_items (team_id);

create index if not exists gear_items_team_type_idx
  on public.gear_items (team_id, gear_type);

create index if not exists gear_items_team_status_idx
  on public.gear_items (team_id, status);

create index if not exists gear_items_team_condition_idx
  on public.gear_items (team_id, condition);

create unique index if not exists gear_items_team_serial_unique_idx
  on public.gear_items (team_id, lower(serial_number))
  where serial_number is not null and btrim(serial_number) <> '';

create unique index if not exists gear_items_team_barcode_unique_idx
  on public.gear_items (team_id, lower(barcode))
  where barcode is not null and btrim(barcode) <> '';

drop trigger if exists set_gear_items_updated_at on public.gear_items;
create trigger set_gear_items_updated_at
before update on public.gear_items
for each row
execute function public.set_updated_at();

create table if not exists public.gear_alert_rules (
  id uuid primary key default gen_random_uuid(),
  gear_item_id uuid not null references public.gear_items(id) on delete cascade,
  metric public.gear_alert_metric not null,
  severity public.gear_alert_severity not null,
  threshold_value integer not null,
  is_refurbished_rule boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (threshold_value > 0)
);

create index if not exists gear_alert_rules_gear_item_idx
  on public.gear_alert_rules (gear_item_id);

create index if not exists gear_alert_rules_gear_item_metric_idx
  on public.gear_alert_rules (gear_item_id, metric);

create index if not exists gear_alert_rules_gear_item_severity_idx
  on public.gear_alert_rules (gear_item_id, severity);

drop trigger if exists set_gear_alert_rules_updated_at on public.gear_alert_rules;
create trigger set_gear_alert_rules_updated_at
before update on public.gear_alert_rules
for each row
execute function public.set_updated_at();

create table if not exists public.session_gear_usage (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  gear_item_id uuid not null references public.gear_items(id) on delete cascade,
  linked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, gear_item_id)
);

create index if not exists session_gear_usage_session_idx
  on public.session_gear_usage (session_id);

create index if not exists session_gear_usage_gear_item_idx
  on public.session_gear_usage (gear_item_id);

create or replace function public.team_id_for_gear_item(target_gear_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gi.team_id
  from public.gear_items gi
  where gi.id = target_gear_item_id
  limit 1;
$$;

create or replace function public.validate_session_gear_usage_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_team_id uuid;
  gear_team_id uuid;
begin
  session_team_id := public.team_id_for_session(new.session_id);
  gear_team_id := public.team_id_for_gear_item(new.gear_item_id);

  if session_team_id is null or gear_team_id is null then
    raise exception 'Invalid session or gear item scope';
  end if;

  if session_team_id <> gear_team_id then
    raise exception 'Session and gear item must belong to the same team';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_gear_usage_scope on public.session_gear_usage;
create trigger validate_session_gear_usage_scope
before insert or update on public.session_gear_usage
for each row
execute function public.validate_session_gear_usage_scope();

alter table public.gear_items enable row level security;
alter table public.gear_alert_rules enable row level security;
alter table public.session_gear_usage enable row level security;

drop policy if exists gear_items_select_team_scope on public.gear_items;
create policy gear_items_select_team_scope
on public.gear_items
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists gear_items_insert_manage_team_sessions on public.gear_items;
create policy gear_items_insert_manage_team_sessions
on public.gear_items
for insert
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists gear_items_update_manage_team_sessions on public.gear_items;
create policy gear_items_update_manage_team_sessions
on public.gear_items
for update
using (
  public.can_manage_team_sessions(team_id)
)
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists gear_items_delete_manage_team_sessions on public.gear_items;
create policy gear_items_delete_manage_team_sessions
on public.gear_items
for delete
using (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists gear_alert_rules_select_team_scope on public.gear_alert_rules;
create policy gear_alert_rules_select_team_scope
on public.gear_alert_rules
for select
using (
  public.can_read_team_scope(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_alert_rules_insert_manage_team_sessions on public.gear_alert_rules;
create policy gear_alert_rules_insert_manage_team_sessions
on public.gear_alert_rules
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_alert_rules_update_manage_team_sessions on public.gear_alert_rules;
create policy gear_alert_rules_update_manage_team_sessions
on public.gear_alert_rules
for update
using (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_alert_rules_delete_manage_team_sessions on public.gear_alert_rules;
create policy gear_alert_rules_delete_manage_team_sessions
on public.gear_alert_rules
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists session_gear_usage_select_team_scope on public.session_gear_usage;
create policy session_gear_usage_select_team_scope
on public.session_gear_usage
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_gear_usage_insert_manage_team_sessions on public.session_gear_usage;
create policy session_gear_usage_insert_manage_team_sessions
on public.session_gear_usage
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_gear_usage_update_manage_team_sessions on public.session_gear_usage;
create policy session_gear_usage_update_manage_team_sessions
on public.session_gear_usage
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_gear_usage_delete_manage_team_sessions on public.session_gear_usage;
create policy session_gear_usage_delete_manage_team_sessions
on public.session_gear_usage
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);
