-- In-app notifications v1. Push delivery can reuse these persisted payloads later.

do $$ begin
  create type public.notification_event_type as enum (
    'camp_goals_added',
    'session_review_added',
    'session_goals_added',
    'assessment_run_created'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type public.notification_event_type not null,
  message text not null check (length(trim(message)) > 0),
  target_href text not null check (target_href like '/%' and target_href not like '//%'),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_profile_id, created_at desc)
  where deleted_at is null;

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id, created_at desc)
  where read_at is null and deleted_at is null;

create index if not exists notifications_team_created_idx
  on public.notifications (team_id, created_at desc)
  where deleted_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at, deleted_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (recipient_profile_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (recipient_profile_id = auth.uid())
with check (recipient_profile_id = auth.uid());
