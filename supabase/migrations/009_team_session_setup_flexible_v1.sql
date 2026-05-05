-- 009_team_session_setup_flexible_v1.sql
-- Flexible setup templates by team + session setup values.

do $$
begin
  create type public.setup_input_kind as enum ('single_select', 'multi_select', 'text');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.team_type_setup_items (
  id uuid primary key default gen_random_uuid(),
  team_type text not null,
  key text not null,
  label text not null,
  input_kind public.setup_input_kind not null default 'multi_select',
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_type, key),
  unique (team_type, position)
);

create index if not exists team_type_setup_items_team_type_position_idx
  on public.team_type_setup_items (team_type, position);

create table if not exists public.team_type_setup_item_options (
  id uuid primary key default gen_random_uuid(),
  team_type_setup_item_id uuid not null references public.team_type_setup_items(id) on delete cascade,
  value text not null,
  label text not null,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_type_setup_item_id, value),
  unique (team_type_setup_item_id, position)
);

create index if not exists team_type_setup_item_options_item_position_idx
  on public.team_type_setup_item_options (team_type_setup_item_id, position);

create table if not exists public.team_setup_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_type_setup_item_id uuid references public.team_type_setup_items(id) on delete set null,
  key text not null,
  label text not null,
  input_kind public.setup_input_kind not null,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, key),
  unique (team_id, position)
);

create index if not exists team_setup_items_team_position_idx
  on public.team_setup_items (team_id, position);

create index if not exists team_setup_items_team_type_source_idx
  on public.team_setup_items (team_type_setup_item_id);

create table if not exists public.team_setup_item_options (
  id uuid primary key default gen_random_uuid(),
  team_setup_item_id uuid not null references public.team_setup_items(id) on delete cascade,
  team_type_setup_item_option_id uuid references public.team_type_setup_item_options(id) on delete set null,
  value text not null,
  label text not null,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_setup_item_id, value),
  unique (team_setup_item_id, position)
);

create index if not exists team_setup_item_options_item_position_idx
  on public.team_setup_item_options (team_setup_item_id, position);

create index if not exists team_setup_item_options_team_type_source_idx
  on public.team_setup_item_options (team_type_setup_item_option_id);

create table if not exists public.session_setup_item_values (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_setup_item_id uuid not null references public.team_setup_items(id),
  text_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_setup_item_id)
);

create index if not exists session_setup_item_values_session_idx
  on public.session_setup_item_values (session_id);

create index if not exists session_setup_item_values_item_idx
  on public.session_setup_item_values (team_setup_item_id);

create table if not exists public.session_setup_item_selected_options (
  id uuid primary key default gen_random_uuid(),
  session_setup_item_value_id uuid not null references public.session_setup_item_values(id) on delete cascade,
  team_setup_item_option_id uuid not null references public.team_setup_item_options(id),
  created_at timestamptz not null default now(),
  unique (session_setup_item_value_id, team_setup_item_option_id)
);

create index if not exists session_setup_item_selected_options_value_idx
  on public.session_setup_item_selected_options (session_setup_item_value_id);

create index if not exists session_setup_item_selected_options_option_idx
  on public.session_setup_item_selected_options (team_setup_item_option_id);

drop trigger if exists set_team_type_setup_items_updated_at on public.team_type_setup_items;
create trigger set_team_type_setup_items_updated_at
before update on public.team_type_setup_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_type_setup_item_options_updated_at on public.team_type_setup_item_options;
create trigger set_team_type_setup_item_options_updated_at
before update on public.team_type_setup_item_options
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_setup_items_updated_at on public.team_setup_items;
create trigger set_team_setup_items_updated_at
before update on public.team_setup_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_setup_item_options_updated_at on public.team_setup_item_options;
create trigger set_team_setup_item_options_updated_at
before update on public.team_setup_item_options
for each row
execute function public.set_updated_at();

drop trigger if exists set_session_setup_item_values_updated_at on public.session_setup_item_values;
create trigger set_session_setup_item_values_updated_at
before update on public.session_setup_item_values
for each row
execute function public.set_updated_at();

create or replace function public.team_id_for_team_setup_item(target_team_setup_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tsi.team_id
  from public.team_setup_items tsi
  where tsi.id = target_team_setup_item_id
  limit 1;
$$;

create or replace function public.team_id_for_team_setup_item_option(target_team_setup_item_option_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tsi.team_id
  from public.team_setup_item_options tsio
  join public.team_setup_items tsi on tsi.id = tsio.team_setup_item_id
  where tsio.id = target_team_setup_item_option_id
  limit 1;
$$;

create or replace function public.team_id_for_session_setup_item_value(target_session_setup_item_value_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tsi.team_id
  from public.session_setup_item_values ssiv
  join public.team_setup_items tsi on tsi.id = ssiv.team_setup_item_id
  where ssiv.id = target_session_setup_item_value_id
  limit 1;
$$;

create or replace function public.validate_session_setup_item_value_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_team_id uuid;
  item_team_id uuid;
  item_kind public.setup_input_kind;
begin
  select public.team_id_for_session(new.session_id)
  into session_team_id;

  select tsi.team_id, tsi.input_kind
  into item_team_id, item_kind
  from public.team_setup_items tsi
  where tsi.id = new.team_setup_item_id
  limit 1;

  if session_team_id is null then
    raise exception 'Session % not found for setup value', new.session_id;
  end if;

  if item_team_id is null then
    raise exception 'Team setup item % not found', new.team_setup_item_id;
  end if;

  if session_team_id <> item_team_id then
    raise exception 'Session setup item team mismatch for session % and item %', new.session_id, new.team_setup_item_id;
  end if;

  if item_kind in ('single_select', 'multi_select')
     and new.text_value is not null
     and btrim(new.text_value) <> '' then
    raise exception 'Text value is only allowed for text setup items';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_setup_item_value_scope on public.session_setup_item_values;
create trigger validate_session_setup_item_value_scope
before insert or update on public.session_setup_item_values
for each row
execute function public.validate_session_setup_item_value_scope();

create or replace function public.validate_session_setup_selected_option_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  value_item_id uuid;
  option_item_id uuid;
  item_kind public.setup_input_kind;
  existing_option_id uuid;
begin
  select ssiv.team_setup_item_id, tsi.input_kind
  into value_item_id, item_kind
  from public.session_setup_item_values ssiv
  join public.team_setup_items tsi on tsi.id = ssiv.team_setup_item_id
  where ssiv.id = new.session_setup_item_value_id
  limit 1;

  if value_item_id is null then
    raise exception 'Session setup item value % not found', new.session_setup_item_value_id;
  end if;

  select tsio.team_setup_item_id
  into option_item_id
  from public.team_setup_item_options tsio
  where tsio.id = new.team_setup_item_option_id
  limit 1;

  if option_item_id is null then
    raise exception 'Team setup item option % not found', new.team_setup_item_option_id;
  end if;

  if value_item_id <> option_item_id then
    raise exception 'Selected option % does not belong to session setup item value %', new.team_setup_item_option_id, new.session_setup_item_value_id;
  end if;

  if item_kind = 'text' then
    raise exception 'Text setup items cannot receive selected options';
  end if;

  if item_kind = 'single_select' then
    select ssiso.id
    into existing_option_id
    from public.session_setup_item_selected_options ssiso
    where ssiso.session_setup_item_value_id = new.session_setup_item_value_id
      and ssiso.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1;

    if existing_option_id is not null then
      raise exception 'Single-select setup items only support one selected option';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_setup_selected_option_scope on public.session_setup_item_selected_options;
create trigger validate_session_setup_selected_option_scope
before insert or update on public.session_setup_item_selected_options
for each row
execute function public.validate_session_setup_selected_option_scope();

alter table public.team_type_setup_items enable row level security;
alter table public.team_type_setup_item_options enable row level security;
alter table public.team_setup_items enable row level security;
alter table public.team_setup_item_options enable row level security;
alter table public.session_setup_item_values enable row level security;
alter table public.session_setup_item_selected_options enable row level security;

drop policy if exists team_type_setup_items_select_authenticated on public.team_type_setup_items;
create policy team_type_setup_items_select_authenticated
on public.team_type_setup_items
for select
using (
  auth.uid() is not null
);

drop policy if exists team_type_setup_items_insert_super_admin on public.team_type_setup_items;
create policy team_type_setup_items_insert_super_admin
on public.team_type_setup_items
for insert
with check (
  public.is_super_admin()
);

drop policy if exists team_type_setup_items_update_super_admin on public.team_type_setup_items;
create policy team_type_setup_items_update_super_admin
on public.team_type_setup_items
for update
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);

drop policy if exists team_type_setup_items_delete_super_admin on public.team_type_setup_items;
create policy team_type_setup_items_delete_super_admin
on public.team_type_setup_items
for delete
using (
  public.is_super_admin()
);

drop policy if exists team_type_setup_item_options_select_authenticated on public.team_type_setup_item_options;
create policy team_type_setup_item_options_select_authenticated
on public.team_type_setup_item_options
for select
using (
  auth.uid() is not null
);

drop policy if exists team_type_setup_item_options_insert_super_admin on public.team_type_setup_item_options;
create policy team_type_setup_item_options_insert_super_admin
on public.team_type_setup_item_options
for insert
with check (
  public.is_super_admin()
);

drop policy if exists team_type_setup_item_options_update_super_admin on public.team_type_setup_item_options;
create policy team_type_setup_item_options_update_super_admin
on public.team_type_setup_item_options
for update
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);

drop policy if exists team_type_setup_item_options_delete_super_admin on public.team_type_setup_item_options;
create policy team_type_setup_item_options_delete_super_admin
on public.team_type_setup_item_options
for delete
using (
  public.is_super_admin()
);

drop policy if exists team_setup_items_select_team_scope on public.team_setup_items;
create policy team_setup_items_select_team_scope
on public.team_setup_items
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists team_setup_items_insert_manage_team_sessions on public.team_setup_items;
create policy team_setup_items_insert_manage_team_sessions
on public.team_setup_items
for insert
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_setup_items_update_manage_team_sessions on public.team_setup_items;
create policy team_setup_items_update_manage_team_sessions
on public.team_setup_items
for update
using (
  public.can_manage_team_sessions(team_id)
)
with check (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_setup_items_delete_manage_team_sessions on public.team_setup_items;
create policy team_setup_items_delete_manage_team_sessions
on public.team_setup_items
for delete
using (
  public.can_manage_team_sessions(team_id)
);

drop policy if exists team_setup_item_options_select_team_scope on public.team_setup_item_options;
create policy team_setup_item_options_select_team_scope
on public.team_setup_item_options
for select
using (
  public.can_read_team_scope(public.team_id_for_team_setup_item(team_setup_item_id))
);

drop policy if exists team_setup_item_options_insert_manage_team_sessions on public.team_setup_item_options;
create policy team_setup_item_options_insert_manage_team_sessions
on public.team_setup_item_options
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_team_setup_item(team_setup_item_id))
);

drop policy if exists team_setup_item_options_update_manage_team_sessions on public.team_setup_item_options;
create policy team_setup_item_options_update_manage_team_sessions
on public.team_setup_item_options
for update
using (
  public.can_manage_team_sessions(public.team_id_for_team_setup_item(team_setup_item_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_team_setup_item(team_setup_item_id))
);

drop policy if exists team_setup_item_options_delete_manage_team_sessions on public.team_setup_item_options;
create policy team_setup_item_options_delete_manage_team_sessions
on public.team_setup_item_options
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_team_setup_item(team_setup_item_id))
);

drop policy if exists session_setup_item_values_select_team_scope on public.session_setup_item_values;
create policy session_setup_item_values_select_team_scope
on public.session_setup_item_values
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_setup_item_values_insert_manage_team_sessions on public.session_setup_item_values;
create policy session_setup_item_values_insert_manage_team_sessions
on public.session_setup_item_values
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setup_item_values_update_manage_team_sessions on public.session_setup_item_values;
create policy session_setup_item_values_update_manage_team_sessions
on public.session_setup_item_values
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setup_item_values_delete_manage_team_sessions on public.session_setup_item_values;
create policy session_setup_item_values_delete_manage_team_sessions
on public.session_setup_item_values
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_setup_item_selected_options_select_team_scope on public.session_setup_item_selected_options;
create policy session_setup_item_selected_options_select_team_scope
on public.session_setup_item_selected_options
for select
using (
  public.can_read_team_scope(public.team_id_for_session_setup_item_value(session_setup_item_value_id))
);

drop policy if exists session_setup_item_selected_options_insert_manage_team_sessions on public.session_setup_item_selected_options;
create policy session_setup_item_selected_options_insert_manage_team_sessions
on public.session_setup_item_selected_options
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session_setup_item_value(session_setup_item_value_id))
);

drop policy if exists session_setup_item_selected_options_update_manage_team_sessions on public.session_setup_item_selected_options;
create policy session_setup_item_selected_options_update_manage_team_sessions
on public.session_setup_item_selected_options
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session_setup_item_value(session_setup_item_value_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session_setup_item_value(session_setup_item_value_id))
);

drop policy if exists session_setup_item_selected_options_delete_manage_team_sessions on public.session_setup_item_selected_options;
create policy session_setup_item_selected_options_delete_manage_team_sessions
on public.session_setup_item_selected_options
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session_setup_item_value(session_setup_item_value_id))
);

create or replace function public.clone_team_setup_from_team_type(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_team_type text;
  has_items boolean;
begin
  if target_team_id is null then
    return;
  end if;

  select t.team_type
  into resolved_team_type
  from public.teams t
  where t.id = target_team_id
  limit 1;

  if resolved_team_type is null or btrim(resolved_team_type) = '' then
    return;
  end if;

  select exists (
    select 1
    from public.team_setup_items tsi
    where tsi.team_id = target_team_id
  )
  into has_items;

  if has_items then
    return;
  end if;

  insert into public.team_setup_items (
    team_id,
    team_type_setup_item_id,
    key,
    label,
    input_kind,
    position,
    is_active
  )
  select
    target_team_id,
    ttsi.id,
    ttsi.key,
    ttsi.label,
    ttsi.input_kind,
    ttsi.position,
    ttsi.is_active
  from public.team_type_setup_items ttsi
  where ttsi.team_type = resolved_team_type
  order by ttsi.position, ttsi.created_at
  on conflict (team_id, key) do nothing;

  insert into public.team_setup_item_options (
    team_setup_item_id,
    team_type_setup_item_option_id,
    value,
    label,
    position,
    is_active
  )
  select
    tsi.id,
    ttsio.id,
    ttsio.value,
    ttsio.label,
    ttsio.position,
    ttsio.is_active
  from public.team_setup_items tsi
  join public.team_type_setup_items ttsi on ttsi.id = tsi.team_type_setup_item_id
  join public.team_type_setup_item_options ttsio on ttsio.team_type_setup_item_id = ttsi.id
  where tsi.team_id = target_team_id
    and ttsi.team_type = resolved_team_type
  order by tsi.position, ttsio.position
  on conflict (team_setup_item_id, value) do nothing;
end;
$$;

create or replace function public.handle_team_setup_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.clone_team_setup_from_team_type(new.id);
  elsif tg_op = 'UPDATE' and new.team_type is distinct from old.team_type then
    perform public.clone_team_setup_from_team_type(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists bootstrap_team_setup_on_team_change on public.teams;
create trigger bootstrap_team_setup_on_team_change
after insert or update of team_type on public.teams
for each row
execute function public.handle_team_setup_bootstrap();

with item_seed as (
  select *
  from (values
    ('twd', 'TWD', 'multi_select'::public.setup_input_kind, 1, '["N 0º","NE 45º","E 90º","SE 135º","S 180º","SW 225º","W 270º","NW 315º"]'::jsonb),
    ('tws', 'TWS', 'multi_select'::public.setup_input_kind, 2, '["ST 0-4","DT 5-8","FP 9-11","DP 12-18","OP 19-23","S 24+"]'::jsonb),
    ('sea_state', 'sea_state', 'multi_select'::public.setup_input_kind, 3, '["flat","chop","swell"]'::jsonb),
    ('primaries', 'primaries', 'multi_select'::public.setup_input_kind, 4, '["-4","-3","-2","-1","0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26"]'::jsonb),
    ('lowers', 'lowers', 'multi_select'::public.setup_input_kind, 5, '["-8","-7,5","-7","-6,5","-6","-5,5","-5","-4,5","-4","-3,5","-3","-2,5","-2","-1,5","-1","-0,5","0","0,5","1","1,5","2","2,5","3","3,5","4"]'::jsonb),
    ('caps', 'caps', 'multi_select'::public.setup_input_kind, 6, '["-1","-0,5","0","0,5","1","1,5","2","2,5","3"]'::jsonb),
    ('board', 'board', 'multi_select'::public.setup_input_kind, 7, '["0","1","2","3","4","5","6"]'::jsonb),
    ('bridle', 'bridle', 'multi_select'::public.setup_input_kind, 8, '["0","1","2","3","4"]'::jsonb),
    ('vang', 'vang', 'multi_select'::public.setup_input_kind, 9, '["0","1","2","3","4","5","6"]'::jsonb),
    ('cunningham', 'cunningham', 'multi_select'::public.setup_input_kind, 10, '["5","4","3","2","1","0"]'::jsonb),
    ('outhaul', 'outhaul', 'multi_select'::public.setup_input_kind, 11, '["0","1","2","3"]'::jsonb),
    ('track', 'track', 'multi_select'::public.setup_input_kind, 12, '["3","4","5"]'::jsonb),
    ('clew', 'clew', 'multi_select'::public.setup_input_kind, 13, '["middle","top"]'::jsonb),
    ('tack_height', 'tack_height', 'multi_select'::public.setup_input_kind, 14, '["+5","4,5","4","3,5","3","2,5","2","1,5","1","0,5","0","-0,5","-1","-1,5","-2","-2,5","-3","-3,5","-4","-4,5","-5"]'::jsonb),
    ('conditions', 'conditions', 'multi_select'::public.setup_input_kind, 15, '["One side favored","Side favored and winning lanes","Unstable sea breeze (open)","Offshore corners","Offshore playing the shifts and gusts","Steady/lanes and edges"]'::jsonb)
  ) as seed(key, label, input_kind, position, options_json)
),
upsert_items as (
  insert into public.team_type_setup_items (
    team_type,
    key,
    label,
    input_kind,
    position,
    is_active
  )
  select
    '49er',
    seed.key,
    seed.label,
    seed.input_kind,
    seed.position,
    true
  from item_seed seed
  on conflict (team_type, key) do update
  set label = excluded.label,
      input_kind = excluded.input_kind,
      position = excluded.position,
      is_active = excluded.is_active,
      updated_at = now()
  returning id, key
),
resolved_items as (
  select ttsi.id, seed.options_json
  from item_seed seed
  join public.team_type_setup_items ttsi
    on ttsi.team_type = '49er'
   and ttsi.key = seed.key
)
insert into public.team_type_setup_item_options (
  team_type_setup_item_id,
  value,
  label,
  position,
  is_active
)
select
  resolved_items.id,
  option_entry.value,
  option_entry.value,
  option_entry.position::integer,
  true
from resolved_items
cross join lateral jsonb_array_elements_text(resolved_items.options_json)
  with ordinality as option_entry(value, position)
on conflict (team_type_setup_item_id, value) do update
set label = excluded.label,
    position = excluded.position,
    is_active = excluded.is_active,
    updated_at = now();

do $$
declare
  current_team_id uuid;
begin
  for current_team_id in
    select t.id
    from public.teams t
    where t.team_type is not null
      and btrim(t.team_type) <> ''
  loop
    perform public.clone_team_setup_from_team_type(current_team_id);
  end loop;
end;
$$;
