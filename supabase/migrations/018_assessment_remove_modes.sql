-- 018_assessment_remove_modes.sql
-- Remove assessment wind modes and per-question filter mode dimension.

-- Drop mode tables.
drop table if exists public.assessment_template_question_wind_modes;
drop table if exists public.assessment_run_question_wind_modes;

-- Drop mode-specific functions (table drops remove dependent triggers).
drop function if exists public.validate_assessment_template_question_wind_modes();
drop function if exists public.validate_assessment_run_question_wind_modes();

-- Remove filter/mode columns from question/answer tables.
alter table if exists public.assessment_template_questions
  drop column if exists has_wind_filters;

alter table if exists public.assessment_run_questions
  drop column if exists has_wind_filters;

alter table if exists public.assessment_run_answers
  drop column if exists wind_mode;

-- Replace old mode-based unique indexes with one per-question unique answer index.
drop index if exists public.assessment_run_answers_unique_question_without_mode_idx;
drop index if exists public.assessment_run_answers_unique_question_with_mode_idx;

create unique index if not exists assessment_run_answers_unique_question_respondent_idx
  on public.assessment_run_answers (
    assessment_run_id,
    assessment_run_question_id,
    respondent_profile_id
  );

-- Replace answer validation trigger function without mode dependencies.
create or replace function public.validate_assessment_run_answer_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  question_run_id uuid;
  option_run_id uuid;
begin
  select arc.assessment_run_id
  into question_run_id
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
