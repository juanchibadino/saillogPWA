-- 027_session_assets_storage.sql
-- Private storage buckets and policies for team-session images and files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'session-photos',
    'session-photos',
    false,
    2097152,
    array['image/webp']::text[]
  ),
  (
    'session-files',
    'session-files',
    false,
    26214400,
    array['application/pdf']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists session_assets_storage_select_team_scope on storage.objects;
create policy session_assets_storage_select_team_scope
on storage.objects
for select
to authenticated
using (
  bucket_id in ('session-photos', 'session-files')
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo|analytics_file)/.+$'
  and public.can_read_team_scope(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);

drop policy if exists session_assets_storage_insert_manage_team_sessions on storage.objects;
create policy session_assets_storage_insert_manage_team_sessions
on storage.objects
for insert
to authenticated
with check (
  case
    when bucket_id = 'session-photos'
      and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/photo/.+$'
      then public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
    when bucket_id = 'session-files'
      and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/analytics_file/.+$'
      then public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
    else false
  end
);

drop policy if exists session_assets_storage_update_manage_team_sessions on storage.objects;
create policy session_assets_storage_update_manage_team_sessions
on storage.objects
for update
to authenticated
using (
  bucket_id in ('session-photos', 'session-files')
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo|analytics_file)/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
)
with check (
  case
    when bucket_id = 'session-photos'
      and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/photo/.+$'
      then public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
    when bucket_id = 'session-files'
      and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/analytics_file/.+$'
      then public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
    else false
  end
);

drop policy if exists session_assets_storage_delete_manage_team_sessions on storage.objects;
create policy session_assets_storage_delete_manage_team_sessions
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('session-photos', 'session-files')
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo|analytics_file)/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);
