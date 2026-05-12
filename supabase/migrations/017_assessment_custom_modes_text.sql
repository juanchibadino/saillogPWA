-- 017_assessment_custom_modes_text.sql
-- Switch assessment wind modes from enum values to custom text values.

alter table public.assessment_template_question_wind_modes
  alter column wind_mode type text
  using wind_mode::text;

alter table public.assessment_run_question_wind_modes
  alter column wind_mode type text
  using wind_mode::text;

alter table public.assessment_run_answers
  alter column wind_mode type text
  using wind_mode::text;

drop type if exists public.assessment_wind_mode_type;
