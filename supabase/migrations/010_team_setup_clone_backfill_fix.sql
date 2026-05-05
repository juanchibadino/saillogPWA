-- 010_team_setup_clone_backfill_fix.sql
-- Ensure team setup options are backfilled even when team setup items already exist.

create or replace function public.clone_team_setup_from_team_type(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_team_type text;
begin
  if target_team_id is null then
    return;
  end if;

  select t.team_type
  into resolved_team_type
  from public.teams t
  where t.id = target_team_id
  limit 1;

  if resolved_team_type is null or btrim(resolved_team_type) = '' then
    return;
  end if;

  -- Ensure team has template items from team_type defaults.
  insert into public.team_setup_items (
    team_id,
    team_type_setup_item_id,
    key,
    label,
    input_kind,
    position,
    is_active
  )
  select
    target_team_id,
    ttsi.id,
    ttsi.key,
    ttsi.label,
    ttsi.input_kind,
    ttsi.position,
    ttsi.is_active
  from public.team_type_setup_items ttsi
  where ttsi.team_type = resolved_team_type
  order by ttsi.position, ttsi.created_at
  on conflict (team_id, key) do nothing;

  -- If items were created earlier without source linkage, attach by key.
  update public.team_setup_items tsi
  set team_type_setup_item_id = ttsi.id
  from public.team_type_setup_items ttsi
  where tsi.team_id = target_team_id
    and ttsi.team_type = resolved_team_type
    and tsi.key = ttsi.key
    and tsi.team_type_setup_item_id is null;

  -- Always backfill missing options for every linked item.
  insert into public.team_setup_item_options (
    team_setup_item_id,
    team_type_setup_item_option_id,
    value,
    label,
    position,
    is_active
  )
  select
    tsi.id,
    ttsio.id,
    ttsio.value,
    ttsio.label,
    ttsio.position,
    ttsio.is_active
  from public.team_setup_items tsi
  join public.team_type_setup_items ttsi on ttsi.id = tsi.team_type_setup_item_id
  join public.team_type_setup_item_options ttsio on ttsio.team_type_setup_item_id = ttsi.id
  where tsi.team_id = target_team_id
    and ttsi.team_type = resolved_team_type
  order by tsi.position, ttsio.position
  on conflict (team_setup_item_id, value) do update
  set team_type_setup_item_option_id = excluded.team_type_setup_item_option_id,
      label = excluded.label,
      position = excluded.position,
      is_active = excluded.is_active,
      updated_at = now();
end;
$$;

-- Backfill all existing teams with team_type values.
do $$
declare
  current_team_id uuid;
begin
  for current_team_id in
    select t.id
    from public.teams t
    where t.team_type is not null
      and btrim(t.team_type) <> ''
  loop
    perform public.clone_team_setup_from_team_type(current_team_id);
  end loop;
end;
$$;
