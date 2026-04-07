-- 001_initial_schema.sql
-- Initial Sailog schema for Supabase

create extension if not exists pgcrypto;

do $$ begin
  create type public.global_role_type as enum ('super_admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_role_type as enum ('organization_admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.team_role_type as enum ('team_admin', 'coach', 'crew');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.team_venue_season_status_type as enum ('planned', 'active', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.camp_type as enum ('training', 'regatta', 'mixed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_type as enum ('training', 'regatta');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_type as enum ('photo', 'analytics_file', 'document');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.assessment_form_status_type as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.assessment_question_type as enum ('numeric_scale', 'single_choice', 'text');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.assessment_submission_status_type as enum ('draft', 'submitted');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  photo_url text,
  global_role public.global_role_type,
  is_active boolean not null default true,
  legacy_glide_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role_type not null,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id, role)
);

create index if not exists organization_memberships_org_idx
  on public.organization_memberships (organization_id);

create index if not exists organization_memberships_profile_idx
  on public.organization_memberships (profile_id);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  team_type text,
  is_active boolean not null default true,
  legacy_glide_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists teams_organization_idx
  on public.teams (organization_id);

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role_type not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  check (left_at is null or left_at >= joined_at),
  unique (team_id, profile_id, role)
);

create index if not exists team_memberships_team_idx
  on public.team_memberships (team_id);

create index if not exists team_memberships_profile_idx
  on public.team_memberships (profile_id);

create index if not exists team_memberships_role_idx
  on public.team_memberships (role);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  country text,
  city text,
  venue_type text,
  notes text,
  is_active boolean not null default true,
  legacy_glide_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists venues_organization_idx
  on public.venues (organization_id);

drop trigger if exists set_venues_updated_at on public.venues;
create trigger set_venues_updated_at
before update on public.venues
for each row
execute function public.set_updated_at();

create table if not exists public.team_venue_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  label text,
  start_date date,
  end_date date,
  status public.team_venue_season_status_type not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  unique (team_id, venue_id, year)
);

create index if not exists team_venue_seasons_team_idx
  on public.team_venue_seasons (team_id);

create index if not exists team_venue_seasons_venue_idx
  on public.team_venue_seasons (venue_id);

create index if not exists team_venue_seasons_year_idx
  on public.team_venue_seasons (year);

drop trigger if exists set_team_venue_seasons_updated_at on public.team_venue_seasons;
create trigger set_team_venue_seasons_updated_at
before update on public.team_venue_seasons
for each row
execute function public.set_updated_at();

create table if not exists public.camps (
  id uuid primary key default gen_random_uuid(),
  team_venue_season_id uuid not null references public.team_venue_seasons(id) on delete cascade,
  name text not null,
  camp_type public.camp_type not null,
  start_date date not null,
  end_date date not null,
  notes text,
  is_active boolean not null default true,
  legacy_glide_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists camps_team_venue_season_idx
  on public.camps (team_venue_season_id);

create index if not exists camps_date_idx
  on public.camps (start_date, end_date);

drop trigger if exists set_camps_updated_at on public.camps;
create trigger set_camps_updated_at
before update on public.camps
for each row
execute function public.set_updated_at();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete cascade,
  session_type public.session_type not null,
  session_date date not null,
  title text,
  dock_out_at timestamptz,
  dock_in_at timestamptz,
  net_time_minutes integer check (net_time_minutes is null or net_time_minutes >= 0),
  highlighted_by_coach boolean not null default false,
  coach_profile_id uuid references public.profiles(id) on delete set null,
  weather_summary text,
  notes text,
  legacy_glide_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dock_in_at is null or dock_out_at is null or dock_in_at >= dock_out_at)
);

create index if not exists sessions_camp_idx
  on public.sessions (camp_id);

create index if not exists sessions_date_idx
  on public.sessions (session_date);

create index if not exists sessions_type_idx
  on public.sessions (session_type);

create index if not exists sessions_coach_idx
  on public.sessions (coach_profile_id);

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row
execute function public.set_updated_at();

create table if not exists public.session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  best_of_session text,
  to_work text,
  standard_moves jsonb,
  wind_patterns jsonb,
  coach_notes text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_reviews_reviewed_by_idx
  on public.session_reviews (reviewed_by_profile_id);

drop trigger if exists set_session_reviews_updated_at on public.session_reviews;
create trigger set_session_reviews_updated_at
before update on public.session_reviews
for each row
execute function public.set_updated_at();

create table if not exists public.session_regatta_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  race_number integer,
  fleet text,
  position integer,
  points numeric(10,2),
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (race_number is null or race_number > 0),
  check (position is null or position > 0),
  check (points is null or points >= 0)
);

drop trigger if exists set_session_regatta_results_updated_at on public.session_regatta_results;
create trigger set_session_regatta_results_updated_at
before update on public.session_regatta_results
for each row
execute function public.set_updated_at();

create table if not exists public.session_setups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  entered_by_profile_id uuid references public.profiles(id) on delete set null,
  boat_settings jsonb,
  sail_settings jsonb,
  free_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_setups_entered_by_idx
  on public.session_setups (entered_by_profile_id);

drop trigger if exists set_session_setups_updated_at on public.session_setups;
create trigger set_session_setups_updated_at
before update on public.session_setups
for each row
execute function public.set_updated_at();

create table if not exists public.session_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  asset_type public.asset_type not null,
  bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists session_assets_session_idx
  on public.session_assets (session_id);

create index if not exists session_assets_type_idx
  on public.session_assets (asset_type);

create index if not exists session_assets_uploaded_by_idx
  on public.session_assets (uploaded_by_profile_id);

create table if not exists public.assessment_forms (
  id uuid primary key default gen_random_uuid(),
  team_venue_season_id uuid not null references public.team_venue_seasons(id) on delete cascade,
  title text not null,
  description text,
  status public.assessment_form_status_type not null default 'draft',
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_forms_team_venue_season_idx
  on public.assessment_forms (team_venue_season_id);

create index if not exists assessment_forms_status_idx
  on public.assessment_forms (status);

drop trigger if exists set_assessment_forms_updated_at on public.assessment_forms;
create trigger set_assessment_forms_updated_at
before update on public.assessment_forms
for each row
execute function public.set_updated_at();

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_form_id uuid not null references public.assessment_forms(id) on delete cascade,
  position integer not null,
  question_text text not null,
  question_type public.assessment_question_type not null,
  required boolean not null default true,
  config_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_form_id, position)
);

create index if not exists assessment_questions_form_idx
  on public.assessment_questions (assessment_form_id);

drop trigger if exists set_assessment_questions_updated_at on public.assessment_questions;
create trigger set_assessment_questions_updated_at
before update on public.assessment_questions
for each row
execute function public.set_updated_at();

create table if not exists public.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_form_id uuid not null references public.assessment_forms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.assessment_submission_status_type not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_form_id, profile_id)
);

create index if not exists assessment_submissions_form_idx
  on public.assessment_submissions (assessment_form_id);

create index if not exists assessment_submissions_profile_idx
  on public.assessment_submissions (profile_id);

create index if not exists assessment_submissions_status_idx
  on public.assessment_submissions (status);

drop trigger if exists set_assessment_submissions_updated_at on public.assessment_submissions;
create trigger set_assessment_submissions_updated_at
before update on public.assessment_submissions
for each row
execute function public.set_updated_at();

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  numeric_value numeric(10,2),
  choice_value text,
  text_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index if not exists assessment_answers_submission_idx
  on public.assessment_answers (submission_id);

create index if not exists assessment_answers_question_idx
  on public.assessment_answers (question_id);

drop trigger if exists set_assessment_answers_updated_at on public.assessment_answers;
create trigger set_assessment_answers_updated_at
before update on public.assessment_answers
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.venues enable row level security;
alter table public.team_venue_seasons enable row level security;
alter table public.camps enable row level security;
alter table public.sessions enable row level security;
alter table public.session_reviews enable row level security;
alter table public.session_regatta_results enable row level security;
alter table public.session_setups enable row level security;
alter table public.session_assets enable row level security;
alter table public.assessment_forms enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_submissions enable row level security;
alter table public.assessment_answers enable row level security;
