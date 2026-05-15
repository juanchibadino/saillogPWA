-- 023_setup_weather_lock_tws_allocation_v1.sql
-- Lock fixed weather setup metrics and persist TWS option allocation percentages.

do $$
begin
  create type public.setup_metric_group as enum ('weather', 'boat');
exception
  when duplicate_object then null;
end;
$$;

alter table public.team_type_setup_items
  add column if not exists metric_group public.setup_metric_group not null default 'boat',
  add column if not exists is_fixed boolean not null default false;

alter table public.team_setup_items
  add column if not exists metric_group public.setup_metric_group not null default 'boat',
  add column if not exists is_fixed boolean not null default false;

create index if not exists team_setup_items_team_group_position_idx
  on public.team_setup_items (team_id, metric_group, position);

alter table public.session_setup_item_selected_options
  add column if not exists allocation_percent integer;

alter table public.session_setup_item_selected_options
  drop constraint if exists session_setup_item_selected_options_allocation_percent_check;

alter table public.session_setup_item_selected_options
  add constraint session_setup_item_selected_options_allocation_percent_check
  check (
    allocation_percent is null
    or (allocation_percent >= 0 and allocation_percent <= 100)
  );

update public.team_type_setup_items
set metric_group = 'weather'::public.setup_metric_group,
    is_fixed = true,
    updated_at = now()
where key in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents');

update public.team_type_setup_items
set metric_group = 'boat'::public.setup_metric_group,
    is_fixed = false,
    updated_at = now()
where key not in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents');

update public.team_setup_items tsi
set metric_group = coalesce(
      ttsi.metric_group,
      case
        when tsi.key in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents')
          then 'weather'::public.setup_metric_group
        else 'boat'::public.setup_metric_group
      end
    ),
    is_fixed = coalesce(ttsi.is_fixed, tsi.key in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents')),
    updated_at = now()
from public.team_type_setup_items ttsi
where tsi.team_type_setup_item_id = ttsi.id;

update public.team_setup_items tsi
set metric_group = case
      when tsi.key in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents')
        then 'weather'::public.setup_metric_group
      else 'boat'::public.setup_metric_group
    end,
    is_fixed = tsi.key in ('twd', 'tws', 'sea_state', 'type_of_day', 'currents'),
    updated_at = now()
where tsi.team_type_setup_item_id is null;

create or replace function public.clone_team_setup_from_team_type(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_team_type text;
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

  insert into public.team_setup_items (
    team_id,
    team_type_setup_item_id,
    key,
    label,
    input_kind,
    metric_group,
    is_fixed,
    position,
    is_active
  )
  select
    target_team_id,
    ttsi.id,
    ttsi.key,
    ttsi.label,
    ttsi.input_kind,
    ttsi.metric_group,
    ttsi.is_fixed,
    ttsi.position,
    ttsi.is_active
  from public.team_type_setup_items ttsi
  where ttsi.team_type = resolved_team_type
  order by ttsi.position, ttsi.created_at
  on conflict (team_id, key) do update
  set team_type_setup_item_id = excluded.team_type_setup_item_id,
      label = excluded.label,
      input_kind = excluded.input_kind,
      metric_group = excluded.metric_group,
      is_fixed = excluded.is_fixed,
      position = excluded.position,
      is_active = excluded.is_active,
      updated_at = now();

  update public.team_setup_items tsi
  set team_type_setup_item_id = ttsi.id,
      metric_group = ttsi.metric_group,
      is_fixed = ttsi.is_fixed,
      updated_at = now()
  from public.team_type_setup_items ttsi
  where tsi.team_id = target_team_id
    and ttsi.team_type = resolved_team_type
    and tsi.key = ttsi.key
    and (
      tsi.team_type_setup_item_id is null
      or tsi.metric_group is distinct from ttsi.metric_group
      or tsi.is_fixed is distinct from ttsi.is_fixed
    );

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
  on conflict (team_setup_item_id, value) do update
  set team_type_setup_item_option_id = excluded.team_type_setup_item_option_id,
      label = excluded.label,
      position = excluded.position,
      is_active = excluded.is_active,
      updated_at = now();
end;
$$;

create or replace function public.is_internal_backend_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
    or current_user in ('postgres', 'supabase_admin');
$$;

create or replace function public.prevent_fixed_team_setup_item_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_super_admin() or public.is_internal_backend_role() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_fixed then
      raise exception 'Fixed setup metrics cannot be deleted.';
    end if;

    return old;
  end if;

  if old.is_fixed and (
    new.key is distinct from old.key
    or new.label is distinct from old.label
    or new.input_kind is distinct from old.input_kind
    or new.metric_group is distinct from old.metric_group
    or new.is_fixed is distinct from old.is_fixed
    or new.position is distinct from old.position
    or new.is_active is distinct from old.is_active
    or new.team_id is distinct from old.team_id
  ) then
    raise exception 'Fixed setup metrics cannot be edited.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_fixed_team_setup_item_mutation on public.team_setup_items;

create trigger prevent_fixed_team_setup_item_mutation
before update or delete on public.team_setup_items
for each row
execute function public.prevent_fixed_team_setup_item_mutation();

create or replace function public.prevent_fixed_team_setup_option_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_item_id uuid;
  is_fixed_item boolean;
begin
  if public.is_super_admin() or public.is_internal_backend_role() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  resolved_item_id := case
    when tg_op = 'DELETE' then old.team_setup_item_id
    else new.team_setup_item_id
  end;

  select tsi.is_fixed
  into is_fixed_item
  from public.team_setup_items tsi
  where tsi.id = resolved_item_id
  limit 1;

  if coalesce(is_fixed_item, false) then
    raise exception 'Options for fixed setup metrics cannot be changed.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_fixed_team_setup_option_mutation on public.team_setup_item_options;

create trigger prevent_fixed_team_setup_option_mutation
before insert or update or delete on public.team_setup_item_options
for each row
execute function public.prevent_fixed_team_setup_option_mutation();

-- Keep all existing teams aligned with team_type setup metadata.
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
