-- 030_bound_session_catalog_indexes.sql
-- Support bounded Team Session catalog paging/search paths.

create index if not exists team_standard_moves_team_active_name_idx
  on public.team_standard_moves (team_id, is_active, name, id);

create index if not exists team_venue_wind_patterns_team_venue_active_name_idx
  on public.team_venue_wind_patterns (team_venue_id, is_active, name, id);

create index if not exists gear_items_team_name_idx
  on public.gear_items (team_id, name, id);

create index if not exists gear_items_team_type_name_idx
  on public.gear_items (team_id, gear_type, name, id);
