-- Keep session dates inside their parent camp date range.

create or replace function public.validate_session_date_within_camp_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  camp_start_date date;
  camp_end_date date;
begin
  select c.start_date, c.end_date
  into camp_start_date, camp_end_date
  from public.camps c
  where c.id = new.camp_id;

  if camp_start_date is null then
    raise exception 'Camp % not found for session date validation', new.camp_id;
  end if;

  if new.session_date < camp_start_date or new.session_date > camp_end_date then
    raise exception 'Session date % must be within camp date range % to %',
      new.session_date,
      camp_start_date,
      camp_end_date;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_date_within_camp_range on public.sessions;
create trigger validate_session_date_within_camp_range
before insert or update of camp_id, session_date on public.sessions
for each row
execute function public.validate_session_date_within_camp_range();

create or replace function public.validate_camp_date_range_contains_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.sessions s
    where s.camp_id = new.id
      and (s.session_date < new.start_date or s.session_date > new.end_date)
  ) then
    raise exception 'Camp date range must include all existing session dates';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_camp_date_range_contains_sessions on public.camps;
create trigger validate_camp_date_range_contains_sessions
before update of start_date, end_date on public.camps
for each row
execute function public.validate_camp_date_range_contains_sessions();
