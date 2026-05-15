-- 025_onboarding_profile_progress.sql
-- Persist onboarding draft progress and explicit profile-completion status.

alter table public.profiles
  add column if not exists is_profile_complete boolean not null default false,
  add column if not exists profile_completed_at timestamptz,
  add column if not exists onboarding_stage integer not null default 0,
  add column if not exists onboarding_draft jsonb not null default '{}'::jsonb;

update public.profiles
set onboarding_stage = 0
where onboarding_stage < 0 or onboarding_stage > 8;

alter table public.profiles
  drop constraint if exists profiles_onboarding_stage_range_check;

alter table public.profiles
  add constraint profiles_onboarding_stage_range_check
  check (onboarding_stage >= 0 and onboarding_stage <= 8);
