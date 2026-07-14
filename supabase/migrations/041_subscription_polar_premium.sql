-- 041_subscription_polar_premium.sql
-- Rename the manual top tier to Premium and add Polar subscription fields.

do $$
begin
  alter type public.plan_tier rename value 'olympic' to 'premium';
exception
  when duplicate_object then null;
  when invalid_parameter_value then null;
end $$;

alter table public.organization_subscriptions
  add column if not exists polar_customer_id text,
  add column if not exists polar_subscription_id text,
  add column if not exists polar_product_id text,
  add column if not exists polar_checkout_id text,
  add column if not exists polar_status text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists organization_subscriptions_polar_customer_id_key
  on public.organization_subscriptions (polar_customer_id)
  where polar_customer_id is not null;

create unique index if not exists organization_subscriptions_polar_subscription_id_key
  on public.organization_subscriptions (polar_subscription_id)
  where polar_subscription_id is not null;

create index if not exists organization_subscriptions_polar_product_id_idx
  on public.organization_subscriptions (polar_product_id)
  where polar_product_id is not null;

create table if not exists public.polar_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  resource_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists polar_webhook_events_event_type_idx
  on public.polar_webhook_events (event_type);

create index if not exists polar_webhook_events_org_idx
  on public.polar_webhook_events (organization_id);

create index if not exists polar_webhook_events_resource_idx
  on public.polar_webhook_events (resource_id);

drop trigger if exists set_polar_webhook_events_updated_at on public.polar_webhook_events;
create trigger set_polar_webhook_events_updated_at
before update on public.polar_webhook_events
for each row
execute function public.set_updated_at();

alter table public.polar_webhook_events enable row level security;

drop policy if exists polar_webhook_events_select_chain on public.polar_webhook_events;
create policy polar_webhook_events_select_chain
on public.polar_webhook_events
for select
using (
  public.is_super_admin()
  or (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
);

insert into public.organization_subscriptions (
  organization_id,
  plan_tier,
  billing_cycle,
  status,
  paypal_subscription_id,
  paypal_plan_id,
  polar_customer_id,
  polar_subscription_id,
  polar_product_id,
  polar_checkout_id,
  polar_status,
  current_period_start_at,
  current_period_end_at,
  created_by_profile_id
)
select
  o.id,
  case
    when o.slug = 'test-organization'
      or lower(o.name) = lower('Test Organization')
      then 'free'::public.plan_tier
    else 'pro'::public.plan_tier
  end,
  case
    when o.slug = 'test-organization'
      or lower(o.name) = lower('Test Organization')
      then 'none'::public.billing_cycle
    else 'monthly'::public.billing_cycle
  end,
  'active'::public.subscription_status,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  case
    when o.slug = 'test-organization'
      or lower(o.name) = lower('Test Organization')
      then null
    else timezone('utc', now())
  end,
  case
    when o.slug = 'test-organization'
      or lower(o.name) = lower('Test Organization')
      then null
    else timezone('utc', now()) + interval '1 month'
  end,
  null
from public.organizations o
where o.slug in ('america-one-racing', 'enard-argentina', 'test-organization')
   or lower(o.name) in (
    lower('America One Racing'),
    lower('ENARD Argentina'),
    lower('Test Organization')
   )
on conflict (organization_id) do update
set
  plan_tier = excluded.plan_tier,
  billing_cycle = excluded.billing_cycle,
  status = 'active'::public.subscription_status,
  paypal_subscription_id = null,
  paypal_plan_id = null,
  polar_customer_id = null,
  polar_subscription_id = null,
  polar_product_id = null,
  polar_checkout_id = null,
  polar_status = null,
  current_period_start_at = excluded.current_period_start_at,
  current_period_end_at = excluded.current_period_end_at,
  cancelled_at = null,
  cancel_at_period_end = false,
  updated_at = timezone('utc', now());
