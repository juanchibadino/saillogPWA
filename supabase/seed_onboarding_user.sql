-- Sailog hosted-safe onboarding reset for one existing user.
-- This script does NOT write to auth.users/auth.identities.
--
-- Use this when your hosted SQL role cannot modify auth tables.
-- Prerequisite:
--   - The auth user already exists (created via app sign-up or Auth > Users in dashboard).
--
-- Target user:
--   email: onboarding.test@sailog.test

do $$
declare
  v_profile_id uuid;
begin
  select p.id
  into v_profile_id
  from public.profiles p
  where lower(p.email) = lower('onboarding.test@sailog.test')
  limit 1;

  if v_profile_id is null then
    raise exception
      'Profile not found for onboarding.test@sailog.test. Create the user first in Auth, then run this script.';
  end if;
end $$;

with onboarding_profile as (
  select p.id
  from public.profiles p
  where lower(p.email) = lower('onboarding.test@sailog.test')
  limit 1
)
delete from public.team_memberships tm
using onboarding_profile p
where tm.profile_id = p.id;

with onboarding_profile as (
  select p.id
  from public.profiles p
  where lower(p.email) = lower('onboarding.test@sailog.test')
  limit 1
)
delete from public.organization_memberships om
using onboarding_profile p
where om.profile_id = p.id;

update public.profiles p
set
  is_active = true,
  is_profile_complete = false,
  profile_completed_at = null,
  onboarding_stage = 1,
  onboarding_draft = '{}'::jsonb,
  updated_at = timezone('utc', now())
where lower(p.email) = lower('onboarding.test@sailog.test');
