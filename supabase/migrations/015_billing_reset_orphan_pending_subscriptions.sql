-- Reset orphan pending subscriptions created before PayPal approval.
-- A paid subscription must have a linked paypal_subscription_id.

update public.organization_subscriptions
set
  plan_tier = 'free'::public.plan_tier,
  billing_cycle = 'none'::public.billing_cycle,
  status = 'active'::public.subscription_status,
  paypal_plan_id = null,
  current_period_start_at = null,
  current_period_end_at = null,
  updated_at = now()
where
  plan_tier in ('pro', 'olympic')
  and status in ('approval_pending', 'approved')
  and (
    paypal_subscription_id is null
    or btrim(paypal_subscription_id) = ''
  );
