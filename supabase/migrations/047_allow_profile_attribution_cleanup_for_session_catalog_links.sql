-- Allow profile deletion to clear attribution on existing session catalog links.
-- Link scope validation should only run when the linked session/catalog item changes.

create or replace function public.validate_session_standard_move_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_team_id uuid;
  move_team_id uuid;
  move_is_active boolean;
begin
  if tg_op = 'UPDATE'
    and new.session_id is not distinct from old.session_id
    and new.team_standard_move_id is not distinct from old.team_standard_move_id then
    return new;
  end if;

  session_team_id := public.team_id_for_session(new.session_id);

  select tsm.team_id, tsm.is_active
  into move_team_id, move_is_active
  from public.team_standard_moves tsm
  where tsm.id = new.team_standard_move_id
  limit 1;

  if session_team_id is null then
    raise exception 'Session % not found for standard move link', new.session_id;
  end if;

  if move_team_id is null then
    raise exception 'Standard move % not found', new.team_standard_move_id;
  end if;

  if session_team_id <> move_team_id then
    raise exception 'Session % and standard move % must belong to the same team', new.session_id, new.team_standard_move_id;
  end if;

  if move_is_active is distinct from true then
    raise exception 'Standard move % is archived and cannot be linked to sessions', new.team_standard_move_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_standard_move_scope on public.session_standard_moves;
create trigger validate_session_standard_move_scope
before insert or update of session_id, team_standard_move_id on public.session_standard_moves
for each row
execute function public.validate_session_standard_move_scope();

create or replace function public.validate_session_wind_pattern_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_team_venue_id uuid;
  pattern_team_venue_id uuid;
  pattern_is_active boolean;
begin
  if tg_op = 'UPDATE'
    and new.session_id is not distinct from old.session_id
    and new.team_venue_wind_pattern_id is not distinct from old.team_venue_wind_pattern_id then
    return new;
  end if;

  session_team_venue_id := public.team_venue_id_for_session(new.session_id);

  select tvwp.team_venue_id, tvwp.is_active
  into pattern_team_venue_id, pattern_is_active
  from public.team_venue_wind_patterns tvwp
  where tvwp.id = new.team_venue_wind_pattern_id
  limit 1;

  if session_team_venue_id is null then
    raise exception 'Session % not found for wind pattern link', new.session_id;
  end if;

  if pattern_team_venue_id is null then
    raise exception 'Wind pattern % not found', new.team_venue_wind_pattern_id;
  end if;

  if session_team_venue_id <> pattern_team_venue_id then
    raise exception 'Session % and wind pattern % must belong to the same team venue', new.session_id, new.team_venue_wind_pattern_id;
  end if;

  if pattern_is_active is distinct from true then
    raise exception 'Wind pattern % is archived and cannot be linked to sessions', new.team_venue_wind_pattern_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_wind_pattern_scope on public.session_wind_patterns;
create trigger validate_session_wind_pattern_scope
before insert or update of session_id, team_venue_wind_pattern_id on public.session_wind_patterns
for each row
execute function public.validate_session_wind_pattern_scope();
