-- 005_team_venues_refactor.sql
-- Replace team_venue_seasons with team_venues and remove assessment module tables.

-- Destructive reset accepted for operational and assessment data in this slice.
truncate table public.camps cascade;

drop table if exists public.assessment_answers;
drop table if exists public.assessment_submissions;
drop table if exists public.assessment_questions;
drop table if exists public.assessment_forms;

create table if not exists public.team_venues (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, venue_id)
);

create index if not exists team_venues_team_idx
  on public.team_venues (team_id);

create index if not exists team_venues_venue_idx
  on public.team_venues (venue_id);

drop trigger if exists set_team_venues_updated_at on public.team_venues;
create trigger set_team_venues_updated_at
before update on public.team_venues
for each row
execute function public.set_updated_at();

alter table public.camps drop constraint if exists camps_team_venue_season_id_fkey;
drop index if exists camps_team_venue_season_idx;

alter table public.camps drop column if exists team_venue_season_id;
alter table public.camps add column if not exists team_venue_id uuid;

alter table public.camps drop constraint if exists camps_team_venue_id_fkey;
alter table public.camps
  add constraint camps_team_venue_id_fkey
  foreign key (team_venue_id) references public.team_venues(id) on delete cascade;

alter table public.camps alter column team_venue_id set not null;

create index if not exists camps_team_venue_idx
  on public.camps (team_venue_id);

drop table if exists public.team_venue_seasons;

drop type if exists public.assessment_submission_status_type;
drop type if exists public.assessment_question_type;
drop type if exists public.assessment_form_status_type;
drop type if exists public.team_venue_season_status_type;

alter table public.team_venues enable row level security;

drop policy if exists team_venues_select_chain on public.team_venues;
create policy team_venues_select_chain
on public.team_venues
for select
using (
  public.is_super_admin()
  or public.is_team_member(team_id)
  or public.is_org_member(
    (
      select t.organization_id
      from public.teams t
      where t.id = team_venues.team_id
    )
  )
);

drop policy if exists team_venues_insert_team_admin_or_coach on public.team_venues;
create policy team_venues_insert_team_admin_or_coach
on public.team_venues
for insert
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = team_venues.team_id
      and tm.profile_id = auth.uid()
      and tm.is_active
      and t.is_active
      and tm.role in ('team_admin', 'coach')
  )
);

drop policy if exists camps_select_chain on public.camps;
create policy camps_select_chain
on public.camps
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.team_venues tv
    where tv.id = camps.team_venue_id
      and (
        public.is_team_member(tv.team_id)
        or public.is_org_member(
          (
            select t.organization_id
            from public.teams t
            where t.id = tv.team_id
          )
        )
      )
  )
);
