-- If the first_seen_at backfill ran after a pre-provisioned invite was created,
-- keep that user labeled as Invited until the invite is actually accepted.

update public.profiles p
set first_seen_at = null
from auth.users u
where p.id = u.id
  and p.first_seen_at is not null
  and p.profile_completed_at is null
  and u.email_confirmed_at is null;
