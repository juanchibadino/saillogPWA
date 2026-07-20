-- 049_sync_profiles_email_from_auth_users.sql
-- Keep public profile email aligned after Supabase Auth confirms an email change.

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    updated_at = now()
  where id = new.id
    and email is distinct from new.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email_from_auth_user();

update public.profiles p
set
  email = u.email,
  updated_at = now()
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;
