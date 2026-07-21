-- Count linked gear at 1x when a session has no active TWS allocation.

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
            case
              when tws_allocations.session_id is null then 1::numeric
              else
                tws_allocations.allocation_weight
                * coalesce(
                    multipliers.usage_count_multiplier,
                    tws_option_defaults.default_multiplier,
                    1
                  )
            end
          ),
          2
        ),
        0
      ) as usage_count,
      coalesce(
        round(
          sum(
            linked_sessions.session_minutes
            * case
                when tws_allocations.session_id is null then 1::numeric
                else
                  tws_allocations.allocation_weight
                  * coalesce(
                      multipliers.usage_minutes_multiplier,
                      tws_option_defaults.default_multiplier,
                      1
                    )
              end
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
    where (
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
        when alert_summary.has_warning then 'warning'::public.gear_alert_state
        when alert_summary.has_critical then 'critical'::public.gear_alert_state
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
