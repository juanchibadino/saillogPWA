-- 055_session_gps_files_v1.sql
-- Session-linked Vakaros GPS files and generated playback artifacts.

alter type public.asset_type add value if not exists 'gps_file';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'session-gps-files',
    'session-gps-files',
    false,
    26214400,
    array['text/csv', 'application/geo+json', 'application/json']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.session_vakaros_uploads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  asset_id uuid not null references public.session_assets(id) on delete cascade,
  bucket text not null,
  raw_storage_path text not null,
  series_1hz_storage_path text not null,
  track_geojson_storage_path text not null,
  summary_storage_path text not null,
  rows_raw integer not null check (rows_raw >= 0),
  rows_1hz integer not null check (rows_1hz >= 0),
  start_at timestamptz,
  end_at timestamptz,
  duration_hours numeric(10, 3) not null check (duration_hours >= 0),
  distance_nm numeric(10, 3) not null check (distance_nm >= 0),
  avg_sog_kts numeric(10, 2) not null check (avg_sog_kts >= 0),
  p95_sog_kts numeric(10, 2) not null check (p95_sog_kts >= 0),
  max_sog_kts numeric(10, 2) not null check (max_sog_kts >= 0),
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id)
);

create index if not exists session_vakaros_uploads_session_created_idx
  on public.session_vakaros_uploads (session_id, created_at desc);

alter table public.session_vakaros_uploads enable row level security;

drop policy if exists session_vakaros_uploads_select_team_scope on public.session_vakaros_uploads;
create policy session_vakaros_uploads_select_team_scope
on public.session_vakaros_uploads
for select
using (
  public.can_read_team_scope(public.team_id_for_session(session_id))
);

drop policy if exists session_vakaros_uploads_insert_manage_team_sessions on public.session_vakaros_uploads;
create policy session_vakaros_uploads_insert_manage_team_sessions
on public.session_vakaros_uploads
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_vakaros_uploads_update_manage_team_sessions on public.session_vakaros_uploads;
create policy session_vakaros_uploads_update_manage_team_sessions
on public.session_vakaros_uploads
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_vakaros_uploads_delete_manage_team_sessions on public.session_vakaros_uploads;
create policy session_vakaros_uploads_delete_manage_team_sessions
on public.session_vakaros_uploads
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session(session_id))
);

drop policy if exists session_gps_files_storage_select_team_scope on storage.objects;
create policy session_gps_files_storage_select_team_scope
on storage.objects
for select
to authenticated
using (
  bucket_id = 'session-gps-files'
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gps_file/.+$'
  and public.can_read_team_scope(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);

drop policy if exists session_gps_files_storage_insert_manage_team_sessions on storage.objects;
create policy session_gps_files_storage_insert_manage_team_sessions
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-gps-files'
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gps_file/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);

drop policy if exists session_gps_files_storage_update_manage_team_sessions on storage.objects;
create policy session_gps_files_storage_update_manage_team_sessions
on storage.objects
for update
to authenticated
using (
  bucket_id = 'session-gps-files'
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gps_file/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
)
with check (
  bucket_id = 'session-gps-files'
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gps_file/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);

drop policy if exists session_gps_files_storage_delete_manage_team_sessions on storage.objects;
create policy session_gps_files_storage_delete_manage_team_sessions
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-gps-files'
  and name ~ '^sessions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gps_file/.+$'
  and public.can_manage_team_sessions(public.team_id_for_session(split_part(name, '/', 2)::uuid))
);
