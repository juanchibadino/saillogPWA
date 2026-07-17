-- Track the first successful entry into Dockout so pre-provisioned users can
-- remain labeled as Invited until they actually enter the app.

alter table public.profiles
  add column if not exists first_seen_at timestamptz;

update public.profiles p
set first_seen_at = coalesce(p.profile_completed_at, p.created_at)
from auth.users u
where p.id = u.id
  and p.first_seen_at is null
  and u.email_confirmed_at is not null;
