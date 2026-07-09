-- 033_test_organization_pro_subscription.sql
-- Keep the seeded Test Organization on Pro so Test Team can exercise all flows.

insert into public.organization_subscriptions (
  organization_id,
  plan_tier,
  billing_cycle,
  status,
  paypal_subscription_id,
  paypal_plan_id,
  current_period_start_at,
  current_period_end_at,
  created_by_profile_id
)
select
  o.id,
  'pro'::public.plan_tier,
  'yearly'::public.billing_cycle,
  'active'::public.subscription_status,
  null,
  null,
  timezone('utc', now()),
  timezone('utc', now()) + interval '1 year',
  null
from public.organizations o
where o.slug = 'test-organization'
   or lower(o.name) = lower('Test Organization')
on conflict (organization_id) do update
set
  plan_tier = 'pro'::public.plan_tier,
  billing_cycle = 'yearly'::public.billing_cycle,
  status = 'active'::public.subscription_status,
  paypal_subscription_id = null,
  paypal_plan_id = null,
  current_period_start_at = timezone('utc', now()),
  current_period_end_at = timezone('utc', now()) + interval '1 year',
  updated_at = timezone('utc', now());
