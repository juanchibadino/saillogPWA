-- 035_team_gear_list_rows.sql
-- Computed, paginated team-scoped Gear listing for alert-aware filtering.

do $$ begin
  create type public.gear_alert_state as enum ('critical', 'warning', 'none');
exception
  when duplicate_object then null;
end $$;

create index if not exists session_gear_usage_gear_item_session_idx
  on public.session_gear_usage (gear_item_id, session_id);

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
  usage_count bigint,
  usage_minutes bigint,
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
  usage_totals as (
    select
      sgu.gear_item_id,
      count(*)::bigint as usage_count,
      coalesce(
        sum(
          case
            when s.net_time_minutes is not null and s.net_time_minutes >= 0 then
              s.net_time_minutes::bigint
            when s.dock_out_at is not null
             and s.dock_in_at is not null
             and s.dock_in_at >= s.dock_out_at then
              floor(extract(epoch from (s.dock_in_at - s.dock_out_at)) / 60)::bigint
            else 0
          end
        ),
        0
      )::bigint as usage_minutes
    from public.session_gear_usage sgu
    join base b
      on b.gear_item_id = sgu.gear_item_id
    left join public.sessions s
      on s.id = sgu.session_id
    group by sgu.gear_item_id
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
      coalesce(usage.usage_count, 0)::bigint as usage_count,
      coalesce(usage.usage_minutes, 0)::bigint as usage_minutes,
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
