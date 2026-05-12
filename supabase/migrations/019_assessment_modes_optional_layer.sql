-- 019_assessment_modes_optional_layer.sql
-- Reintroduce optional category modes for assessment templates and runs.

create table if not exists public.assessment_template_modes (
  id uuid primary key default gen_random_uuid(),
  assessment_template_category_id uuid not null references public.assessment_template_categories(id) on delete cascade,
  name text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_template_category_id, position)
);

create index if not exists assessment_template_modes_category_idx
  on public.assessment_template_modes (assessment_template_category_id);

create table if not exists public.assessment_run_modes (
  id uuid primary key default gen_random_uuid(),
  assessment_run_category_id uuid not null references public.assessment_run_categories(id) on delete cascade,
  name text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_run_category_id, position)
);

create index if not exists assessment_run_modes_category_idx
  on public.assessment_run_modes (assessment_run_category_id);

alter table if exists public.assessment_template_questions
  add column if not exists assessment_template_mode_id uuid references public.assessment_template_modes(id) on delete cascade;

create index if not exists assessment_template_questions_mode_idx
  on public.assessment_template_questions (assessment_template_mode_id);

alter table if exists public.assessment_run_questions
  add column if not exists assessment_run_mode_id uuid references public.assessment_run_modes(id) on delete cascade;

create index if not exists assessment_run_questions_mode_idx
  on public.assessment_run_questions (assessment_run_mode_id);

drop trigger if exists set_assessment_template_modes_updated_at on public.assessment_template_modes;
create trigger set_assessment_template_modes_updated_at
before update on public.assessment_template_modes
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_run_modes_updated_at on public.assessment_run_modes;
create trigger set_assessment_run_modes_updated_at
before update on public.assessment_run_modes
for each row
execute function public.set_updated_at();

create or replace function public.team_id_for_assessment_template_mode(target_mode_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select at.team_id
  from public.assessment_template_modes atm
  join public.assessment_template_categories atc on atc.id = atm.assessment_template_category_id
  join public.assessment_templates at on at.id = atc.assessment_template_id
  where atm.id = target_mode_id
  limit 1;
$$;

create or replace function public.team_id_for_assessment_run_mode(target_mode_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ar.team_id
  from public.assessment_run_modes arm
  join public.assessment_run_categories arc on arc.id = arm.assessment_run_category_id
  join public.assessment_runs ar on ar.id = arc.assessment_run_id
  where arm.id = target_mode_id
  limit 1;
$$;

create or replace function public.validate_assessment_template_question_mode_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mode_category_id uuid;
  has_direct_questions boolean;
  has_mode_questions boolean;
  current_question_id uuid;
begin
  current_question_id := coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.assessment_template_mode_id is not null then
    select atm.assessment_template_category_id
    into mode_category_id
    from public.assessment_template_modes atm
    where atm.id = new.assessment_template_mode_id
    limit 1;

    if mode_category_id is null then
      raise exception 'Template mode % not found', new.assessment_template_mode_id;
    end if;

    if mode_category_id <> new.assessment_template_category_id then
      raise exception 'Template mode % does not belong to category %', new.assessment_template_mode_id, new.assessment_template_category_id;
    end if;
  end if;

  select exists (
    select 1
    from public.assessment_template_questions atq
    where atq.assessment_template_category_id = new.assessment_template_category_id
      and atq.id <> current_question_id
      and atq.assessment_template_mode_id is null
  )
  into has_direct_questions;

  select exists (
    select 1
    from public.assessment_template_questions atq
    where atq.assessment_template_category_id = new.assessment_template_category_id
      and atq.id <> current_question_id
      and atq.assessment_template_mode_id is not null
  )
  into has_mode_questions;

  if new.assessment_template_mode_id is null and has_mode_questions then
    raise exception 'Template category % already uses modes and cannot mix direct items', new.assessment_template_category_id;
  end if;

  if new.assessment_template_mode_id is not null and has_direct_questions then
    raise exception 'Template category % already has direct items and cannot mix mode items', new.assessment_template_category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_template_question_mode_scope on public.assessment_template_questions;
create trigger validate_assessment_template_question_mode_scope
before insert or update on public.assessment_template_questions
for each row
execute function public.validate_assessment_template_question_mode_scope();

create or replace function public.validate_assessment_run_question_mode_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mode_category_id uuid;
  has_direct_questions boolean;
  has_mode_questions boolean;
  current_question_id uuid;
begin
  current_question_id := coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.assessment_run_mode_id is not null then
    select arm.assessment_run_category_id
    into mode_category_id
    from public.assessment_run_modes arm
    where arm.id = new.assessment_run_mode_id
    limit 1;

    if mode_category_id is null then
      raise exception 'Run mode % not found', new.assessment_run_mode_id;
    end if;

    if mode_category_id <> new.assessment_run_category_id then
      raise exception 'Run mode % does not belong to category %', new.assessment_run_mode_id, new.assessment_run_category_id;
    end if;
  end if;

  select exists (
    select 1
    from public.assessment_run_questions arq
    where arq.assessment_run_category_id = new.assessment_run_category_id
      and arq.id <> current_question_id
      and arq.assessment_run_mode_id is null
  )
  into has_direct_questions;

  select exists (
    select 1
    from public.assessment_run_questions arq
    where arq.assessment_run_category_id = new.assessment_run_category_id
      and arq.id <> current_question_id
      and arq.assessment_run_mode_id is not null
  )
  into has_mode_questions;

  if new.assessment_run_mode_id is null and has_mode_questions then
    raise exception 'Run category % already uses modes and cannot mix direct items', new.assessment_run_category_id;
  end if;

  if new.assessment_run_mode_id is not null and has_direct_questions then
    raise exception 'Run category % already has direct items and cannot mix mode items', new.assessment_run_category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_run_question_mode_scope on public.assessment_run_questions;
create trigger validate_assessment_run_question_mode_scope
before insert or update on public.assessment_run_questions
for each row
execute function public.validate_assessment_run_question_mode_scope();

alter table public.assessment_template_modes enable row level security;
alter table public.assessment_run_modes enable row level security;

drop policy if exists assessment_template_modes_select_team_scope on public.assessment_template_modes;
create policy assessment_template_modes_select_team_scope
on public.assessment_template_modes
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_modes_insert_manage_team_structure on public.assessment_template_modes;
create policy assessment_template_modes_insert_manage_team_structure
on public.assessment_template_modes
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_modes_update_manage_team_structure on public.assessment_template_modes;
create policy assessment_template_modes_update_manage_team_structure
on public.assessment_template_modes
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_template_modes_delete_manage_team_structure on public.assessment_template_modes;
create policy assessment_template_modes_delete_manage_team_structure
on public.assessment_template_modes
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_template_category(assessment_template_category_id))
);

drop policy if exists assessment_run_modes_select_team_scope on public.assessment_run_modes;
create policy assessment_run_modes_select_team_scope
on public.assessment_run_modes
for select
using (
  public.can_read_team_scope(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_modes_insert_manage_team_structure on public.assessment_run_modes;
create policy assessment_run_modes_insert_manage_team_structure
on public.assessment_run_modes
for insert
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_modes_update_manage_team_structure on public.assessment_run_modes;
create policy assessment_run_modes_update_manage_team_structure
on public.assessment_run_modes
for update
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
)
with check (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);

drop policy if exists assessment_run_modes_delete_manage_team_structure on public.assessment_run_modes;
create policy assessment_run_modes_delete_manage_team_structure
on public.assessment_run_modes
for delete
using (
  public.can_manage_team_structure(public.team_id_for_assessment_run_category(assessment_run_category_id))
);
