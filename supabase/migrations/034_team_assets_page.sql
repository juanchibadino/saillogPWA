-- 034_team_assets_page.sql
-- Paginated team-scoped asset listing for the Assets page.

create index if not exists session_assets_type_session_created_idx
  on public.session_assets (asset_type, session_id, created_at desc);

create or replace function public.get_team_asset_page(
  p_team_id uuid,
  p_asset_type public.asset_type,
  p_venue_id uuid default null,
  p_year integer default null,
  p_camp_id uuid default null,
  p_session_id uuid default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  asset_id uuid,
  session_id uuid,
  asset_type public.asset_type,
  bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  thumbnail_bucket text,
  thumbnail_storage_path text,
  thumbnail_mime_type text,
  thumbnail_size_bytes bigint,
  asset_created_at timestamptz,
  team_venue_id uuid,
  venue_id uuid,
  venue_name text,
  venue_city text,
  venue_country text,
  camp_id uuid,
  camp_name text,
  session_type public.session_type,
  session_date date,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select
      greatest(1, least(coalesce(p_limit, 24), 96)) as safe_limit,
      greatest(0, coalesce(p_offset, 0)) as safe_offset
  ),
  filtered as (
    select
      sa.id as asset_id,
      sa.session_id,
      sa.asset_type,
      sa.bucket,
      sa.storage_path,
      sa.file_name,
      sa.mime_type,
      sa.size_bytes,
      sa.thumbnail_bucket,
      sa.thumbnail_storage_path,
      sa.thumbnail_mime_type,
      sa.thumbnail_size_bytes,
      sa.created_at as asset_created_at,
      tv.id as team_venue_id,
      tv.venue_id,
      v.name as venue_name,
      v.city as venue_city,
      v.country as venue_country,
      c.id as camp_id,
      c.name as camp_name,
      s.session_type,
      s.session_date
    from public.session_assets sa
    join public.sessions s on s.id = sa.session_id
    join public.camps c on c.id = s.camp_id
    join public.team_venues tv on tv.id = c.team_venue_id
    join public.venues v on v.id = tv.venue_id
    where tv.team_id = p_team_id
      and public.can_read_team_scope(p_team_id)
      and sa.asset_type = p_asset_type
      and (p_venue_id is null or tv.venue_id = p_venue_id)
      and (p_year is null or extract(year from s.session_date)::integer = p_year)
      and (p_camp_id is null or c.id = p_camp_id)
      and (p_session_id is null or s.id = p_session_id)
  )
  select
    filtered.asset_id,
    filtered.session_id,
    filtered.asset_type,
    filtered.bucket,
    filtered.storage_path,
    filtered.file_name,
    filtered.mime_type,
    filtered.size_bytes,
    filtered.thumbnail_bucket,
    filtered.thumbnail_storage_path,
    filtered.thumbnail_mime_type,
    filtered.thumbnail_size_bytes,
    filtered.asset_created_at,
    filtered.team_venue_id,
    filtered.venue_id,
    filtered.venue_name,
    filtered.venue_city,
    filtered.venue_country,
    filtered.camp_id,
    filtered.camp_name,
    filtered.session_type,
    filtered.session_date,
    count(*) over() as total_count
  from filtered
  order by
    filtered.venue_name asc,
    filtered.session_date desc,
    filtered.session_id,
    filtered.asset_created_at desc,
    filtered.asset_id
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;
