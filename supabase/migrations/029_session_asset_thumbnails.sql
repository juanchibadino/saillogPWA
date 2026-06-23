-- 029_session_asset_thumbnails.sql
-- Optional thumbnail object metadata for session photo assets.

alter table public.session_assets
  add column if not exists thumbnail_bucket text,
  add column if not exists thumbnail_storage_path text,
  add column if not exists thumbnail_mime_type text,
  add column if not exists thumbnail_size_bytes bigint check (
    thumbnail_size_bytes is null or thumbnail_size_bytes >= 0
  );

alter table public.session_assets
  drop constraint if exists session_assets_thumbnail_metadata_check;

alter table public.session_assets
  add constraint session_assets_thumbnail_metadata_check
  check (
    (
      thumbnail_bucket is null
      and thumbnail_storage_path is null
      and thumbnail_mime_type is null
      and thumbnail_size_bytes is null
    )
    or (
      asset_type = 'photo'
      and thumbnail_bucket is not null
      and thumbnail_storage_path is not null
      and thumbnail_mime_type = 'image/webp'
      and thumbnail_size_bytes is not null
      and thumbnail_size_bytes >= 0
    )
  );

create index if not exists session_assets_thumbnail_storage_idx
  on public.session_assets (thumbnail_bucket, thumbnail_storage_path)
  where thumbnail_storage_path is not null;
