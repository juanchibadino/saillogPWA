-- 038_team_home_kpi_totals.sql
-- Aggregate Team Home KPI totals without loading every camp/session row.

create or replace function public.get_team_home_kpi_totals(
  p_team_id uuid
)
returns table (
  camp_count bigint,
  session_count bigint,
  sessions_with_net_time bigint,
  total_net_time_minutes bigint,
  average_net_time_minutes integer
)
language sql
stable
set search_path = public
as $$
  with team_camps as (
    select c.id
    from public.team_venues tv
    join public.camps c
      on c.team_venue_id = tv.id
    where tv.team_id = p_team_id
      and public.can_read_team_scope(p_team_id)
  ),
  session_totals as (
    select
      count(s.id)::bigint as session_count,
      count(s.net_time_minutes)::bigint as sessions_with_net_time,
      coalesce(sum(s.net_time_minutes), 0)::bigint as total_net_time_minutes,
      case
        when count(s.net_time_minutes) > 0 then round(avg(s.net_time_minutes))::integer
        else null
      end as average_net_time_minutes
    from team_camps tc
    left join public.sessions s
      on s.camp_id = tc.id
  )
  select
    (select count(*)::bigint from team_camps) as camp_count,
    session_totals.session_count,
    session_totals.sessions_with_net_time,
    session_totals.total_net_time_minutes,
    session_totals.average_net_time_minutes
  from session_totals;
$$;
