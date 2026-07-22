-- 057_session_vakaros_saved_trims.sql
-- Persist saved Vakaros playback trim windows and buoy layouts per GPS upload.

create table if not exists public.session_vakaros_saved_trims (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.session_vakaros_uploads(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  trim_start_index integer not null check (trim_start_index >= 0),
  trim_end_index integer not null check (trim_end_index >= trim_start_index),
  buoys jsonb not null default '[]'::jsonb check (
    jsonb_typeof(buoys) = 'array'
    and jsonb_array_length(buoys) <= 40
  ),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_vakaros_saved_trims_upload_created_idx
  on public.session_vakaros_saved_trims (upload_id, created_at desc);

drop trigger if exists set_session_vakaros_saved_trims_updated_at on public.session_vakaros_saved_trims;
create trigger set_session_vakaros_saved_trims_updated_at
before update on public.session_vakaros_saved_trims
for each row
execute function public.set_updated_at();

create or replace function public.team_id_for_session_vakaros_upload(target_upload_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.team_id_for_session(svu.session_id)
  from public.session_vakaros_uploads svu
  where svu.id = target_upload_id
  limit 1;
$$;

create or replace function public.validate_session_vakaros_saved_trim_range()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  upload_rows_1hz integer;
begin
  select svu.rows_1hz
  into upload_rows_1hz
  from public.session_vakaros_uploads svu
  where svu.id = new.upload_id
  limit 1;

  if upload_rows_1hz is null then
    raise exception 'Vakaros upload % not found', new.upload_id;
  end if;

  if upload_rows_1hz <= 0 or new.trim_end_index >= upload_rows_1hz then
    raise exception 'Saved trim range %-% is outside Vakaros upload % rows',
      new.trim_start_index,
      new.trim_end_index,
      new.upload_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_session_vakaros_saved_trim_range on public.session_vakaros_saved_trims;
create trigger validate_session_vakaros_saved_trim_range
before insert or update of upload_id, trim_start_index, trim_end_index
on public.session_vakaros_saved_trims
for each row
execute function public.validate_session_vakaros_saved_trim_range();

alter table public.session_vakaros_saved_trims enable row level security;

drop policy if exists session_vakaros_saved_trims_select_team_scope on public.session_vakaros_saved_trims;
create policy session_vakaros_saved_trims_select_team_scope
on public.session_vakaros_saved_trims
for select
using (
  public.can_read_team_scope(public.team_id_for_session_vakaros_upload(upload_id))
);

drop policy if exists session_vakaros_saved_trims_insert_manage_team_sessions on public.session_vakaros_saved_trims;
create policy session_vakaros_saved_trims_insert_manage_team_sessions
on public.session_vakaros_saved_trims
for insert
with check (
  public.can_manage_team_sessions(public.team_id_for_session_vakaros_upload(upload_id))
);

drop policy if exists session_vakaros_saved_trims_update_manage_team_sessions on public.session_vakaros_saved_trims;
create policy session_vakaros_saved_trims_update_manage_team_sessions
on public.session_vakaros_saved_trims
for update
using (
  public.can_manage_team_sessions(public.team_id_for_session_vakaros_upload(upload_id))
)
with check (
  public.can_manage_team_sessions(public.team_id_for_session_vakaros_upload(upload_id))
);

drop policy if exists session_vakaros_saved_trims_delete_manage_team_sessions on public.session_vakaros_saved_trims;
create policy session_vakaros_saved_trims_delete_manage_team_sessions
on public.session_vakaros_saved_trims
for delete
using (
  public.can_manage_team_sessions(public.team_id_for_session_vakaros_upload(upload_id))
);
