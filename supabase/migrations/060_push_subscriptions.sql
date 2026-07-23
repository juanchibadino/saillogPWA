-- Persist Web Push subscriptions per user device.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, endpoint),
  check (length(trim(endpoint)) > 0),
  check (length(trim(p256dh)) > 0),
  check (length(trim(auth)) > 0)
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
on public.push_subscriptions
for select
using (profile_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
with check (profile_id = auth.uid());

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
on public.push_subscriptions
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
on public.push_subscriptions
for delete
using (profile_id = auth.uid());
