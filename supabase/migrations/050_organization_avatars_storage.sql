-- 050_organization_avatars_storage.sql
-- Public, small organization avatar images used in navigation and settings.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'organization-avatars',
    'organization-avatars',
    true,
    65536,
    array['image/webp']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
