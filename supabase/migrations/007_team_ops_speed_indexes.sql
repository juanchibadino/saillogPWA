-- 007_team_ops_speed_indexes.sql
-- Speed-focused indexes for team camps and sessions list paths.

create index if not exists camps_team_venue_start_created_idx
  on public.camps (team_venue_id, start_date desc, created_at desc);

create index if not exists sessions_camp_date_created_idx
  on public.sessions (camp_id, session_date desc, created_at desc);
