alter table public.profiles
  add column if not exists email_notifications_enabled boolean not null default true;
