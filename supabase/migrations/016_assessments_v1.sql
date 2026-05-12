-- 016_assessments_v1.sql
-- Team-scoped reusable assessment templates + venue/camp assessment runs.

do $$
begin
  create type public.assessment_run_status_type as enum ('draft', 'published', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.assessment_wind_mode_type as enum (
    'single_trap',
    'double_trap',
    'full_power',
    'depower'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_templates_team_idx
  on public.assessment_templates (team_id);

create index if not exists assessment_templates_team_active_idx
  on public.assessment_templates (team_id, is_active);

create table if not exists public.assessment_template_scale_options (
  id uuid primary key default gen_random_uuid(),
  assessment_template_id uuid not null references public.assessment_templates(id) on delete cascade,
  label text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_template_id, position)
);

create index if not exists assessment_template_scale_options_template_idx
  on public.assessment_template_scale_options (assessment_template_id);

create table if not exists public.assessment_template_categories (
  id uuid primary key default gen_random_uuid(),
  assessment_template_id uuid not null references public.assessment_templates(id) on delete cascade,
  name text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_template_id, position)
);

create index if not exists assessment_template_categories_template_idx
  on public.assessment_template_categories (assessment_template_id);

create table if not exists public.assessment_template_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_template_category_id uuid not null references public.assessment_template_categories(id) on delete cascade,
  prompt text not null,
  position integer not null check (position > 0),
  has_wind_filters boolean not null default false,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_template_category_id, position)
);

create index if not exists assessment_template_questions_category_idx
  on public.assessment_template_questions (assessment_template_category_id);

create table if not exists public.assessment_template_question_wind_modes (
  id uuid primary key default gen_random_uuid(),
  assessment_template_question_id uuid not null references public.assessment_template_questions(id) on delete cascade,
  wind_mode public.assessment_wind_mode_type not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (assessment_template_question_id, wind_mode),
  unique (assessment_template_question_id, position)
);

create index if not exists assessment_template_question_wind_modes_question_idx
  on public.assessment_template_question_wind_modes (assessment_template_question_id);

create table if not exists public.assessment_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_venue_id uuid not null references public.team_venues(id) on delete cascade,
  assessment_template_id uuid references public.assessment_templates(id) on delete set null,
  name text not null,
  description text,
  status public.assessment_run_status_type not null default 'draft',
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_runs_team_status_idx
  on public.assessment_runs (team_id, status);

create index if not exists assessment_runs_team_venue_status_idx
  on public.assessment_runs (team_venue_id, status);

create index if not exists assessment_runs_template_idx
  on public.assessment_runs (assessment_template_id);

create table if not exists public.assessment_run_scale_options (
  id uuid primary key default gen_random_uuid(),
  assessment_run_id uuid not null references public.assessment_runs(id) on delete cascade,
  label text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_run_id, position)
);

create index if not exists assessment_run_scale_options_run_idx
  on public.assessment_run_scale_options (assessment_run_id);

create table if not exists public.assessment_run_categories (
  id uuid primary key default gen_random_uuid(),
  assessment_run_id uuid not null references public.assessment_runs(id) on delete cascade,
  name text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_run_id, position)
);

create index if not exists assessment_run_categories_run_idx
  on public.assessment_run_categories (assessment_run_id);

create table if not exists public.assessment_run_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_run_category_id uuid not null references public.assessment_run_categories(id) on delete cascade,
  prompt text not null,
  position integer not null check (position > 0),
  has_wind_filters boolean not null default false,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_run_category_id, position)
);

create index if not exists assessment_run_questions_category_idx
  on public.assessment_run_questions (assessment_run_category_id);

create table if not exists public.assessment_run_question_wind_modes (
  id uuid primary key default gen_random_uuid(),
  assessment_run_question_id uuid not null references public.assessment_run_questions(id) on delete cascade,
  wind_mode public.assessment_wind_mode_type not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (assessment_run_question_id, wind_mode),
  unique (assessment_run_question_id, position)
);

create index if not exists assessment_run_question_wind_modes_question_idx
  on public.assessment_run_question_wind_modes (assessment_run_question_id);

create table if not exists public.assessment_run_camps (
  id uuid primary key default gen_random_uuid(),
  assessment_run_id uuid not null references public.assessment_runs(id) on delete cascade,
  camp_id uuid not null references public.camps(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assessment_run_id, camp_id)
);

create index if not exists assessment_run_camps_run_idx
  on public.assessment_run_camps (assessment_run_id);

create index if not exists assessment_run_camps_camp_idx
  on public.assessment_run_camps (camp_id);

create table if not exists public.assessment_run_respondents (
  id uuid primary key default gen_random_uuid(),
  assessment_run_id uuid not null references public.assessment_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_run_id, profile_id)
);

create index if not exists assessment_run_respondents_run_idx
  on public.assessment_run_respondents (assessment_run_id);

create index if not exists assessment_run_respondents_run_responded_idx
  on public.assessment_run_respondents (assessment_run_id, responded_at);

create table if not exists public.assessment_run_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_run_id uuid not null references public.assessment_runs(id) on delete cascade,
  assessment_run_question_id uuid not null references public.assessment_run_questions(id) on delete cascade,
  respondent_profile_id uuid not null references public.profiles(id) on delete cascade,
  assessment_run_scale_option_id uuid not null references public.assessment_run_scale_options(id) on delete cascade,
  wind_mode public.assessment_wind_mode_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assessment_run_answers_unique_question_without_mode_idx
  on public.assessment_run_answers (
    assessment_run_id,
    assessment_run_question_id,
    respondent_profile_id
  )
  where wind_mode is null;

create unique index if not exists assessment_run_answers_unique_question_with_mode_idx
  on public.assessment_run_answers (
    assessment_run_id,
    assessment_run_question_id,
    respondent_profile_id,
    wind_mode
  )
  where wind_mode is not null;

create index if not exists assessment_run_answers_run_respondent_idx
  on public.assessment_run_answers (assessment_run_id, respondent_profile_id);

create index if not exists assessment_run_answers_run_question_idx
  on public.assessment_run_answers (assessment_run_id, assessment_run_question_id);

-- Updated at triggers.
drop trigger if exists set_assessment_templates_updated_at on public.assessment_templates;
create trigger set_assessment_templates_updated_at
before update on public.assessment_templates
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_template_scale_options_updated_at on public.assessment_template_scale_options;
create trigger set_assessment_template_scale_options_updated_at
before update on public.assessment_template_scale_options
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_template_categories_updated_at on public.assessment_template_categories;
create trigger set_assessment_template_categories_updated_at
before update on public.assessment_template_categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_template_questions_updated_at on public.assessment_template_questions;
create trigger set_assessment_template_questions_updated_at
before update on public.assessment_template_questions
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_runs_updated_at on public.assessment_runs;
create trigger set_assessment_runs_updated_at
before update on public.assessment_runs
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_run_scale_options_updated_at on public.assessment_run_scale_options;
create trigger set_assessment_run_scale_options_updated_at
before update on public.assessment_run_scale_options
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_run_categories_updated_at on public.assessment_run_categories;
create trigger set_assessment_run_categories_updated_at
before update on public.assessment_run_categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_run_questions_updated_at on public.assessment_run_questions;
create trigger set_assessment_run_questions_updated_at
before update on public.assessment_run_questions
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_run_answers_updated_at on public.assessment_run_answers;
create trigger set_assessment_run_answers_updated_at
before update on public.assessment_run_answers
for each row
execute function public.set_updated_at();

-- Helper functions.
create or replace function public.team_id_for_assessment_template(target_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select at.team_id
  from public.assessment_templates at
  where at.id = target_template_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_template_category(target_category_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select at.team_id
  from public.assessment_template_categories atc
  join public.assessment_templates at on at.id = atc.assessment_template_id
  where atc.id = target_category_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_template_question(target_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select at.team_id
  from public.assessment_template_questions atq
  join public.assessment_template_categories atc on atc.id = atq.assessment_template_category_id
  join public.assessment_templates at on at.id = atc.assessment_template_id
  where atq.id = target_question_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run(target_run_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_runs ar
  where ar.id = target_run_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_category(target_category_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_categories arc
  join public.assessment_runs ar on ar.id = arc.assessment_run_id
  where arc.id = target_category_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_question(target_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_questions arq
  join public.assessment_run_categories arc on arc.id = arq.assessment_run_category_id
  join public.assessment_runs ar on ar.id = arc.assessment_run_id
  where arq.id = target_question_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_scale_option(target_option_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_scale_options arso
  join public.assessment_runs ar on ar.id = arso.assessment_run_id
  where arso.id = target_option_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_camp(target_run_camp_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_camps arc
  join public.assessment_runs ar on ar.id = arc.assessment_run_id
  where arc.id = target_run_camp_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_respondent(target_respondent_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_respondents arr
  join public.assessment_runs ar on ar.id = arr.assessment_run_id
  where arr.id = target_respondent_id
  limit 1;
$$;

-- Scope/integrity validation triggers.
create or replace function public.validate_assessment_run_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_team_id uuid;
  template_team_id uuid;
begin
  select tv.team_id
  into linked_team_id
  from public.team_venues tv
  where tv.id = new.team_venue_id
  limit 1;

  if linked_team_id is null then
    raise exception 'Team venue % not found for assessment run', new.team_venue_id;
  end if;

  if linked_team_id <> new.team_id then
    raise exception 'Assessment run team % must match team venue team %', new.team_id, linked_team_id;
  end if;

  if new.assessment_template_id is not null then
    select at.team_id
    into template_team_id
    from public.assessment_templates at
    where at.id = new.assessment_template_id
    limit 1;

    if template_team_id is null then
      raise exception 'Assessment template % not found', new.assessment_template_id;
    end if;

    if template_team_id <> new.team_id then
      raise exception 'Assessment template team % must match run team %', template_team_id, new.team_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_run_scope on public.assessment_runs;
create trigger validate_assessment_run_scope
before insert or update on public.assessment_runs
for each row
execute function public.validate_assessment_run_scope();

create or replace function public.validate_assessment_template_question_wind_modes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_wind_filters_value boolean;
begin
  select atq.has_wind_filters
  into has_wind_filters_value
  from public.assessment_template_questions atq
  where atq.id = new.assessment_template_question_id
  limit 1;

  if has_wind_filters_value is distinct from true then
    raise exception 'Template question % does not accept wind filters', new.assessment_template_question_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_template_question_wind_modes on public.assessment_template_question_wind_modes;
create trigger validate_assessment_template_question_wind_modes
before insert or update on public.assessment_template_question_wind_modes
for each row
execute function public.validate_assessment_template_question_wind_modes();

create or replace function public.validate_assessment_run_question_wind_modes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_wind_filters_value boolean;
begin
  select arq.has_wind_filters
  into has_wind_filters_value
  from public.assessment_run_questions arq
  where arq.id = new.assessment_run_question_id
  limit 1;

  if has_wind_filters_value is distinct from true then
    raise exception 'Run question % does not accept wind filters', new.assessment_run_question_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_run_question_wind_modes on public.assessment_run_question_wind_modes;
create trigger validate_assessment_run_question_wind_modes
before insert or update on public.assessment_run_question_wind_modes
for each row
execute function public.validate_assessment_run_question_wind_modes();

create or replace function public.validate_assessment_run_camp_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  run_team_venue_id uuid;
  camp_team_venue_id uuid;
begin
  select ar.team_venue_id
  into run_team_venue_id
  from public.assessment_runs ar
  where ar.id = new.assessment_run_id
  limit 1;

  select c.team_venue_id
  into camp_team_venue_id
  from public.camps c
  where c.id = new.camp_id
  limit 1;

  if run_team_venue_id is null then
    raise exception 'Assessment run % not found', new.assessment_run_id;
  end if;

  if camp_team_venue_id is null then
    raise exception 'Camp % not found', new.camp_id;
  end if;

  if run_team_venue_id <> camp_team_venue_id then
    raise exception 'Camp % does not belong to team venue % of run %', new.camp_id, run_team_venue_id, new.assessment_run_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_run_camp_scope on public.assessment_run_camps;
create trigger validate_assessment_run_camp_scope
before insert or update on public.assessment_run_camps
for each row
execute function public.validate_assessment_run_camp_scope();

create or replace function public.validate_assessment_run_answer_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  question_run_id uuid;
  option_run_id uuid;
  question_has_wind_filters boolean;
  mode_exists boolean;
begin
  select arc.assessment_run_id, arq.has_wind_filters
  into question_run_id, question_has_wind_filters
  from public.assessment_run_questions arq
  join public.assessment_run_categories arc on arc.id = arq.assessment_run_category_id
  where arq.id = new.assessment_run_question_id
  limit 1;

  if question_run_id is null then
    raise exception 'Run question % not found', new.assessment_run_question_id;
  end if;

  if question_run_id <> new.assessment_run_id then
    raise exception 'Run question % does not belong to run %', new.assessment_run_question_id, new.assessment_run_id;
  end if;

  select arso.assessment_run_id
  into option_run_id
  from public.assessment_run_scale_options arso
  where arso.id = new.assessment_run_scale_option_id
  limit 1;

  if option_run_id is null then
    raise exception 'Run scale option % not found', new.assessment_run_scale_option_id;
  end if;

  if option_run_id <> new.assessment_run_id then
    raise exception 'Run scale option % does not belong to run %', new.assessment_run_scale_option_id, new.assessment_run_id;
  end if;

  if question_has_wind_filters then
    if new.wind_mode is null then
      raise exception 'Filtered run question % requires wind mode', new.assessment_run_question_id;
    end if;

    select exists (
      select 1
      from public.assessment_run_question_wind_modes arqwm
      where arqwm.assessment_run_question_id = new.assessment_run_question_id
        and arqwm.wind_mode = new.wind_mode
    )
    into mode_exists;

    if mode_exists is distinct from true then
      raise exception 'Wind mode % is not configured for run question %', new.wind_mode, new.assessment_run_question_id;
    end if;
  else
    if new.wind_mode is not null then
      raise exception 'Run question % does not accept wind mode answers', new.assessment_run_question_id;
    end if;
  end if;

  if not exists (
    select 1
    from public.assessment_run_respondents arr
    where arr.assessment_run_id = new.assessment_run_id
      and arr.profile_id = new.respondent_profile_id
  ) then
    raise exception 'Respondent % is not assigned to run %', new.respondent_profile_id, new.assessment_run_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_run_answer_scope on public.assessment_run_answers;
create trigger validate_assessment_run_answer_scope
before insert or update on public.assessment_run_answers
for each row
execute function public.validate_assessment_run_answer_scope();

-- RLS.
alter table public.assessment_templates enable row level security;
alter table public.assessment_template_scale_options enable row level security;
alter table public.assessment_template_categories enable row level security;
alter table public.assessment_template_questions enable row level security;
alter table public.assessment_template_question_wind_modes enable row level security;
alter table public.assessment_runs enable row level security;
alter table public.assessment_run_scale_options enable row level security;
alter table public.assessment_run_categories enable row level security;
alter table public.assessment_run_questions enable row level security;
alter table public.assessment_run_question_wind_modes enable row level security;
alter table public.assessment_run_camps enable row level security;
alter table public.assessment_run_respondents enable row level security;
alter table public.assessment_run_answers enable row level security;

-- Templates policies.
drop policy if exists assessment_templates_select_team_scope on public.assessment_templates;
create policy assessment_templates_select_team_scope
on public.assessment_templates
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists assessment_templates_insert_manage_team_structure on public.assessment_templates;
create policy assessment_templates_insert_manage_team_structure
on public.assessment_templates
for insert
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists assessment_templates_update_manage_team_structure on public.assessment_templates;
create policy assessment_templates_update_manage_team_structure
on public.assessment_templates
for update
using (
  public.can_manage_team_structure(team_id)
)
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists assessment_templates_delete_manage_team_structure on public.assessment_templates;
create policy assessment_templates_delete_manage_team_structure
on public.assessment_templates
for delete
using (
  public.can_manage_team_structure(team_id)
);

-- Template child policies.
drop policy if exists assessment_template_scale_options_select_team_scope on public.assessment_template_scale_options;
create policy assessment_template_scale_options_select_team_scope
on public.assessment_template_scale_options
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_scale_options_insert_manage_team_structure on public.assessment_template_scale_options;
create policy assessment_template_scale_options_insert_manage_team_structure
on public.assessment_template_scale_options
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_scale_options_update_manage_team_structure on public.assessment_template_scale_options;
create policy assessment_template_scale_options_update_manage_team_structure
on public.assessment_template_scale_options
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_scale_options_delete_manage_team_structure on public.assessment_template_scale_options;
create policy assessment_template_scale_options_delete_manage_team_structure
on public.assessment_template_scale_options
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_categories_select_team_scope on public.assessment_template_categories;
create policy assessment_template_categories_select_team_scope
on public.assessment_template_categories
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_categories_insert_manage_team_structure on public.assessment_template_categories;
create policy assessment_template_categories_insert_manage_team_structure
on public.assessment_template_categories
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_categories_update_manage_team_structure on public.assessment_template_categories;
create policy assessment_template_categories_update_manage_team_structure
on public.assessment_template_categories
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_categories_delete_manage_team_structure on public.assessment_template_categories;
create policy assessment_template_categories_delete_manage_team_structure
on public.assessment_template_categories
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template(assessment_template_id))
);

drop policy if exists assessment_template_questions_select_team_scope on public.assessment_template_questions;
create policy assessment_template_questions_select_team_scope
on public.assessment_template_questions
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_questions_insert_manage_team_structure on public.assessment_template_questions;
create policy assessment_template_questions_insert_manage_team_structure
on public.assessment_template_questions
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_questions_update_manage_team_structure on public.assessment_template_questions;
create policy assessment_template_questions_update_manage_team_structure
on public.assessment_template_questions
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_questions_delete_manage_team_structure on public.assessment_template_questions;
create policy assessment_template_questions_delete_manage_team_structure
on public.assessment_template_questions
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_question_wind_modes_select_team_scope on public.assessment_template_question_wind_modes;
create policy assessment_template_question_wind_modes_select_team_scope
on public.assessment_template_question_wind_modes
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_template_question(assessment_template_question_id))
);

drop policy if exists assessment_template_question_wind_modes_insert_manage_team_structure on public.assessment_template_question_wind_modes;
create policy assessment_template_question_wind_modes_insert_manage_team_structure
on public.assessment_template_question_wind_modes
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template_question(assessment_template_question_id))
);

drop policy if exists assessment_template_question_wind_modes_delete_manage_team_structure on public.assessment_template_question_wind_modes;
create policy assessment_template_question_wind_modes_delete_manage_team_structure
on public.assessment_template_question_wind_modes
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template_question(assessment_template_question_id))
);

-- Runs policies.
drop policy if exists assessment_runs_select_team_scope on public.assessment_runs;
create policy assessment_runs_select_team_scope
on public.assessment_runs
for select
using (
  public.can_read_team_scope(team_id)
);

drop policy if exists assessment_runs_insert_manage_team_structure on public.assessment_runs;
create policy assessment_runs_insert_manage_team_structure
on public.assessment_runs
for insert
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists assessment_runs_update_manage_team_structure on public.assessment_runs;
create policy assessment_runs_update_manage_team_structure
on public.assessment_runs
for update
using (
  public.can_manage_team_structure(team_id)
)
with check (
  public.can_manage_team_structure(team_id)
);

drop policy if exists assessment_runs_delete_manage_team_structure on public.assessment_runs;
create policy assessment_runs_delete_manage_team_structure
on public.assessment_runs
for delete
using (
  public.can_manage_team_structure(team_id)
);

-- Run child policies.
drop policy if exists assessment_run_scale_options_select_team_scope on public.assessment_run_scale_options;
create policy assessment_run_scale_options_select_team_scope
on public.assessment_run_scale_options
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_scale_options_insert_manage_team_structure on public.assessment_run_scale_options;
create policy assessment_run_scale_options_insert_manage_team_structure
on public.assessment_run_scale_options
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_scale_options_update_manage_team_structure on public.assessment_run_scale_options;
create policy assessment_run_scale_options_update_manage_team_structure
on public.assessment_run_scale_options
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_scale_options_delete_manage_team_structure on public.assessment_run_scale_options;
create policy assessment_run_scale_options_delete_manage_team_structure
on public.assessment_run_scale_options
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_categories_select_team_scope on public.assessment_run_categories;
create policy assessment_run_categories_select_team_scope
on public.assessment_run_categories
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_categories_insert_manage_team_structure on public.assessment_run_categories;
create policy assessment_run_categories_insert_manage_team_structure
on public.assessment_run_categories
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_categories_update_manage_team_structure on public.assessment_run_categories;
create policy assessment_run_categories_update_manage_team_structure
on public.assessment_run_categories
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_categories_delete_manage_team_structure on public.assessment_run_categories;
create policy assessment_run_categories_delete_manage_team_structure
on public.assessment_run_categories
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_questions_select_team_scope on public.assessment_run_questions;
create policy assessment_run_questions_select_team_scope
on public.assessment_run_questions
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_questions_insert_manage_team_structure on public.assessment_run_questions;
create policy assessment_run_questions_insert_manage_team_structure
on public.assessment_run_questions
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_questions_update_manage_team_structure on public.assessment_run_questions;
create policy assessment_run_questions_update_manage_team_structure
on public.assessment_run_questions
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_questions_delete_manage_team_structure on public.assessment_run_questions;
create policy assessment_run_questions_delete_manage_team_structure
on public.assessment_run_questions
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_question_wind_modes_select_team_scope on public.assessment_run_question_wind_modes;
create policy assessment_run_question_wind_modes_select_team_scope
on public.assessment_run_question_wind_modes
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run_question(assessment_run_question_id))
);

drop policy if exists assessment_run_question_wind_modes_insert_manage_team_structure on public.assessment_run_question_wind_modes;
create policy assessment_run_question_wind_modes_insert_manage_team_structure
on public.assessment_run_question_wind_modes
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run_question(assessment_run_question_id))
);

drop policy if exists assessment_run_question_wind_modes_delete_manage_team_structure on public.assessment_run_question_wind_modes;
create policy assessment_run_question_wind_modes_delete_manage_team_structure
on public.assessment_run_question_wind_modes
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run_question(assessment_run_question_id))
);

drop policy if exists assessment_run_camps_select_team_scope on public.assessment_run_camps;
create policy assessment_run_camps_select_team_scope
on public.assessment_run_camps
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_camps_insert_manage_team_structure on public.assessment_run_camps;
create policy assessment_run_camps_insert_manage_team_structure
on public.assessment_run_camps
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_camps_delete_manage_team_structure on public.assessment_run_camps;
create policy assessment_run_camps_delete_manage_team_structure
on public.assessment_run_camps
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_respondents_select_team_scope on public.assessment_run_respondents;
create policy assessment_run_respondents_select_team_scope
on public.assessment_run_respondents
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_respondents_insert_manage_team_structure on public.assessment_run_respondents;
create policy assessment_run_respondents_insert_manage_team_structure
on public.assessment_run_respondents
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_respondents_update_manage_team_structure on public.assessment_run_respondents;
create policy assessment_run_respondents_update_manage_team_structure
on public.assessment_run_respondents
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_respondents_delete_manage_team_structure on public.assessment_run_respondents;
create policy assessment_run_respondents_delete_manage_team_structure
on public.assessment_run_respondents
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_answers_select_scope on public.assessment_run_answers;
create policy assessment_run_answers_select_scope
on public.assessment_run_answers
for select
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
  or respondent_profile_id = auth.uid()
);

drop policy if exists assessment_run_answers_insert_scope on public.assessment_run_answers;
create policy assessment_run_answers_insert_scope
on public.assessment_run_answers
for insert
with check (
  (
    respondent_profile_id = auth.uid()
    and exists (
      select 1
      from public.assessment_runs ar
      where ar.id = assessment_run_answers.assessment_run_id
        and ar.status = 'published'
    )
    and exists (
      select 1
      from public.assessment_run_respondents arr
      where arr.assessment_run_id = assessment_run_answers.assessment_run_id
        and arr.profile_id = assessment_run_answers.respondent_profile_id
    )
    and exists (
      select 1
      from public.assessment_runs ar
      join public.team_memberships tm on tm.team_id = ar.team_id
      where ar.id = assessment_run_answers.assessment_run_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and tm.role = 'crew'
    )
  )
  or public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_answers_update_scope on public.assessment_run_answers;
create policy assessment_run_answers_update_scope
on public.assessment_run_answers
for update
using (
  (
    respondent_profile_id = auth.uid()
    and exists (
      select 1
      from public.assessment_runs ar
      where ar.id = assessment_run_answers.assessment_run_id
        and ar.status = 'published'
    )
    and exists (
      select 1
      from public.assessment_runs ar
      join public.team_memberships tm on tm.team_id = ar.team_id
      where ar.id = assessment_run_answers.assessment_run_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and tm.role = 'crew'
    )
  )
  or public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
)
with check (
  (
    respondent_profile_id = auth.uid()
    and exists (
      select 1
      from public.assessment_runs ar
      where ar.id = assessment_run_answers.assessment_run_id
        and ar.status = 'published'
    )
    and exists (
      select 1
      from public.assessment_runs ar
      join public.team_memberships tm on tm.team_id = ar.team_id
      where ar.id = assessment_run_answers.assessment_run_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and tm.role = 'crew'
    )
  )
  or public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);

drop policy if exists assessment_run_answers_delete_scope on public.assessment_run_answers;
create policy assessment_run_answers_delete_scope
on public.assessment_run_answers
for delete
using (
  (
    respondent_profile_id = auth.uid()
    and exists (
      select 1
      from public.assessment_runs ar
      where ar.id = assessment_run_answers.assessment_run_id
        and ar.status = 'published'
    )
    and exists (
      select 1
      from public.assessment_runs ar
      join public.team_memberships tm on tm.team_id = ar.team_id
      where ar.id = assessment_run_answers.assessment_run_id
        and tm.profile_id = auth.uid()
        and tm.is_active
        and tm.role = 'crew'
    )
  )
  or public.can_manage_team_structure(public.team_id_for_assessment_run(assessment_run_id))
);
