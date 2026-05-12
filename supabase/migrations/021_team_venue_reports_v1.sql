-- 021_team_venue_reports_v1.sql
-- Team venue reports v1 (immutable records + camp scope links).

create table if not exists public.team_venue_reports (
  id uuid primary key default gen_random_uuid(),
  team_venue_id uuid not null references public.team_venues(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  name text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name)) > 0)
);

create index if not exists team_venue_reports_team_venue_year_created_idx
  on public.team_venue_reports (team_venue_id, year, created_at desc);

create index if not exists team_venue_reports_created_by_idx
  on public.team_venue_reports (created_by_profile_id);

drop trigger if exists set_team_venue_reports_updated_at on public.team_venue_reports;
create trigger set_team_venue_reports_updated_at
before update on public.team_venue_reports
for each row
execute function public.set_updated_at();

create table if not exists public.team_venue_report_camps (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.team_venue_reports(id) on delete cascade,
  camp_id uuid not null references public.camps(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (report_id, camp_id)
);

create index if not exists team_venue_report_camps_report_idx
  on public.team_venue_report_camps (report_id);

create index if not exists team_venue_report_camps_camp_idx
  on public.team_venue_report_camps (camp_id);

create or replace function public.team_id_for_team_venue_report(target_report_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tv.team_id
  from public.team_venue_reports r
  join public.team_venues tv on tv.id = r.team_venue_id
  where r.id = target_report_id
  limit 1;
$$;

create or replace function public.validate_team_venue_report_camp_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  report_team_venue_id uuid;
  report_year integer;
  camp_team_venue_id uuid;
  camp_year integer;
begin
  select r.team_venue_id, r.year
  into report_team_venue_id, report_year
  from public.team_venue_reports r
  where r.id = new.report_id
  limit 1;

  if report_team_venue_id is null then
    raise exception 'Report % not found for report camp link', new.report_id;
  end if;

  select c.team_venue_id, extract(year from c.start_date)::integer
  into camp_team_venue_id, camp_year
  from public.camps c
  where c.id = new.camp_id
  limit 1;

  if camp_team_venue_id is null then
    raise exception 'Camp % not found for report camp link', new.camp_id;
  end if;

  if camp_team_venue_id <> report_team_venue_id then
    raise exception 'Report camp team venue mismatch for report % and camp %', new.report_id, new.camp_id;
  end if;

  if camp_year <> report_year then
    raise exception 'Report camp year mismatch for report % and camp %', new.report_id, new.camp_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_team_venue_report_camp_scope on public.team_venue_report_camps;
create trigger validate_team_venue_report_camp_scope
before insert or update on public.team_venue_report_camps
for each row
execute function public.validate_team_venue_report_camp_scope();

alter table public.team_venue_reports enable row level security;
alter table public.team_venue_report_camps enable row level security;

drop policy if exists team_venue_reports_select_team_scope on public.team_venue_reports;
create policy team_venue_reports_select_team_scope
on public.team_venue_reports
for select
using (
  public.can_read_team_scope(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists team_venue_reports_insert_manage_team_structure on public.team_venue_reports;
create policy team_venue_reports_insert_manage_team_structure
on public.team_venue_reports
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_team_venue(team_venue_id))
);

drop policy if exists team_venue_report_camps_select_team_scope on public.team_venue_report_camps;
create policy team_venue_report_camps_select_team_scope
on public.team_venue_report_camps
for select
using (
  public.can_read_team_scope(public.team_id_for_team_venue_report(report_id))
);

drop policy if exists team_venue_report_camps_insert_manage_team_structure on public.team_venue_report_camps;
create policy team_venue_report_camps_insert_manage_team_structure
on public.team_venue_report_camps
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_team_venue_report(report_id))
);

insert into public.team_type_setup_items (
  team_type,
  key,
  label,
  input_kind,
  position,
  is_active
)
values
  ('49er', 'type_of_day', 'Type of Day', 'text', 100, true),
  ('49er', 'currents', 'Currents', 'text', 101, true)
on conflict (team_type, key) do update
set label = excluded.label,
    input_kind = excluded.input_kind,
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
