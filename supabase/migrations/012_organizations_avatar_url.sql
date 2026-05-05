-- 012_organizations_avatar_url.sql
-- Add optional organization avatar URL used by navigation and organization views.

alter table public.organizations
  add column if not exists avatar_url text;
