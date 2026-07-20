-- Required TWS setup metric and TWS-weighted Gear usage multipliers.

alter table public.team_type_setup_items
  add column if not exists is_required boolean not null default false;

alter table public.team_setup_items
  add column if not exists is_required boolean not null default false;

update public.team_type_setup_items
set
  label = case
    when key = 'tws' then 'TWS'
    when key = 'twd' then 'TWD'
    when key = 'sea_state' then 'Sea State'
    when key = 'conditions' then 'Conditions'
    when key = 'type_of_day' then 'Type of Day'
    when key = 'currents' then 'Currents'
    when key = 'course_area' then 'Course Area'
    else label
  end,
  input_kind = case
    when key = 'tws' then 'multi_select'::public.setup_input_kind
    else input_kind
  end,
  metric_group = 'weather'::public.setup_metric_group,
  is_fixed = false,
  is_required = key = 'tws',
  is_active = case when key = 'tws' then true else is_active end,
  updated_at = now()
where key in ('twd', 'tws', 'sea_state', 'conditions', 'type_of_day', 'currents', 'course_area');

update public.team_type_setup_items
set
  is_required = false,
  updated_at = now()
where key <> 'tws'
  and is_required is distinct from false;

update public.team_setup_items
set
  label = case
    when key = 'tws' then 'TWS'
    when key = 'twd' then 'TWD'
    when key = 'sea_state' then 'Sea State'
    when key = 'conditions' then 'Conditions'
    when key = 'type_of_day' then 'Type of Day'
    when key = 'currents' then 'Currents'
    when key = 'course_area' then 'Course Area'
    else label
  end,
  input_kind = case
    when key = 'tws' then 'multi_select'::public.setup_input_kind
    else input_kind
  end,
  metric_group = 'weather'::public.setup_metric_group,
  is_fixed = false,
  is_required = key = 'tws',
  is_active = case when key = 'tws' then true else is_active end,
  updated_at = now()
where key in ('twd', 'tws', 'sea_state', 'conditions', 'type_of_day', 'currents', 'course_area');

update public.team_setup_items
set
  is_required = false,
  updated_at = now()
where key <> 'tws'
  and is_required is distinct from false;

alter table public.team_type_setup_items
  drop constraint if exists team_type_setup_items_required_tws_only;

alter table public.team_type_setup_items
  add constraint team_type_setup_items_required_tws_only
  check (
    (
      key = 'tws'
      and is_required
      and input_kind = 'multi_select'::public.setup_input_kind
      and metric_group = 'weather'::public.setup_metric_group
      and is_active
    )
    or (
      key <> 'tws'
      and not is_required
    )
  );

alter table public.team_setup_items
  drop constraint if exists team_setup_items_required_tws_only;

alter table public.team_setup_items
  add constraint team_setup_items_required_tws_only
  check (
    (
      key = 'tws'
      and is_required
      and input_kind = 'multi_select'::public.setup_input_kind
      and metric_group = 'weather'::public.setup_metric_group
      and is_active
    )
    or (
      key <> 'tws'
      and not is_required
    )
  );

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

  with team_position_anchor as (
    select coalesce(max(tsi.position), 0) as max_position
    from public.team_setup_items tsi
    where tsi.team_id = target_team_id
  ),
  missing_template_items as (
    select
      ttsi.*,
      row_number() over (order by ttsi.position, ttsi.created_at) as missing_index
    from public.team_type_setup_items ttsi
    where ttsi.team_type = resolved_team_type
      and not exists (
        select 1
        from public.team_setup_items existing_items
        where existing_items.team_id = target_team_id
          and existing_items.key = ttsi.key
      )
  )
  insert into public.team_setup_items (
    team_id,
    team_type_setup_item_id,
    key,
    label,
    input_kind,
    metric_group,
    is_fixed,
    is_required,
    position,
    is_active
  )
  select
    target_team_id,
    missing_template_items.id,
    missing_template_items.key,
    missing_template_items.label,
    missing_template_items.input_kind,
    missing_template_items.metric_group,
    missing_template_items.is_fixed,
    missing_template_items.is_required,
    team_position_anchor.max_position + missing_template_items.missing_index,
    missing_template_items.is_active
  from missing_template_items
  cross join team_position_anchor;

  update public.team_setup_items tsi
  set team_type_setup_item_id = ttsi.id,
      metric_group = ttsi.metric_group,
      is_fixed = ttsi.is_fixed,
      is_required = ttsi.is_required,
      updated_at = now()
  from public.team_type_setup_items ttsi
  where tsi.team_id = target_team_id
    and ttsi.team_type = resolved_team_type
    and tsi.key = ttsi.key
    and (
      tsi.team_type_setup_item_id is null
      or tsi.metric_group is distinct from ttsi.metric_group
      or tsi.is_fixed is distinct from ttsi.is_fixed
      or tsi.is_required is distinct from ttsi.is_required
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
    and tsi.input_kind <> 'text'::public.setup_input_kind
    and not exists (
      select 1
      from public.team_setup_item_options existing_options
      where existing_options.team_setup_item_id = tsi.id
    )
  order by tsi.position, ttsio.position
  on conflict (team_setup_item_id, value) do update
  set team_type_setup_item_option_id = excluded.team_type_setup_item_option_id,
      updated_at = now();
end;
$$;

with source_team_types as (
  select distinct ttsi.team_type
  from public.team_type_setup_items ttsi
  where ttsi.team_type is not null
    and btrim(ttsi.team_type) <> ''

  union

  select distinct t.team_type
  from public.teams t
  where t.team_type is not null
    and btrim(t.team_type) <> ''
),
next_positions as (
  select
    source_team_types.team_type,
    coalesce(max(ttsi.position), 0) + 1 as next_position
  from source_team_types
  left join public.team_type_setup_items ttsi
    on ttsi.team_type = source_team_types.team_type
  group by source_team_types.team_type
)
insert into public.team_type_setup_items (
  team_type,
  key,
  label,
  input_kind,
  metric_group,
  is_fixed,
  is_required,
  position,
  is_active
)
select
  next_positions.team_type,
  'course_area',
  'Course Area',
  'text'::public.setup_input_kind,
  'weather'::public.setup_metric_group,
  false,
  false,
  next_positions.next_position,
  true
from next_positions
on conflict (team_type, key) do update
set label = excluded.label,
    metric_group = excluded.metric_group,
    is_fixed = false,
    is_required = false,
    updated_at = now();

create or replace function public.prevent_fixed_team_setup_item_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_internal_backend_role() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_required then
      raise exception 'Required setup metrics cannot be deleted.';
    end if;

    if old.is_fixed then
      raise exception 'Fixed setup metrics cannot be deleted.';
    end if;

    return old;
  end if;

  if old.is_required and (
    new.key is distinct from old.key
    or new.label is distinct from old.label
    or new.input_kind is distinct from old.input_kind
    or new.metric_group is distinct from old.metric_group
    or new.is_required is distinct from old.is_required
    or new.is_active is distinct from old.is_active
    or new.team_id is distinct from old.team_id
  ) then
    raise exception 'Required setup metrics cannot be edited.';
  end if;

  if public.is_super_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
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

create table if not exists public.gear_tws_option_multipliers (
  id uuid primary key default gen_random_uuid(),
  gear_item_id uuid not null references public.gear_items(id) on delete cascade,
  team_setup_item_option_id uuid not null references public.team_setup_item_options(id) on delete cascade,
  usage_minutes_multiplier numeric(8,4) not null default 1,
  usage_count_multiplier numeric(8,4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gear_item_id, team_setup_item_option_id),
  check (usage_minutes_multiplier >= 0),
  check (usage_count_multiplier >= 0)
);

create index if not exists gear_tws_option_multipliers_gear_item_idx
  on public.gear_tws_option_multipliers (gear_item_id);

create index if not exists gear_tws_option_multipliers_option_idx
  on public.gear_tws_option_multipliers (team_setup_item_option_id);

drop trigger if exists set_gear_tws_option_multipliers_updated_at
  on public.gear_tws_option_multipliers;

create trigger set_gear_tws_option_multipliers_updated_at
before update on public.gear_tws_option_multipliers
for each row
execute function public.set_updated_at();

create or replace function public.validate_gear_tws_option_multiplier_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gear_team_id uuid;
  option_team_id uuid;
begin
  select gi.team_id
  into gear_team_id
  from public.gear_items gi
  where gi.id = new.gear_item_id
  limit 1;

  select tsi.team_id
  into option_team_id
  from public.team_setup_item_options tsio
  join public.team_setup_items tsi on tsi.id = tsio.team_setup_item_id
  where tsio.id = new.team_setup_item_option_id
    and tsio.is_active
    and tsi.is_active
    and tsi.key = 'tws'
    and tsi.metric_group = 'weather'::public.setup_metric_group
    and tsi.input_kind = 'multi_select'::public.setup_input_kind
  limit 1;

  if gear_team_id is null or option_team_id is null or gear_team_id <> option_team_id then
    raise exception 'TWS multiplier must reference a Gear item and active TWS option in the same team.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_gear_tws_option_multiplier_scope
  on public.gear_tws_option_multipliers;

create trigger validate_gear_tws_option_multiplier_scope
before insert or update on public.gear_tws_option_multipliers
for each row
execute function public.validate_gear_tws_option_multiplier_scope();

alter table public.gear_tws_option_multipliers enable row level security;

drop policy if exists gear_tws_option_multipliers_select_team_scope
  on public.gear_tws_option_multipliers;
create policy gear_tws_option_multipliers_select_team_scope
on public.gear_tws_option_multipliers
for select
using (
  public.can_read_team_scope(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_tws_option_multipliers_insert_manage_team_sessions
  on public.gear_tws_option_multipliers;
create policy gear_tws_option_multipliers_insert_manage_team_sessions
on public.gear_tws_option_multipliers
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_tws_option_multipliers_update_manage_team_sessions
  on public.gear_tws_option_multipliers;
create policy gear_tws_option_multipliers_update_manage_team_sessions
on public.gear_tws_option_multipliers
for update
using (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop policy if exists gear_tws_option_multipliers_delete_manage_team_sessions
  on public.gear_tws_option_multipliers;
create policy gear_tws_option_multipliers_delete_manage_team_sessions
on public.gear_tws_option_multipliers
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_gear_item(gear_item_id))
);

drop function if exists public.get_team_gear_list_rows(
  uuid,
  public.gear_type,
  public.gear_status,
  public.gear_condition,
  public.gear_alert_state,
  integer,
  integer
);

create or replace function public.get_team_gear_list_rows(
  p_team_id uuid,
  p_type public.gear_type default null,
  p_status public.gear_status default null,
  p_condition public.gear_condition default null,
  p_alert public.gear_alert_state default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  gear_item_id uuid,
  team_id uuid,
  name text,
  gear_type public.gear_type,
  serial_number text,
  barcode text,
  status public.gear_status,
  condition public.gear_condition,
  usage_count numeric,
  usage_minutes numeric,
  alert_state public.gear_alert_state,
  triggered_alert_count bigint,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select
      greatest(1, least(coalesce(p_limit, 25), 250)) as safe_limit,
      greatest(0, coalesce(p_offset, 0)) as safe_offset
  ),
  base as (
    select
      gi.id as gear_item_id,
      gi.team_id,
      gi.name,
      gi.gear_type,
      gi.serial_number,
      gi.barcode,
      gi.status,
      gi.condition,
      gi.created_at
    from public.gear_items gi
    where gi.team_id = p_team_id
      and public.can_read_team_scope(p_team_id)
      and (p_type is null or gi.gear_type = p_type)
      and (p_status is null or gi.status = p_status)
      and (p_condition is null or gi.condition = p_condition)
  ),
  linked_sessions as (
    select
      sgu.gear_item_id,
      sgu.session_id,
      (
        case
          when s.net_time_minutes is not null and s.net_time_minutes >= 0 then
            s.net_time_minutes
          when s.dock_out_at is not null
           and s.dock_in_at is not null
           and s.dock_in_at >= s.dock_out_at then
            floor(extract(epoch from (s.dock_in_at - s.dock_out_at)) / 60)
          else 0
        end
      )::numeric as session_minutes
    from public.session_gear_usage sgu
    join base b
      on b.gear_item_id = sgu.gear_item_id
    left join public.sessions s
      on s.id = sgu.session_id
  ),
  active_tws_options as (
    select
      tsio.id as team_setup_item_option_id,
      row_number() over (order by tsio.position, tsio.created_at, tsio.id) as option_order,
      count(*) over () as option_count
    from public.team_setup_items tsi
    join public.team_setup_item_options tsio
      on tsio.team_setup_item_id = tsi.id
     and tsio.is_active
    where tsi.team_id = p_team_id
      and tsi.key = 'tws'
      and tsi.metric_group = 'weather'::public.setup_metric_group
      and tsi.input_kind = 'multi_select'::public.setup_input_kind
      and tsi.is_active
  ),
  tws_option_defaults as (
    select
      team_setup_item_option_id,
      case
        when option_count <= 1 then 1::numeric
        when option_count = 2 then
          case when option_order = 1 then 0.5::numeric else 1::numeric end
        when option_count = 3 then
          case
            when option_order = 1 then 0.4::numeric
            when option_order = 2 then 0.6::numeric
            else 1::numeric
          end
        when option_count = 4 then
          case
            when option_order = 1 then 0.3::numeric
            when option_order = 2 then 0.5::numeric
            when option_order = 3 then 0.7::numeric
            else 1::numeric
          end
        when option_count = 5 then
          case
            when option_order = 1 then 0.2::numeric
            when option_order = 2 then 0.4::numeric
            when option_order = 3 then 0.6::numeric
            when option_order = 4 then 0.8::numeric
            else 1::numeric
          end
        else round(
          (0.1 + ((option_order - 1) * (0.9 / nullif(option_count - 1, 0))))::numeric,
          2
        )
      end as default_multiplier
    from active_tws_options
  ),
  tws_selected_options as (
    select
      ssiv.session_id,
      ssiso.team_setup_item_option_id,
      ssiso.allocation_percent,
      count(*) over (partition by ssiv.id) as selected_option_count
    from public.session_setup_item_values ssiv
    join public.team_setup_items tsi
      on tsi.id = ssiv.team_setup_item_id
     and tsi.team_id = p_team_id
     and tsi.key = 'tws'
     and tsi.metric_group = 'weather'::public.setup_metric_group
     and tsi.input_kind = 'multi_select'::public.setup_input_kind
     and tsi.is_active
    join public.session_setup_item_selected_options ssiso
      on ssiso.session_setup_item_value_id = ssiv.id
    join active_tws_options
      on active_tws_options.team_setup_item_option_id = ssiso.team_setup_item_option_id
  ),
  tws_allocations as (
    select
      session_id,
      team_setup_item_option_id,
      case
        when allocation_percent is not null then greatest(allocation_percent, 0)::numeric / 100
        when selected_option_count > 0 then 1::numeric / selected_option_count
        else 0
      end as allocation_weight
    from tws_selected_options
  ),
  usage_totals as (
    select
      linked_sessions.gear_item_id,
      coalesce(
        round(
          sum(
            tws_allocations.allocation_weight
            * coalesce(
                multipliers.usage_count_multiplier,
                tws_option_defaults.default_multiplier,
                1
              )
          ),
          2
        ),
        0
      ) as usage_count,
      coalesce(
        round(
          sum(
            linked_sessions.session_minutes
            * tws_allocations.allocation_weight
            * coalesce(
                multipliers.usage_minutes_multiplier,
                tws_option_defaults.default_multiplier,
                1
              )
          ),
          2
        ),
        0
      ) as usage_minutes
    from linked_sessions
    left join tws_allocations
      on tws_allocations.session_id = linked_sessions.session_id
    left join public.gear_tws_option_multipliers multipliers
      on multipliers.gear_item_id = linked_sessions.gear_item_id
     and multipliers.team_setup_item_option_id = tws_allocations.team_setup_item_option_id
    left join tws_option_defaults
      on tws_option_defaults.team_setup_item_option_id =
        tws_allocations.team_setup_item_option_id
    group by linked_sessions.gear_item_id
  ),
  rule_hits as (
    select
      b.gear_item_id,
      gar.id as rule_id,
      gar.severity
    from base b
    left join usage_totals usage
      on usage.gear_item_id = b.gear_item_id
    join public.gear_alert_rules gar
      on gar.gear_item_id = b.gear_item_id
    where (not gar.is_refurbished_rule or b.condition = 'refurbished'::public.gear_condition)
      and (
        case gar.metric
          when 'usage_count'::public.gear_alert_metric then coalesce(usage.usage_count, 0)
          when 'usage_minutes'::public.gear_alert_metric then coalesce(usage.usage_minutes, 0)
        end
      ) >= gar.threshold_value
  ),
  alert_summary as (
    select
      b.gear_item_id,
      count(rule_hits.rule_id)::bigint as triggered_alert_count,
      coalesce(
        bool_or(rule_hits.severity = 'critical'::public.gear_alert_severity),
        false
      ) as has_critical,
      coalesce(
        bool_or(rule_hits.severity = 'warning'::public.gear_alert_severity),
        false
      ) as has_warning
    from base b
    left join rule_hits
      on rule_hits.gear_item_id = b.gear_item_id
    group by b.gear_item_id
  ),
  computed as (
    select
      b.gear_item_id,
      b.team_id,
      b.name,
      b.gear_type,
      b.serial_number,
      b.barcode,
      b.status,
      b.condition,
      coalesce(usage.usage_count, 0) as usage_count,
      coalesce(usage.usage_minutes, 0) as usage_minutes,
      case
        when alert_summary.has_critical then 'critical'::public.gear_alert_state
        when alert_summary.has_warning then 'warning'::public.gear_alert_state
        else 'none'::public.gear_alert_state
      end as alert_state,
      case
        when alert_summary.has_critical or alert_summary.has_warning then
          alert_summary.triggered_alert_count
        else 0
      end::bigint as triggered_alert_count,
      b.created_at
    from base b
    left join usage_totals usage
      on usage.gear_item_id = b.gear_item_id
    left join alert_summary
      on alert_summary.gear_item_id = b.gear_item_id
  ),
  filtered as (
    select *
    from computed
    where p_alert is null or computed.alert_state = p_alert
  )
  select
    filtered.gear_item_id,
    filtered.team_id,
    filtered.name,
    filtered.gear_type,
    filtered.serial_number,
    filtered.barcode,
    filtered.status,
    filtered.condition,
    filtered.usage_count,
    filtered.usage_minutes,
    filtered.alert_state,
    filtered.triggered_alert_count,
    filtered.created_at,
    count(*) over() as total_count
  from filtered
  order by
    filtered.name asc,
    filtered.created_at desc,
    filtered.gear_item_id
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;
