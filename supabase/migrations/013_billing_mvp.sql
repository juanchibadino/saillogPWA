-- 013_billing_mvp.sql
-- Organization-scoped billing foundation with PayPal webhook audit.

do $$ begin
  create type public.plan_tier as enum ('free', 'pro', 'olympic');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_cycle as enum ('monthly', 'yearly', 'none');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'active',
    'approval_pending',
    'approved',
    'suspended',
    'cancelled',
    'expired',
    'payment_failed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_tier public.plan_tier not null default 'free',
  billing_cycle public.billing_cycle not null default 'none',
  status public.subscription_status not null default 'active',
  paypal_subscription_id text unique,
  paypal_plan_id text,
  current_period_start_at timestamptz,
  current_period_end_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_subscriptions_plan_tier_idx
  on public.organization_subscriptions (plan_tier);

create index if not exists organization_subscriptions_status_idx
  on public.organization_subscriptions (status);

drop trigger if exists set_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger set_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row
execute function public.set_updated_at();

create table if not exists public.paypal_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  resource_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  payload jsonb not null,
  verification_status text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paypal_webhook_events_event_type_idx
  on public.paypal_webhook_events (event_type);

create index if not exists paypal_webhook_events_org_idx
  on public.paypal_webhook_events (organization_id);

create index if not exists paypal_webhook_events_resource_idx
  on public.paypal_webhook_events (resource_id);

drop trigger if exists set_paypal_webhook_events_updated_at on public.paypal_webhook_events;
create trigger set_paypal_webhook_events_updated_at
before update on public.paypal_webhook_events
for each row
execute function public.set_updated_at();

create or replace function public.ensure_organization_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_subscriptions (
    organization_id,
    plan_tier,
    billing_cycle,
    status,
    created_by_profile_id
  )
  values (
    new.id,
    'free'::public.plan_tier,
    'none'::public.billing_cycle,
    'active'::public.subscription_status,
    auth.uid()
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_organization_created_subscription on public.organizations;
create trigger on_organization_created_subscription
after insert on public.organizations
for each row
execute function public.ensure_organization_subscription_row();

insert into public.organization_subscriptions (
  organization_id,
  plan_tier,
  billing_cycle,
  status,
  created_by_profile_id
)
select
  o.id,
  'free'::public.plan_tier,
  'none'::public.billing_cycle,
  'active'::public.subscription_status,
  null
from public.organizations o
left join public.organization_subscriptions os
  on os.organization_id = o.id
where os.organization_id is null;

alter table public.organization_subscriptions enable row level security;
alter table public.paypal_webhook_events enable row level security;

drop policy if exists organization_subscriptions_select_chain on public.organization_subscriptions;
create policy organization_subscriptions_select_chain
on public.organization_subscriptions
for select
using (
  public.is_super_admin()
  or public.is_org_member(organization_id)
);

drop policy if exists paypal_webhook_events_select_chain on public.paypal_webhook_events;
create policy paypal_webhook_events_select_chain
on public.paypal_webhook_events
for select
using (
  public.is_super_admin()
  or (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
);
